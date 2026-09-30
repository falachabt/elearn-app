import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { assurerSessionInvite } from '@/services/session';
import { getSupabase } from '@/services/supabase';

type Etat =
  | { statut: 'chargement'; session: null; erreur: null }
  | { statut: 'pret'; session: Session; erreur: null }
  | { statut: 'erreur'; session: null; erreur: Error };

const ContexteSession = createContext<Etat>({ statut: 'chargement', session: null, erreur: null });

/** Ne bloque jamais l'affichage : les enfants sont toujours rendus, même en cas d'erreur. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement', session: null, erreur: null });

  useEffect(() => {
    let actif = true;
    let desabonner: (() => void) | undefined;

    (async () => {
      try {
        const client = getSupabase();
        const session = await assurerSessionInvite(client);
        if (!actif) return;
        setEtat({ statut: 'pret', session, erreur: null });
        const { data } = client.auth.onAuthStateChange((_evenement, nouvelle) => {
          if (actif && nouvelle) setEtat({ statut: 'pret', session: nouvelle, erreur: null });
        });
        desabonner = () => data.subscription.unsubscribe();
      } catch (e) {
        if (actif) setEtat({ statut: 'erreur', session: null, erreur: e instanceof Error ? e : new Error(String(e)) });
      }
    })();

    return () => {
      actif = false;
      desabonner?.();
    };
  }, []);

  const valeur = useMemo(() => etat, [etat]);
  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>;
}

export const useSession = () => useContext(ContexteSession);
