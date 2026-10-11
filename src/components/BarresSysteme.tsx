import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contenuExpire, ecouterExpiration } from '@/services/expiration';

import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/theme';

import { useReseau } from './reseau/useReseau';

/**
 * Couleurs des barres système : vert Elearn (validé par Benny le 30/09/2026).
 * Émeraude 500 et icônes noires en clair (texte toujours noir sur l'émeraude) ; en sombre, émeraude 700 et icônes
 * blanches, parce qu'Android dessine les boutons de navigation en blanc quand le mode nuit est actif.
 */
export type EtatBarres = 'enLigne' | 'horsLigne' | 'expire';

/** Luminance relative d'une couleur `#RRGGBB` (WCAG), pour choisir des icônes lisibles sur n'importe quel fond. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * En ligne : vert Elearn. Hors ligne : les couleurs de la pastille hors ligne (orange, ou corail quand le contenu hors
 * ligne a expiré), pour que l'état se voie même quand l'élève ne regarde pas la pastille.
 */
export function couleursBarres(theme: Theme, sombre: boolean, etat: EtatBarres = 'enLigne'): { fond: string; icones: 'light' | 'dark' } {
  if (etat === 'enLigne') return { fond: theme.barreVert, icones: sombre ? 'light' : 'dark' };
  const fond = etat === 'expire' ? theme.etat.erreur : theme.etat.alerte;
  // Icônes noires ou blanches, selon ce qui contraste le plus avec la couleur d'alerte.
  const l = luminance(fond);
  return { fond, icones: (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? 'dark' : 'light' };
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
  const { estEnLigne } = useReseau();
  const expire = useSyncExternalStore(ecouterExpiration, contenuExpire, contenuExpire);
  const { fond, icones } = couleursBarres(theme, sombre, estEnLigne ? 'enLigne' : expire ? 'expire' : 'horsLigne');

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
