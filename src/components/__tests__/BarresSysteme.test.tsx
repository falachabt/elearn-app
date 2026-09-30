import { render } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';
import { Appearance } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { themes } from '@/theme/theme';

import { BarresSysteme } from '../BarresSysteme';

jest.mock('expo-status-bar', () => ({ StatusBar: ({ style }: { style: string }) => { mockStyle = style; return null; } }));
let mockStyle = '';
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(() => Promise.resolve()) }));

describe('BarresSysteme', () => {
  beforeEach(() => jest.clearAllMocks());

  it('thème clair : icônes sombres, fond racine du thème clair', async () => {
    await render(<ThemeProvider reglage="clair"><BarresSysteme /></ThemeProvider>);
    expect(mockStyle).toBe('dark');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(themes.light.fond.app);
  });

  it('thème sombre : icônes claires, fond racine du thème sombre', async () => {
    await render(<ThemeProvider reglage="sombre"><BarresSysteme /></ThemeProvider>);
    expect(mockStyle).toBe('light');
    expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith(themes.dark.fond.app);
  });

  it('réglage manuel : aligne le mode nuit du système ; « système » le libère', async () => {
    const espion = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    await render(<ThemeProvider reglage="sombre"><BarresSysteme /></ThemeProvider>);
    expect(espion).toHaveBeenLastCalledWith('dark');
    await render(<ThemeProvider reglage="systeme"><BarresSysteme /></ThemeProvider>);
    expect(espion).toHaveBeenLastCalledWith('unspecified');
    // Régression : le natif Android plante si on lui passe null.
    expect(espion).not.toHaveBeenCalledWith(null);
  });
});
