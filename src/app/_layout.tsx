import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BandeauApplication } from '@/components/BandeauApplication';
import { BarresSysteme } from '@/components/BarresSysteme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BienvenueCredits } from '@/components/credits/BienvenueCredits';
import { ToastRechargeCredits } from '@/components/credits/ToastRechargeCredits';
import { ToastGainXp } from '@/components/xp/ToastGainXp';
import { useOuvertureRecapAuto } from '@/components/maSemaine/useOuvertureRecapAuto';
import { BienvenuePass } from '@/components/pass/BienvenuePass';
import { GardeAppareilActif } from '@/components/compte/GardeAppareilActif';
import { useReduireAnimations } from '@/components/useReduireAnimations';
import { MiseAJour } from '@/components/MiseAJour';
import { ToastProvider } from '@/components/Toast';
import { useDemandeSupportAuto } from '@/components/support/useDemandeSupportAuto';
import { VisiteProvider } from '@/components/Visite';
import { restaurerLangue } from '@/i18n';
import { demarrerConnectivite } from '@/services/connectivite';
import { ecouterLiensParrainage } from '@/services/lienProfond';
import { precharger } from '@/services/retours';
import { suivreOuvertures } from '@/services/rappels';
import { initAnalytics, suivre, suivreEcran } from '@/services/analytics';
import { demarrerSuivi, nomEcran } from '@/services/suivi';
import { installerHandlerGlobal } from '@/services/erreurs';
import { lirePaiementAttente } from '@/services/reprisePaiement';
import { CreditsProvider } from '@/session/CreditsProvider';
import { NotificationsProvider } from '@/session/NotificationsProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { mouvement } from '@/theme/theme';
import { useRepriseInviteEnCours } from '@/services/repriseInvite';
import { finirRetourOAuthWebUneFois } from '@/services/retourOAuthWeb';
import { getSupabase } from '@/services/supabase';

const debutDemarrage = Date.now();
let demarrageMesure = false;

SplashScreen.preventAutoHideAsync().catch(() => {});
initAnalytics();
installerHandlerGlobal();

/** Web : retour d'une connexion Google en page entière (voir retourOAuthWeb). */
function useRetourOAuthWeb() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void finirRetourOAuthWebUneFois(getSupabase()).then((r) => {
      if (r === 'rien') return;
      // Adresse nettoyée : le code ne doit pas rester dans l'historique ni être rejoué au rechargement.
      globalThis.history?.replaceState(null, '', globalThis.location.pathname === '/auth/callback' ? '/' : globalThis.location.pathname);
      router.replace(r === 'session' ? '/moi' : '/compte/connexion');
    });
  }, [router]);
}

function Navigation() {
  const { theme } = useTheme();
  const { statut } = useSession();
  const repriseEnCours = useRepriseInviteEnCours();
  const pathname = usePathname();
  const router = useRouter();
  const reduit = useReduireAnimations();
  useOuvertureRecapAuto();
  useDemandeSupportAuto();
  useRetourOAuthWeb();

  // Pages vues : nom de la route (sans paramètres), avec l'écran précédent.
  const segments = useSegments();
  const nomCourant = nomEcran(segments);
  const ecranPrecedent = useRef<string | null>(null);
  useEffect(() => {
    if (nomCourant === ecranPrecedent.current) return;
    suivreEcran(nomCourant, ecranPrecedent.current);
    ecranPrecedent.current = nomCourant;
  }, [nomCourant]);

  useEffect(() => {
    if (statut === 'pret' && repriseEnCours && pathname !== '/compte/reprise') {
      router.replace('/compte/reprise');
    }
  }, [pathname, repriseEnCours, router, statut]);

  useEffect(() => {
    if (statut !== 'pret' || repriseEnCours) return;

    const verifier = () => {
      lirePaiementAttente().then((p) => {
        if (p) {
          router.navigate({ pathname: '/offres/payer', params: { reprise: p.commande, offre: p.offre } });
        }
      });
    };

    verifier();

    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') verifier();
    });
    return () => sub.remove();
  }, [statut, repriseEnCours, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }}>
        {/* « Ma semaine » glisse depuis le bas (300 ms), sans animation si « Réduire les animations ». */}
        <Stack.Screen name="ma-semaine" options={{ animation: reduit ? 'none' : 'slide_from_bottom', animationDuration: mouvement.feuille, gestureEnabled: false }} />
      </Stack>
      {/* Après la pile : les bandes de la variante « vert » passent au-dessus des écrans. */}
      <BarresSysteme />
    </>
  );
}

export default function RootLayout() {
  const [pretes, erreur] = useFonts({
    ArchivoBlack: require('../../assets/fonts/ArchivoBlack.ttf'),
    'SpaceGrotesk-Regular': require('../../assets/fonts/SpaceGrotesk-Regular.ttf'),
    'SpaceGrotesk-Medium': require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
    'SpaceGrotesk-Bold': require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
    'SpaceMono-Regular': require('../../assets/fonts/SpaceMono-Regular.ttf'),
    'SpaceMono-Bold': require('../../assets/fonts/SpaceMono-Bold.ttf'),
  });

  const [delaiDepasse, setDelaiDepasse] = useState(false);

  useEffect(() => {
    const min = setTimeout(() => setDelaiDepasse(true), 1500);
    return () => clearTimeout(min);
  }, []);

  useEffect(() => {
    suivre('app_opened', { plateforme: Platform.OS });
  }, []);

  useEffect(() => {
    // Langue choisie à la main, préférences de retours et sons préchargés (jamais bloquant).
    void restaurerLangue();
    void precharger();
    const arreterNotifications = suivreOuvertures();
    const arreterLiens = ecouterLiensParrainage();
    // Observation du réseau : la garde des actions serveur et l'indicateur en dépendent (issue #25).
    const arreterReseau = demarrerConnectivite();
    // Suivi : propriétés de la personne, premier lancement, coupures réseau, envoi de la file hors ligne.
    const arreterSuivi = demarrerSuivi();
    return () => {
      arreterSuivi();
      arreterNotifications();
      arreterLiens?.();
      arreterReseau();
    };
  }, []);

  const pret = pretes || erreur !== null || delaiDepasse;

  useEffect(() => {
    if (pret) {
      SplashScreen.hideAsync().catch(() => {});
      // Cold start (issue #14) : du chargement du module jusqu'à l'écran prêt. Une seule mesure par lancement.
      if (!demarrageMesure) {
        demarrageMesure = true;
        suivre('app_cold_start', { duration_ms: Date.now() - debutDemarrage });
      }
    }
  }, [pret]);

  if (!pret) return null;

  return (
    <GestureHandlerRootView style={styles.racine}>
      <ThemeProvider>
        <ToastProvider>
          <ErrorBoundary>
            <SessionProvider>
              <CreditsProvider>
                <NotificationsProvider>
                  <VisiteProvider>
                    <BottomSheetModalProvider>
                      <BandeauApplication />
                      <Navigation />
                    </BottomSheetModalProvider>
                    <BienvenueCredits />
                    <ToastRechargeCredits />
                    <ToastGainXp />
                    <BienvenuePass />
                    <MiseAJour />
                    <GardeAppareilActif />
                  </VisiteProvider>
                </NotificationsProvider>
              </CreditsProvider>
            </SessionProvider>
          </ErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
