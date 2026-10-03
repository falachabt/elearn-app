import { render, screen } from '@testing-library/react-native';

import type { Bloc } from '@/services/blocs';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { apercuContexte, ContexteRepliable } from '../ContexteRepliable';

const BLOCS: Bloc[] = [
  { type: 'separateur' },
  { type: 'titre', niveau: 2, segments: [{ texte: 'Système  linéaire' }] },
  { type: 'paragraphe', retrait: 0, segments: [{ texte: 'Un système de la forme ' }, { texte: 'x', math: true }] },
];

describe('apercuContexte', () => {
  it('prend le premier bloc qui a du texte, sur une ligne', () => {
    expect(apercuContexte(BLOCS)).toBe('Système linéaire');
    expect(apercuContexte([{ type: 'separateur' }])).toBe('');
  });
});

describe('ContexteRepliable', () => {
  it('replié par défaut : la ligne d’en-tête seule, pas le corps', async () => {
    await render(<ThemeProvider><ContexteRepliable blocs={BLOCS} /></ThemeProvider>);
    expect(screen.getByText('Système linéaire')).toBeTruthy();
    expect(screen.queryByText(/Un système de la forme/)).toBeNull();
  });
});
