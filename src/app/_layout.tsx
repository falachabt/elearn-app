import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BarresSysteme } from '@/components/BarresSysteme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BienvenueCredits } from '@/components/credits/BienvenueCredits';
import { BienvenuePass } from '@/components/pass/BienvenuePass';
import { MiseAJour } from '@/components/MiseAJour';
import { VisiteProvider } from '@/components/Visite';
import { restaurerLangue } from '@/i18n';
import { ecouterLiensParrainage } from '@/services/lienProfond';
import { precharger } from '@/services/retours';
import { suivreOuvertures } from '@/services/rappels';
import { initAnalytics, suivre } from '@/services/analytics';
import { installerHandlerGlobal } from '@/services/erreurs';
import { lirePaiementAttente } from '@/services/reprisePaiement';
import { CreditsProvider } from '@/session/CreditsProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useRepriseInviteEnCours } from '@/services/repriseInvite';

SplashScreen.preventAutoHideAsync().catch(() => {});
initAnalytics();
installerHandlerGlobal();

function Navigation() {
  const { theme } = useTheme();
  const { statut } = useSession();
  const repriseEnCours = useRepriseInviteEnCours();
  const pathname = usePathname();
  const router = useRouter();

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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }} />
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
    return () => {
      arreterNotifications();
      arreterLiens?.();
    };
  }, []);

  const pret = pretes || erreur !== null || delaiDepasse;

  useEffect(() => {
    if (pret) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [pret]);

  if (!pret) return null;

  return (
    <GestureHandlerRootView style={styles.racine}>
      <ThemeProvider>
        <ErrorBoundary>
          <SessionProvider>
            <CreditsProvider>
              <VisiteProvider>
                <BottomSheetModalProvider>
                  <Navigation />
                </BottomSheetModalProvider>
                <BienvenueCredits />
                <BienvenuePass />
                <MiseAJour />
              </VisiteProvider>
            </CreditsProvider>
          </SessionProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
