import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { assurerSessionInvite } from '@/services/session';
import { identifier } from '@/services/analytics';
import { synchroniserResultat } from '@/services/miniTest';
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
        identifier(session.user.id);
        const { data } = client.auth.onAuthStateChange((evenement, nouvelle) => {
          if (actif && nouvelle) {
            setEtat({ statut: 'pret', session: nouvelle, erreur: null });
            identifier(nouvelle.user.id);
            // M1-04 : le score d'invité suit le compte, même quand la connexion change d'utilisateur (Apple, ancien compte).
            // Différé : ne jamais appeler Supabase depuis le rappel lui-même (verrou de session).
            if (evenement === 'SIGNED_IN') setTimeout(() => synchroniserResultat(client).catch(() => {}), 0);
          }
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
