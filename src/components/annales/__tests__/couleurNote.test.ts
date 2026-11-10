import { couleurNiveauNote } from '../travail/couleurNote';
import { themes } from '@/theme/theme';

const { light, dark } = themes;

describe('couleur de la carte de note', () => {
  it.each([['clair', light], ['sombre', dark]])('%s : vert, jaune, orange sous 40 %%, rouge sous 20 %%', (_nom, theme) => {
    expect(couleurNiveauNote(theme, 'bonne')).toBe(theme.marque.principale);
    expect(couleurNiveauNote(theme, 'moyenne')).toBe(theme.accent.soleil);
    expect(couleurNiveauNote(theme, 'faible')).toBe(theme.etat.alerte);
    expect(couleurNiveauNote(theme, 'critique')).toBe(theme.etat.erreur);
    expect(theme.etat.alerte).not.toBe(theme.etat.erreur);
  });
});
