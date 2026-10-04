import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { OptionReponse } from '../OptionReponse';

const monter = (etat: 'neutre' | 'bonne' | 'fausse') => render(<ThemeProvider reglage="clair"><OptionReponse lettre="B" texte="Deux" etat={etat} /></ThemeProvider>);

describe('OptionReponse', () => {
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
