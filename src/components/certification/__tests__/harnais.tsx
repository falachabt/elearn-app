import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };

/** Monte un écran dans le thème choisi (clair par défaut), comme l'app. */
export const monter = (ui: ReactElement, reglage: 'clair' | 'sombre' = 'clair') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

export const attendre = (ms = 30) => new Promise((r) => setTimeout(r, ms));
