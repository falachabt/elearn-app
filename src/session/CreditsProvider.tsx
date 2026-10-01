import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  appliquerTempsReel,
  depenser as depenserServeur,
  identifiantAppareil,
  lireCouts,
  lireSolde,
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
  /** Dépense côté serveur ; le solde se met à jour aussitôt, puis par le temps réel. */
  depenser: <C = Record<string, unknown>>(action: ActionCredit, objet: string | number) => Promise<Depense<C>>;
  rafraichir: () => Promise<void>;
};

const ContexteCredits = createContext<Credits>({
  solde: null,
  couts: {},
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

  const rafraichir = useCallback(async () => {
    if (!utilisateur) return;
    const client = getSupabase();
    const [s, c] = await Promise.all([lireSolde(client, await identifiantAppareil()), lireCouts(client)]);
    majSolde(utilisateur, () => s);
    setCouts(c);
  }, [utilisateur, majSolde]);

  useEffect(() => {
    if (!utilisateur) return;
    const client = getSupabase();
    identifiantAppareil()
      .then((appareil) => Promise.all([lireSolde(client, appareil), lireCouts(client)]))
      .then(([s, c]) => {
        majSolde(utilisateur, () => s);
        setCouts(c);
      })
      .catch(() => {});
    return suivreSolde(getSupabase(), utilisateur, (ligne) => majSolde(utilisateur, (s) => (s ? appliquerTempsReel(s, ligne) : s)));
  }, [utilisateur, invite, majSolde]);

  const depenser = useCallback(
    async <C,>(action: ActionCredit, objet: string | number) => {
      const r = await depenserServeur<C>(getSupabase(), action, objet);
      if (utilisateur) majSolde(utilisateur, (s) => (s ? { ...s, total: r.solde } : s));
      return r;
    },
    [utilisateur, majSolde],
  );

  const valeur = useMemo(() => ({ solde, couts, depenser, rafraichir }), [solde, couts, depenser, rafraichir]);
  return <ContexteCredits.Provider value={valeur}>{children}</ContexteCredits.Provider>;
}

export const useCredits = () => useContext(ContexteCredits);
