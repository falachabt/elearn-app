import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/theme';

/**
 * Couleurs des barres système : vert Elearn (validé par Benny le 30/09/2026).
 * Émeraude 500 et icônes noires en clair (texte toujours noir sur l'émeraude) ; en sombre, émeraude 700 et icônes
 * blanches, parce qu'Android dessine les boutons de navigation en blanc quand le mode nuit est actif.
 */
export function couleursBarres(theme: Theme, sombre: boolean): { fond: string; icones: 'light' | 'dark' } {
  return { fond: theme.barreVert, icones: sombre ? 'light' : 'dark' };
}

/**
 * Barre d'état et barre de navigation système en vert Elearn.
 * - Android edge-to-edge (SDK 57) : les deux barres sont transparentes et l'app dessine dessous. Deux bandes
 *   émeraude sont posées par-dessus les écrans, à la hauteur des insets (haut partout, bas sur Android seulement :
 *   sur iOS la barre du bas n'est qu'un trait). Le fond racine (expo-system-ui) prend la même couleur.
 * - Les écrans (`Ecran`) posent leurs insets sur un cadre fixe : rien ne défile sous ces bandes.
 * - Les icônes de la barre de navigation suivent le mode nuit de l'appli : `ThemeProvider` l'aligne sur le thème
 *   (Appearance.setColorScheme) quand le réglage n'est pas « Système ».
 */
export function BarresSysteme() {
  const { theme, sombre } = useTheme();
  const insets = useSafeAreaInsets();
  const { fond, icones } = couleursBarres(theme, sombre);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(fond).catch(() => {});
  }, [fond]);

  return (
    <>
      <StatusBar style={icones} />
      <View testID="bande-haut" pointerEvents="none" style={[styles.bande, { top: 0, height: insets.top, backgroundColor: fond }]} />
      {Platform.OS === 'android' && insets.bottom > 0 ? (
        <View testID="bande-bas" pointerEvents="none" style={[styles.bande, { bottom: 0, height: insets.bottom, backgroundColor: fond }]} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ bande: { position: 'absolute', left: 0, right: 0, zIndex: 1000, elevation: 1000 } });
