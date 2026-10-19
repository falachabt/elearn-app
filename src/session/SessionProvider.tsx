import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { assurerSessionInvite } from '@/services/session';
import { identifier, reinitialiserIdentite } from '@/services/analytics';
import { effacerDonneesLocales, restaurerHistorique } from '@/services/donneesLocales';
import { enregistrerJetonPush } from '@/services/push';
import { finirRetourOAuthWebUneFois } from '@/services/retourOAuthWeb';
import { synchroniserResultat } from '@/services/miniTest';
import { synchroniserActivitesServeur } from '@/services/activite';
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
        await finirRetourOAuthWebUneFois(client).catch(() => 'rien');
        const session = await assurerSessionInvite(client);
        const reprise = await reprendreApresRedemarrage(session.user.id).catch(() => false);
        // Les réglages du compte portent le parcours d'arrivée (profil) : les appliquer au téléphone AVANT de marquer
        // la session prête, sinon un élève connecté sur un appareil sans profil local (navigateur web neuf) retombait
        // sur « bienvenue ». Écritures locales seulement ; l'envoi vers le compte reste en arrière-plan.
        await appliquerReglagesCompteSiPlusRecent(session.user).catch(() => {});
        if (!actif) return;
        setEtat({ statut: 'pret', session, erreur: null });
        void identifier(session.user.id, { invite: session.user.is_anonymous ?? false });
        if (!reprise) {
          synchroniserReglages(client, session.user).catch(() => {});
          synchroniserEntrainement(client).catch((erreur: unknown) => console.warn('La synchronisation des entraînements a échoué.', erreur));
          void enregistrerJetonPush(client);
        }
        if (!session.user.is_anonymous && typeof client.auth?.getUser === 'function') {
          void client.auth.getUser().then(({ data }) => {
            if (actif && data?.user) {
              setEtat((e) => (e.session ? { ...e, session: { ...e.session, user: data.user } } : e));
            }
          }).catch(() => {});
        }
        const arreterSuivi = suivreModifications(client);
        const arreterSuiviEntrainement = suivreProgressionEntrainement(client);
        const { data } = client.auth.onAuthStateChange(async (evenement, nouvelle) => {
          if (actif && nouvelle) {
            // Connexion : le parcours d'arrivée du compte est appliqué AVANT de publier la session, comme au démarrage.
            // Sinon la garde des onglets lit le profil local (non terminé) et renvoie à « bienvenue » le temps du délai.
            if (evenement === 'SIGNED_IN') await appliquerReglagesCompteSiPlusRecent(nouvelle.user).catch(() => {});
            if (!actif) return;
            setEtat({ statut: 'pret', session: nouvelle, erreur: null });
            void identifier(nouvelle.user.id, { invite: nouvelle.user.is_anonymous ?? false });
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
                synchroniserActivitesServeur(client).catch(() => {});
                // Nouveau compte sur ce téléphone : son jeton push lui est donné (si la permission l'est déjà).
                void enregistrerJetonPush(client);
              }, 0);
            }
          } else if (evenement === 'SIGNED_OUT' || !nouvelle) {
            // Session sign out – clear state, wipe local data and recreate invited session
            setEtat({ statut: 'chargement', session: null, erreur: null });
            void (async () => {
              await effacerDonneesLocales().catch(() => {});
              // Le profil de suivi repart de zéro : le prochain invité aura son propre identifiant.
              await reinitialiserIdentite();
              const invited = await assurerSessionInvite(client);
              if (actif) {
                setEtat({ statut: 'pret', session: invited, erreur: null });
              }
            })();
          }
        });

        // B10-5 : Gestion du cycle de vie mobile (arrière-plan / premier plan).
        // Sur mobile, les timers JS se figent en arrière-plan. Au retour au premier plan (active),
        // on relance l'auto-refresh Supabase et on rafraîchit immédiatement le JWT si expiré.
        const abonnementAppState = AppState.addEventListener('change', (etatApp) => {
          if (Platform.OS !== 'web' && typeof client.auth?.startAutoRefresh === 'function') {
            if (etatApp === 'active') {
              client.auth.startAutoRefresh();
              void client.auth.getSession().then(async (reponse) => {
                const s = reponse?.data?.session;
                if (!actif || !s) return;
                const now = Math.floor(Date.now() / 1000);
                if (s.expires_at && s.expires_at - now < 60 && typeof client.auth?.refreshSession === 'function') {
                  const { data } = await client.auth.refreshSession().catch(() => ({ data: { session: null } }));
                  const sessionRefraichie = data?.session;
                  if (actif && sessionRefraichie) {
                    setEtat((prec) => (prec.statut === 'pret' ? { ...prec, session: sessionRefraichie } : prec));
                  }
                } else {
                  setEtat((prec) => (prec.statut === 'pret' ? { ...prec, session: s } : prec));
                }
              }).catch(() => {});
            } else if (etatApp === 'background' && typeof client.auth?.stopAutoRefresh === 'function') {
              client.auth.stopAutoRefresh();
            }
          }
        });

        desabonner = () => {
          abonnementAppState.remove();
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
