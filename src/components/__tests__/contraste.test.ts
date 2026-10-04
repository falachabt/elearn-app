import { couleursBouton, type Variante } from '../Bouton';
import { themes, type Theme } from '@/theme/theme';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs #RRGGBB. */
function contraste(a: string, b: string) {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
}

const variantes: Variante[] = ['primaire', 'secondaire', 'accent', 'danger', 'texte'];

describe.each(Object.entries(themes) as [string, Theme][])('contraste des boutons (%s)', (_nom, theme) => {
  it.each(variantes)('%s : texte / fond >= 4.5', (variante) => {
    const { fond, texte } = couleursBouton(theme, variante);
    // Variante « texte » : fond transparent, donc celui de l'écran ou de la surface.
    const fonds = fond === 'transparent' ? [theme.fond.app, theme.fond.surface] : [fond];
    for (const f of fonds) expect(contraste(texte, f)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(variantes)('%s désactivé : texte / fond >= 4.5', (variante) => {
    const { fond, texte } = couleursBouton(theme, variante, true);
    expect(contraste(texte, fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('secondaire : bord fort distinct du fond (néo-brutal), bord et ombre présents', () => {
    const c = couleursBouton(theme, 'secondaire');
    expect(contraste(c.bord, c.fond)).toBeGreaterThanOrEqual(3);
    expect(c.ombre).toBe(theme.ombre);
  });
});
