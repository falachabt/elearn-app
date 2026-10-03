import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  appliquerTempsReel,
  depenser as depenserServeur,
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
  /** Dépense côté serveur ; le solde se met à jour aussitôt, puis par le temps réel. */
  depenser: <C = Record<string, unknown>>(action: ActionCredit, objet: string | number) => Promise<Depense<C>>;
  rafraichir: () => Promise<void>;
};

const ContexteCredits = createContext<Credits>({
  solde: null,
  couts: {},
  reglages: null,
  depensesSemaine: 0,
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

  const rafraichir = useCallback(async () => {
    if (!utilisateur) return;
    const client = getSupabase();
    const [s, c, r] = await Promise.all([lireSolde(client, await identifiantAppareil()), lireCouts(client), lireReglages(client).catch(() => null)]);
    majSolde(utilisateur, () => s);
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
        setCouts(c);
        if (r) setReglages(r);
      })
      .catch(() => {});
    return suivreSolde(getSupabase(), utilisateur, (ligne) => majSolde(utilisateur, (s) => (s ? appliquerTempsReel(s, ligne) : s)));
  }, [utilisateur, invite, majSolde]);

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
      const r = await depenserServeur<C>(getSupabase(), action, objet);
      if (utilisateur) majSolde(utilisateur, (s) => (s ? { ...s, total: r.solde } : s));
      return r;
    },
    [utilisateur, majSolde],
  );

  const valeur = useMemo(() => ({ solde, couts, reglages, depensesSemaine, depenser, rafraichir }), [solde, couts, reglages, depensesSemaine, depenser, rafraichir]);
  return <ContexteCredits.Provider value={valeur}>{children}</ContexteCredits.Provider>;
}

export const useCredits = () => useContext(ContexteCredits);
