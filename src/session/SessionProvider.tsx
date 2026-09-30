import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { assurerSessionInvite } from '@/services/session';
import { identifier } from '@/services/analytics';
import { synchroniserResultat } from '@/services/miniTest';
import { suivreModifications, synchroniserReglages } from '@/services/synchroReglages';
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
        synchroniserReglages(client, session.user).catch(() => {});
        const arreterSuivi = suivreModifications(client);
        const { data } = client.auth.onAuthStateChange((evenement, nouvelle) => {
          if (actif && nouvelle) {
            setEtat({ statut: 'pret', session: nouvelle, erreur: null });
            identifier(nouvelle.user.id);
            // M1-04 : le score d'invité suit le compte, même quand la connexion change d'utilisateur (Apple, ancien compte).
            // Différé : ne jamais appeler Supabase depuis le rappel lui-même (verrou de session).
            if (evenement === 'SIGNED_IN') {
              setTimeout(() => {
                synchroniserResultat(client).catch(() => {});
                synchroniserReglages(client, nouvelle.user).catch(() => {});
              }, 0);
            }
          }
        });
        desabonner = () => {
          data.subscription.unsubscribe();
          arreterSuivi();
        };
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

/**
 * Clé à mettre dans les dépendances des chargements qui appellent Supabase : null tant que la session invité n'est pas
 * prête (sinon l'appel partirait en « anon » et serait refusé), puis l'identifiant de l'utilisateur, ou « hors-ligne »
 * si la session n'a pas pu être créée (les écrans utilisent alors leurs copies locales).
 */
export function useSessionPrete(): string | null {
  const { statut, session } = useContext(ContexteSession);
  if (statut === 'chargement') return null;
  return session?.user.id ?? 'hors-ligne';
}
