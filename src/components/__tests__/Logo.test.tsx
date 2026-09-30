import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { changerLangue } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Logo } from '../Logo';

const image = () => screen.getByLabelText('Logo Elearn Prepa');
const source = () => image().props.source;
const style = () => StyleSheet.flatten(image().props.style);

afterEach(async () => {
  await act(() => changerLangue('fr'));
});

describe('Logo', () => {
  it('prend la version noire en clair et la blanche en sombre', async () => {
    await render(<ThemeProvider reglage="clair"><Logo /></ThemeProvider>);
    const clair = source();
    await screen.unmount();
    await render(<ThemeProvider reglage="sombre"><Logo /></ThemeProvider>);
    expect(source()).not.toEqual(clair);
  });

  it('respecte les proportions et la taille minimale', async () => {
    await render(<ThemeProvider><Logo hauteur={10} /></ThemeProvider>);
    expect(style()).toMatchObject({ width: Math.round(24 * (893 / 333)), height: 24 });
  });

  it('le symbole est carré', async () => {
    await render(<ThemeProvider><Logo variante="symbole" hauteur={48} /></ThemeProvider>);
    expect(style()).toMatchObject({ width: 48, height: 48 });
  });

  it('a un libellé d’accessibilité traduit', async () => {
    await render(<ThemeProvider><Logo /></ThemeProvider>);
    expect(screen.getByLabelText('Logo Elearn Prepa')).toBeTruthy();
    await act(() => changerLangue('en'));
    expect(screen.getByLabelText('Elearn Prepa logo')).toBeTruthy();
  });
});
