import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  appliquerTempsReel,
  identifiantAppareil,
  lireCouts,
  lireReglages,
  lireSemaine,
  lireSolde,
  type ReglagesCredits,
  suivreSolde,
  type ActionCredit,
  type Depense,
  type Solde,
} from '@/services/credits';
import {
  compterDepensesEnAttente,
  depenserAvecRepli,
  garderSoldeLocal,
  lireSoldeLocal,
  synchroniserDepensesHorsLigne,
} from '@/services/creditsHorsLigne';
import { ecouterConnectivite, estEnLigne } from '@/services/connectivite';
import { getSupabase } from '@/services/supabase';

import { useSession } from './SessionProvider';

type Credits = {
  /** null tant que le solde n'est pas chargé (ou hors ligne). */
  solde: Solde | null;
  couts: Partial<Record<ActionCredit, number>>;
  /** Montants du back-office (bienvenue, invité, recharge) ; null tant qu'ils ne sont pas lus. */
  reglages: ReglagesCredits | null;
  /** Crédits dépensés depuis lundi (registre) : la jauge se vide d'autant. 0 tant que non lu. */
  depensesSemaine: number;
  /** Nombre de dépenses faites hors ligne qui attendent la confirmation du serveur (issue #13). */
  depensesEnAttente: number;
  /** Dépense côté serveur ; le solde se met à jour aussitôt, puis par le temps réel. */
  depenser: <C = Record<string, unknown>>(action: ActionCredit, objet: string | number) => Promise<Depense<C>>;
  rafraichir: () => Promise<void>;
};

const ContexteCredits = createContext<Credits>({
  solde: null,
  couts: {},
  reglages: null,
  depensesSemaine: 0,
  depensesEnAttente: 0,
  depenser: () => Promise.reject(new Error('CreditsProvider absent')),
  rafraichir: async () => {},
});

