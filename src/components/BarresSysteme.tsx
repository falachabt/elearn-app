import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Barre d'état et barre de navigation système aux couleurs du thème.
 * - Icônes de la barre d'état : claires en sombre, sombres en clair (`style` d'expo-status-bar).
 * - Android edge-to-edge (SDK 57) : les deux barres sont transparentes et l'app dessine dessous ; la couleur vue
 *   derrière la barre de navigation est celle du fond racine, posée ici via expo-system-ui, et les écrans
 *   (`Ecran`, barre d'onglets) la prolongent avec l'inset du bas.
 * - Les icônes de la barre de navigation suivent le mode nuit de l'appli : `ThemeProvider` l'aligne sur le thème
 *   (Appearance.setColorScheme) quand le réglage n'est pas « Système ».
 */
export function BarresSysteme() {
  const { theme, sombre } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.fond.app).catch(() => {});
  }, [theme.fond.app]);

  return <StatusBar style={sombre ? 'light' : 'dark'} />;
}
