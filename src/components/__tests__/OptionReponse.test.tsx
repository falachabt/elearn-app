import { render, screen } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { themes } from '@/theme/theme';

import { OptionReponse } from '../OptionReponse';

const monter = (etat: 'neutre' | 'bonne' | 'fausse') => render(<ThemeProvider reglage="clair"><OptionReponse lettre="B" texte="Deux" etat={etat} /></ThemeProvider>);

describe('OptionReponse', () => {
  it('option correcte : coche claire dans une pastille vert foncé, sans libellé « Bonne réponse » visible', async () => {
    const { getByTestId } = await monter('bonne');
    const marque = StyleSheet.flatten(getByTestId('marque-bonne').props.style);
    expect(marque.backgroundColor).toBe(themes.light.etat.succesPlein);
    expect(screen.queryByText(/bonne réponse/i)).toBeNull();
  });

  it('shows the letter before correction', async () => {
    await monter('neutre');
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByTestId('marque-bonne')).toBeNull();
  });

  it.each([
    ['bonne', 'Deux. Bonne réponse'],
    ['fausse', 'Deux. Erreur'],
  ] as const)('replaces the letter with the %s mark on the left', async (etat, libelle) => {
    await monter(etat);
    expect(screen.queryByText('B')).toBeNull();
    expect(screen.getByTestId(`marque-${etat}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: libelle })).toBeTruthy();
  });
});
