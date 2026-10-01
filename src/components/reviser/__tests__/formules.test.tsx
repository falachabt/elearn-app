import { act, render, screen } from '@testing-library/react-native';

import type { Bloc } from '@/services/blocs';
import { definirRenduFormules } from '@/services/formules';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Blocs } from '../Blocs';

const blocs: Bloc[] = [
  {
    type: 'paragraphe',
    retrait: 0,
    segments: [
      { texte: 'On a ' },
      { texte: '(a)/(b)', math: true, latex: '\\frac{a}{b}' },
      { texte: ' et ' },
      { texte: 'x²', math: true, latex: 'x^2' },
    ],
  },
];

const afficher = () => render(<ThemeProvider><Blocs blocs={blocs} /></ThemeProvider>);

describe('Blocs et formules dessinées', () => {
  it('réglage désactivé : formules en texte', async () => {
    await act(() => definirRenduFormules(false));
    await afficher();
    expect(screen.queryByLabelText('(a)/(b)')).toBeNull();
    expect(screen.getByText(/\(a\)\/\(b\)/)).toBeTruthy();
  });

  it('réglage activé : seule la formule complexe est dessinée, dans la ligne', async () => {
    await act(() => definirRenduFormules(true));
    await afficher();
    expect(screen.getByLabelText('(a)/(b)')).toBeTruthy();
    expect(screen.queryByLabelText('x²')).toBeNull();
    expect(screen.getByText(/x²/)).toBeTruthy();
  });
});
