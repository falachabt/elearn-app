import { act, render, screen } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';
import { Appearance, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { definirVarianteBarres } from '@/services/barres';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { themes, type Theme } from '@/theme/theme';

import { BarresSysteme, couleursBarres } from '../BarresSysteme';

jest.mock('expo-status-bar', () => ({ StatusBar: ({ style }: { style: string }) => { mockStyle = style; return null; } }));
let mockStyle = '';
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));

const metriques = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 48 } };
const rendre = (reglage: 'clair' | 'sombre' | 'systeme') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}><BarresSysteme /></ThemeProvider>
    </SafeAreaProvider>,
  );

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
};

describe('BarresSysteme', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await definirVarianteBarres('theme');
  });

  it('thème clair : icônes sombres, fond racine du thème clair', async () => {
    await rendre('clair');
    expect(mockStyle).toBe('dark');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(themes.light.fond.app);
    expect(screen.queryByTestId('bande-haut')).toBeNull();
  });

  it('thème sombre : icônes claires, fond racine du thème sombre', async () => {
    await rendre('sombre');
    expect(mockStyle).toBe('light');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(themes.dark.fond.app);
  });

  it('variante vert : bandes émeraude en haut et en bas (Android), fond racine vert', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    try {
      await definirVarianteBarres('vert');
      await rendre('clair');
      expect(mockStyle).toBe('dark');
      expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(themes.light.barreVert);
      expect(screen.getByTestId('bande-haut')).toHaveStyle({ height: 24, backgroundColor: themes.light.barreVert });
      expect(screen.getByTestId('bande-bas')).toHaveStyle({ height: 48, backgroundColor: themes.light.barreVert });
    } finally {
      Platform.OS = os;
    }
  });

  it('bascule sans redémarrer : le choix est appliqué tout de suite', async () => {
    await rendre('clair');
    expect(screen.queryByTestId('bande-haut')).toBeNull();
    await act(() => definirVarianteBarres('vert'));
    expect(screen.getByTestId('bande-haut')).toBeTruthy();
  });

  it('réglage manuel : aligne le mode nuit du système ; « système » le libère', async () => {
    const espion = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    await rendre('sombre');
    expect(espion).toHaveBeenLastCalledWith('dark');
    await rendre('systeme');
    expect(espion).toHaveBeenLastCalledWith('unspecified');
    // Régression : le natif Android plante si on lui passe null.
    expect(espion).not.toHaveBeenCalledWith(null);
  });
});

describe.each([['clair', themes.light, false], ['sombre', themes.dark, true]] as [string, Theme, boolean][])('contraste des icônes système (%s)', (_nom, theme, sombre) => {
  it.each(['theme', 'vert'] as const)('%s : icônes / fond >= 4.5', (variante) => {
    const { fond, icones } = couleursBarres(theme, sombre, variante);
    // Icônes Android : blanches ou quasi noires.
    const couleurIcones = icones === 'light' ? '#FFFFFF' : '#0A0A0A';
    expect(contraste(couleurIcones, fond)).toBeGreaterThanOrEqual(4.5);
  });
});
