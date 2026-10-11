import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { assurerSessionInvite } from '@/services/session';
import { identifier } from '@/services/analytics';
import { restaurerHistorique } from '@/services/donneesLocales';
import { enregistrerJetonPush } from '@/services/push';
import { finirRetourOAuthWebUneFois } from '@/services/retourOAuthWeb';
import { synchroniserResultat } from '@/services/miniTest';
import { synchroniserLues } from '@/services/reviser';
import { repriseInviteEnCours, reprendreApresRedemarrage } from '@/services/repriseInvite';
import { suivreProgressionEntrainement, synchroniserEntrainement } from '@/services/synchroEntrainement';
import { appliquerReglagesCompteSiPlusRecent, suivreModifications, synchroniserReglages } from '@/services/synchroReglages';
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
        // Web : terminer le retour OAuth (Google, Apple) AVANT de créer une session invité. Sinon, au retour d'une
        // connexion, l'invité était créé d'abord, son profil était lu (parcours d'arrivée non terminé) et l'élève
        // connecté retombait sur « bienvenue ».
        await finirRetourOAuthWebUneFois(client);
        const session = await assurerSessionInvite(client);
        const reprise = await reprendreApresRedemarrage(session.user.id);
        // Les réglages du compte portent le parcours d'arrivée (profil) : les appliquer au téléphone AVANT de marquer
        // la session prête, sinon un élève connecté sur un appareil sans profil local (navigateur web neuf) retombait
        // sur « bienvenue ». Écritures locales seulement ; l'envoi vers le compte reste en arrière-plan.
        await appliquerReglagesCompteSiPlusRecent(session.user).catch(() => {});
        if (!actif) return;
        setEtat({ statut: 'pret', session, erreur: null });
        identifier(session.user.id, { email: session.user.email, invite: session.user.is_anonymous ?? false });
        if (!reprise) {
          synchroniserReglages(client, session.user).catch(() => {});
          synchroniserEntrainement(client).catch((erreur: unknown) => console.warn('La synchronisation des entraînements a échoué.', erreur));
          void enregistrerJetonPush(client);
        }
        const arreterSuivi = suivreModifications(client);
        const arreterSuiviEntrainement = suivreProgressionEntrainement(client);
        const { data } = client.auth.onAuthStateChange((evenement, nouvelle) => {
          if (actif && nouvelle) {
            setEtat({ statut: 'pret', session: nouvelle, erreur: null });
            identifier(nouvelle.user.id, { email: nouvelle.user.email, invite: nouvelle.user.is_anonymous ?? false });
            // M1-04 : le score d'invité suit le compte, même quand la connexion change d'utilisateur (Apple, ancien compte).
            // Différé : ne jamais appeler Supabase depuis le rappel lui-même (verrou de session).
            if (evenement === 'SIGNED_IN') {
              setTimeout(() => {
                if (repriseInviteEnCours()) return;
                synchroniserResultat(client).catch(() => {});
                synchroniserReglages(client, nouvelle.user).catch(() => {});
                synchroniserEntrainement(client).catch((erreur: unknown) => console.warn('La synchronisation des entraînements a échoué.', erreur));
                // M2-14 : après une connexion (ou reconnexion), la série et les leçons validées reviennent du compte.
                restaurerHistorique(client).catch(() => {});
                synchroniserLues(client).catch(() => {});
                // Nouveau compte sur ce téléphone : son jeton push lui est donné (si la permission l'est déjà).
                void enregistrerJetonPush(client);
              }, 0);
            }
          }
        });
        desabonner = () => {
          data.subscription.unsubscribe();
          arreterSuivi();
          arreterSuiviEntrainement();
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
