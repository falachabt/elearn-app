import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chargerVarianteBarres, useVarianteBarres, type VarianteBarres } from '@/services/barres';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/theme';

/**
 * Couleurs des barres système pour une variante.
 * - `theme` : fond de l'écran ; icônes sombres en clair, claires en sombre.
 * - `vert` : émeraude 500 et icônes noires en clair (texte toujours noir sur l'émeraude) ; en sombre, émeraude 700
 *   et icônes blanches, parce qu'Android dessine les boutons de navigation en blanc quand le mode nuit est actif.
 */
export function couleursBarres(theme: Theme, sombre: boolean, variante: VarianteBarres): { fond: string; icones: 'light' | 'dark' } {
  if (variante === 'vert') return { fond: theme.barreVert, icones: sombre ? 'light' : 'dark' };
  return { fond: theme.fond.app, icones: sombre ? 'light' : 'dark' };
}

/**
 * Barre d'état et barre de navigation système aux couleurs du thème.
 * - Android edge-to-edge (SDK 57) : les deux barres sont transparentes et l'app dessine dessous ; la couleur vue
 *   derrière la barre de navigation est celle du fond racine, posée ici via expo-system-ui, et les écrans
 *   (`Ecran`, barre d'onglets) la prolongent avec l'inset du bas.
 * - Variante `vert` : deux bandes émeraude posées par-dessus les écrans, à la hauteur des insets (haut partout,
 *   bas sur Android seulement : sur iOS la barre du bas n'est qu'un trait).
 * - Les icônes de la barre de navigation suivent le mode nuit de l'appli : `ThemeProvider` l'aligne sur le thème
 *   (Appearance.setColorScheme) quand le réglage n'est pas « Système ».
 */
export function BarresSysteme() {
  const { theme, sombre } = useTheme();
  const variante = useVarianteBarres();
  const insets = useSafeAreaInsets();
  const { fond, icones } = couleursBarres(theme, sombre, variante);

  useEffect(() => {
    chargerVarianteBarres().catch(() => {});
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(fond).catch(() => {});
  }, [fond]);

  return (
    <>
      <StatusBar style={icones} />
      {variante === 'vert' ? (
        <>
          <View testID="bande-haut" pointerEvents="none" style={[styles.bande, { top: 0, height: insets.top, backgroundColor: fond }]} />
          {Platform.OS === 'android' && insets.bottom > 0 ? (
            <View testID="bande-bas" pointerEvents="none" style={[styles.bande, { bottom: 0, height: insets.bottom, backgroundColor: fond }]} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ bande: { position: 'absolute', left: 0, right: 0, zIndex: 1000, elevation: 1000 } });