/** Un seul abonnement temps réel au solde pour toute l'app (M18-06). */
export function CreditsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const utilisateur = session?.user.id ?? null;
  // Un invité qui crée son compte garde son identifiant : relire pour le bonus de bienvenue.
  const invite = session?.user.is_anonymous ?? null;
  // Le solde est rangé avec son propriétaire : à un changement de compte, l'ancien ne s'affiche plus.
  const [etat, setEtat] = useState<{ pour: string; solde: Solde } | null>(null);
  const solde = etat && etat.pour === utilisateur ? etat.solde : null;
  const majSolde = useCallback(
    (pour: string, f: (s: Solde | null) => Solde | null) =>
      setEtat((e) => {
        const nouveau = f(e && e.pour === pour ? e.solde : null);
        return nouveau ? { pour, solde: nouveau } : null;
      }),
    [],
  );
  const [couts, setCouts] = useState<Partial<Record<ActionCredit, number>>>({});
  const [reglages, setReglages] = useState<ReglagesCredits | null>(null);
  const [depenses, setDepenses] = useState<{ pour: string; n: number } | null>(null);
  // Dépenses hors ligne en attente : tant qu'il en reste, le solde affiché n'est pas confirmé par le serveur.
  const [attente, setAttente] = useState<{ pour: string; n: number } | null>(null);
  const depensesEnAttente = attente && attente.pour === utilisateur ? attente.n : 0;

  const rafraichir = useCallback(async () => {
    if (!utilisateur) return;
    const client = getSupabase();
    const appareil = await identifiantAppareil();
    // Un solde reçu du serveur est confirmé (sauf dépenses en attente) et remplace la copie locale.
    const s = await lireSolde(client, appareil);
    majSolde(utilisateur, () => s);
    void garderSoldeLocal(utilisateur, s);
    const [c, r] = await Promise.all([lireCouts(client), lireReglages(client).catch(() => null)]);
    setCouts(c);
    if (r) setReglages(r);
  }, [utilisateur, majSolde]);

  useEffect(() => {
    if (!utilisateur) return;
    const client = getSupabase();
    identifiantAppareil()
      .then((appareil) => Promise.all([lireSolde(client, appareil), lireCouts(client), lireReglages(client).catch(() => null)]))
      .then(([s, c, r]) => {
        majSolde(utilisateur, () => s);
        void garderSoldeLocal(utilisateur, s);
        setCouts(c);
        if (r) setReglages(r);
      })
      // Hors ligne au démarrage : on affiche le dernier solde confirmé, jamais celui d'un autre compte.
      .catch(() => {
        void lireSoldeLocal(utilisateur).then((garde) => {
          if (garde) majSolde(utilisateur, () => garde.solde);
        });
      });
    // Les dépenses hors ligne laissées par une session précédente restent à signaler dès l'ouverture.
    void compterDepensesEnAttente(utilisateur).then((n) => setAttente({ pour: utilisateur, n }));
    return suivreSolde(getSupabase(), utilisateur, (ligne) => majSolde(utilisateur, (s) => (s ? appliquerTempsReel(s, ligne) : s)));
  }, [utilisateur, invite, majSolde]);

  /**
   * Dépenses faites hors ligne : rejouées dès que le réseau revient, puis quand l'app revient au premier plan.
   * Le solde est repris du serveur au passage, ce qui confirme (ou corrige) le solde local.
   */
  const rejouer = useCallback(async () => {
    if (!utilisateur || !estEnLigne()) return;
    const garde = await lireSoldeLocal(utilisateur);
    const r = await synchroniserDepensesHorsLigne({ client: getSupabase(), utilisateur, soldeLocal: garde?.solde ?? null });
    setAttente({ pour: utilisateur, n: r.restantes });
    if (garde && r.solde && r.solde.total !== garde.solde.total) majSolde(utilisateur, () => r.solde as Solde);
    if (r.envoyees) await rafraichir().catch(() => {});
  }, [utilisateur, majSolde, rafraichir]);

  useEffect(() => {
    if (!utilisateur) return;
    let actif = true;
    // Rejeu immédiat (l'app peut déjà être en ligne), puis à chaque retour du serveur.
    const rejouerSiActif = () => {
      void rejouer()
        .then(() => {
          if (actif) return compterDepensesEnAttente(utilisateur).then((n) => actif && setAttente({ pour: utilisateur, n }));
          return undefined;
        })
        .catch(() => {});
    };
    const arreter = ecouterConnectivite((e) => {
      if (e.backend === true) rejouerSiActif();
    });
    rejouerSiActif();
    return () => {
      actif = false;
      arreter();
    };
  }, [utilisateur, rejouer]);

  // Dépenses de la semaine : relues quand le solde bouge (une dépense, un bonus) ou que la semaine change.
  const total = solde?.total;
  const prochaine = solde?.prochaineRecharge;
  useEffect(() => {
    if (!utilisateur || total === undefined || !prochaine) return;
    let actif = true;
    lireSemaine(getSupabase(), prochaine)
      .then((sem) => actif && setDepenses({ pour: utilisateur, n: sem.depenses }))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [utilisateur, total, prochaine]);
  const depensesSemaine = depenses && depenses.pour === utilisateur ? Math.max(0, depenses.n) : 0;

  // Retour dans l'app : le solde a pu changer sans que le temps réel ne passe (bonus, récompense, recharge du lundi).
  useEffect(() => {
    if (!utilisateur) return;
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') void rafraichir().catch(() => {});
    });
    return () => abonnement.remove();
  }, [utilisateur, rafraichir]);

  const depenser = useCallback(
    async <C,>(action: ActionCredit, objet: string | number) => {
      // Hors ligne, la dépense se fait sur le dernier solde connu, adossée au contenu déjà présent sur l'appareil.
      const garde = utilisateur ? await lireSoldeLocal(utilisateur) : null;
      const r = await depenserAvecRepli<C>({
        client: getSupabase(),
        utilisateur: utilisateur ?? '',
        soldeLocal: garde?.solde ?? null,
        cout: couts[action] ?? 0,
        action,
        objet,
      });
      if (utilisateur) majSolde(utilisateur, (s) => (s ? { ...s, total: r.solde } : s));
      return r;
    },
    [utilisateur, majSolde, couts],
  );

  const valeur = useMemo(
    () => ({ solde, couts, reglages, depensesSemaine, depensesEnAttente, depenser, rafraichir }),
    [solde, couts, reglages, depensesSemaine, depensesEnAttente, depenser, rafraichir],
  );
  return <ContexteCredits.Provider value={valeur}>{children}</ContexteCredits.Provider>;
}

export const useCredits = () => useContext(ContexteCredits);
