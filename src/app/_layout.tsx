import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BarresSysteme } from '@/components/BarresSysteme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MiseAJour } from '@/components/MiseAJour';
import { VisiteProvider } from '@/components/Visite';
import { restaurerLangue } from '@/i18n';
import { precharger } from '@/services/retours';
import { initAnalytics, suivre } from '@/services/analytics';
import { installerHandlerGlobal } from '@/services/erreurs';
import { SessionProvider } from '@/session/SessionProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
initAnalytics();
installerHandlerGlobal();

function Navigation() {
  const { theme } = useTheme();
  return (
    <>
      <BarresSysteme />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }} />
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

  useEffect(() => {
    suivre('app_opened', { plateforme: Platform.OS });
  }, []);

  useEffect(() => {
    // Langue choisie à la main, préférences de retours et sons préchargés (jamais bloquant).
    void restaurerLangue();
    void precharger();
  }, []);

  useEffect(() => {
    if (pretes || erreur) SplashScreen.hideAsync();
  }, [pretes, erreur]);

  if (!pretes && !erreur) return null;

  return (
    <GestureHandlerRootView style={styles.racine}>
      <ThemeProvider>
        <ErrorBoundary>
          <SessionProvider>
            <VisiteProvider>
              <Navigation />
              <MiseAJour />
            </VisiteProvider>
          </SessionProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
