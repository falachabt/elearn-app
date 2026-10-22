import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { assurerSessionInvite } from '@/services/session';
import { identifier, reinitialiserIdentite } from '@/services/analytics';
import { ecouterConnectivite } from '@/services/connectivite';
import { restaurerHistorique } from '@/services/donneesLocales';
import { enregistrerJetonPush } from '@/services/push';
import { finirRetourOAuthWebUneFois } from '@/services/retourOAuthWeb';
import { synchroniserResultat } from '@/services/miniTest';
import { synchroniserCoches } from '@/services/planning';
import { synchroniserActivitesServeur } from '@/services/activite';
import { synchroniserLues } from '@/services/reviser';
import { repriseInviteEnCours, reprendreApresRedemarrage } from '@/services/repriseInvite';
import { suivreProgressionEntrainement, synchroniserEntrainement } from '@/services/synchroEntrainement';
import { appliquerReglagesCompteSiPlusRecent, suivreModifications, synchroniserReglages } from '@/services/synchroReglages';
import { getSupabase } from '@/services/supabase';

type Etat =
  | { statut: 'chargement'; session: null; erreur: null }
  | { statut: 'pret'; session: Session | null; erreur: null }
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
        const arreterSuivi = suivreModifications(client);
        const arreterSuiviEntrainement = suivreProgressionEntrainement(client);

        // L'écouteur d'authentification est abonné immédiatement pour ne rater aucun retour OAuth ou échange de session.
        const { data } = client.auth.onAuthStateChange(async (evenement, nouvelle) => {
          if (actif && nouvelle) {
            if (evenement === 'SIGNED_IN') await appliquerReglagesCompteSiPlusRecent(nouvelle.user).catch(() => {});
            if (!actif) return;
            setEtat({ statut: 'pret', session: nouvelle, erreur: null });
            void identifier(nouvelle.user.id, { invite: nouvelle.user.is_anonymous ?? false });
            if (evenement === 'SIGNED_IN') {
              setTimeout(() => {
                if (repriseInviteEnCours()) return;
                synchroniserResultat(client).catch(() => {});
                synchroniserReglages(client, nouvelle.user).catch(() => {});
                synchroniserCoches(client, nouvelle.user.id).catch(() => {});
                synchroniserEntrainement(client).catch((erreur: unknown) => console.warn('La synchronisation des entraînements a échoué.', erreur));
                restaurerHistorique(client).catch(() => {});
                synchroniserLues(client).catch(() => {});
                synchroniserActivitesServeur(client).catch(() => {});
                void enregistrerJetonPush(client);
              }, 0);
            }
          } else if (evenement === 'SIGNED_OUT' || !nouvelle) {
            setEtat({ statut: 'chargement', session: null, erreur: null });
            void (async () => {
              await reinitialiserIdentite().catch(() => {});
              try {
                const invited = await assurerSessionInvite(client);
                if (actif) setEtat({ statut: 'pret', session: invited, erreur: null });
              } catch {
                if (actif) setEtat({ statut: 'pret', session: null, erreur: null });
              }
            })();
          }
        });

        await finirRetourOAuthWebUneFois(client).catch(() => {});
        try {
          const session = await assurerSessionInvite(client);
          if (!actif) return;
          const reprise = await reprendreApresRedemarrage(session.user.id).catch(() => false);
          await appliquerReglagesCompteSiPlusRecent(session.user).catch(() => {});
          if (!actif) return;
          setEtat({ statut: 'pret', session, erreur: null });
          void identifier(session.user.id, { invite: session.user.is_anonymous ?? false });
          if (!reprise) {
            synchroniserReglages(client, session.user).catch(() => {});
            synchroniserCoches(client, session.user.id).catch(() => {});
            synchroniserEntrainement(client).catch((erreur: unknown) => console.warn('La synchronisation des entraînements a échoué.', erreur));
            void enregistrerJetonPush(client);
          }
          if (!session.user.is_anonymous && typeof client.auth?.getUser === 'function') {
            void client.auth.getUser().then(({ data: uData }) => {
              if (actif && uData?.user) {
                setEtat((e) => (e.session ? { ...e, session: { ...e.session, user: uData.user } } : e));
              }
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Session invité non établie au démarrage (repli hors ligne) :', e);
          if (actif) setEtat({ statut: 'pret', session: null, erreur: null });
        }

        // Si l'application a démarré hors ligne (session null), on réessaie automatiquement dès le retour du réseau.
        const arreterConnectivite = ecouterConnectivite((etatConn) => {
          if (etatConn.connecte && actif) {
            setEtat((actuel) => {
              if (actuel.statut === 'pret' && !actuel.session) {
                void assurerSessionInvite(client)
                  .then((s) => {
                    if (actif && s) {
                      setEtat({ statut: 'pret', session: s, erreur: null });
                      void identifier(s.user.id, { invite: s.user.is_anonymous ?? false });
                    }
                  })
                  .catch(() => {});
              }
              return actuel;
            });
          }
        });

        desabonner = () => {
          data.subscription.unsubscribe();
          arreterSuivi();
          arreterSuiviEntrainement();
          arreterConnectivite();
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
