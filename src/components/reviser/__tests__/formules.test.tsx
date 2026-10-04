import { act, render, screen } from '@testing-library/react-native';

import type { Bloc } from '@/services/blocs';
import { definirRenduFormules } from '@/services/formules';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { corrige } from '@/theme/theme';

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

describe('formules hautes ou larges', () => {
  const haute: Bloc[] = [
    {
      type: 'paragraphe',
      retrait: 0,
      segments: [
        { texte: 'Le triplet ' },
        { texte: '(2/3 ; 4/3)', math: true, latex: '\\left(\\frac{\\frac{2}{3}}{\\frac{4}{3}}\\right)' },
        { texte: ' est solution.' },
      ],
    },
  ];
  const longue = `\\frac{a}{b}${' + a_{1}'.repeat(60)}`;
  const large: Bloc[] = [{ type: 'paragraphe', retrait: 0, segments: [{ texte: 'Somme ' }, { texte: 'système', math: true, latex: longue }] }];

  it('une formule plus haute que la ligne passe en flux : les mots restent là, avec la formule', async () => {
    await act(() => definirRenduFormules(true));
    await render(<ThemeProvider><Blocs blocs={haute} /></ThemeProvider>);
    expect(screen.getByLabelText('(2/3 ; 4/3)')).toBeTruthy();
    expect(screen.getByText('triplet')).toBeTruthy();
    expect(screen.getByText('solution.')).toBeTruthy();
  });

  it('une formule plus large que l’écran passe à la ligne par morceaux, sans défilement', async () => {
    await act(() => definirRenduFormules(true));
    const r = await render(<ThemeProvider><Blocs blocs={large} /></ThemeProvider>);
    expect(r.getByLabelText('système')).toBeTruthy();
    expect(r.queryByTestId('formule-defilante')).toBeNull();
    expect(r.getAllByTestId('formule-morceau').length).toBeGreaterThan(5);
  });

  it('les lignes d’un système (\\\\) sont dessinées une par ligne', async () => {
    await act(() => definirRenduFormules(true));
    const systeme: Bloc[] = [{ type: 'paragraphe', retrait: 0, segments: [{ texte: 'a x + b y = c \\ d x + e y = f', math: true, latex: '\\frac{a}{b} x + y = 1 \\\\ \\frac{c}{d} x - y = 3' }] }];
    const r = await render(<ThemeProvider><Blocs blocs={systeme} /></ThemeProvider>);
    expect(r.getAllByTestId('formule-morceau').length).toBeGreaterThanOrEqual(4);
  });
});

describe('corrigé en jaune doux', () => {
  it('formules en bleu du thème clair, texte en encre', async () => {
    await act(() => definirRenduFormules(false));
    const r = await render(<ThemeProvider reglage="clair"><Blocs blocs={blocs} surJaune /></ThemeProvider>);
    expect(r.getByText('x²')).toHaveStyle({ color: corrige.light.formule });
  });

  it('formules en bleu clair en sombre', async () => {
    const r = await render(<ThemeProvider reglage="sombre"><Blocs blocs={blocs} surJaune /></ThemeProvider>);
    expect(r.getByText('x²')).toHaveStyle({ color: corrige.dark.formule });
  });
});
