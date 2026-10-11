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

describe.each(Object.entries(themes) as [string, Theme][])('contraste des jetons et des boutons (%s)', (_nom, theme) => {
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

  /**
   * Jetons de fond et couleur de texte associée. `texte.surCouleur` est l'encre noire posée sur un APLAT VIF
   * (émeraude, jaune soleil, corail…) : ces aplats ne changent pas entre les thèmes, l'encre noire y reste lisible.
   */
  const aplatsVifs: [string, string][] = [
    ['marque.principale', theme.marque.principale],
    ['accent.soleil', theme.accent.soleil],
    ['etat.succes', theme.etat.succes],
    ['etat.alerte', theme.etat.alerte],
    ['etat.erreur', theme.etat.erreur],
    ['etat.info', theme.etat.info],
  ];

  it.each(aplatsVifs)('texte.surCouleur sur aplat vif %s : >= 4.5', (_nom, fond) => {
    expect(contraste(theme.texte.surCouleur, fond)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Surfaces du thème (elles deviennent sombres en mode sombre) : c'est `texte.principal` qui suit le thème.
   * Utiliser `texte.surCouleur` (noir dans les deux thèmes) sur l'une d'elles casse le mode sombre.
   */
  const surfaces: [string, string][] = [
    ['fond.app', theme.fond.app],
    ['fond.surface', theme.fond.surface],
    ['fond.creux', theme.fond.creux],
    ['bord.doux', theme.bord.doux],
    ['marque.douce', theme.marque.douce],
    ['accent.soleilDoux', theme.accent.soleilDoux],
    ['etat.succesDoux', theme.etat.succesDoux],
    ['etat.alerteDoux', theme.etat.alerteDoux],
    ['etat.erreurDoux', theme.etat.erreurDoux],
    ['etat.infoDoux', theme.etat.infoDoux],
  ];

  it.each(surfaces)('texte.principal sur surface %s : >= 4.5', (_nom, fond) => {
    expect(contraste(theme.texte.principal, fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('marque.forte (couleur de marque en premier plan) : >= 4.5 sur la surface et sur le fond de l’app', () => {
    expect(contraste(theme.marque.forte, theme.fond.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(theme.marque.forte, theme.fond.app)).toBeGreaterThanOrEqual(4.5);
  });

  it('fond.inverse et texte.inverse : la paire reste lisible', () => {
    expect(contraste(theme.texte.inverse, theme.fond.inverse)).toBeGreaterThanOrEqual(4.5);
  });

  it('bord.fort : >= 3 sur la surface et sur le fond de l’app (bordure néo-brutale visible)', () => {
    expect(contraste(theme.bord.fort, theme.fond.surface)).toBeGreaterThanOrEqual(3);
    expect(contraste(theme.bord.fort, theme.fond.app)).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Garde-fou du mode sombre : `texte.surCouleur` est l'encre noire des aplats vifs, elle ne suit pas le thème.
 * Sur une surface (qui devient sombre en mode sombre), elle est illisible : c'est `texte.principal` qu'il faut.
 * Ce test décrit le piège exact qui a cassé la carte « Mon code » du parrainage et l'icône des récompenses.
 */
describe('mode sombre : encre des aplats vifs interdite sur une surface', () => {
  const surfaces: [string, string][] = [
    ['fond.app', themes.dark.fond.app],
    ['fond.surface', themes.dark.fond.surface],
    ['fond.creux', themes.dark.fond.creux],
    ['bord.doux', themes.dark.bord.doux],
    ['marque.douce', themes.dark.marque.douce],
    ['accent.soleilDoux', themes.dark.accent.soleilDoux],
    ['etat.succesDoux', themes.dark.etat.succesDoux],
    ['etat.alerteDoux', themes.dark.etat.alerteDoux],
    ['etat.erreurDoux', themes.dark.etat.erreurDoux],
    ['etat.infoDoux', themes.dark.etat.infoDoux],
  ];

  it.each(surfaces)('texte.surCouleur sur %s : < 4.5 (utiliser texte.principal)', (_nom, fond) => {
    expect(contraste(themes.dark.texte.surCouleur, fond)).toBeLessThan(4.5);
  });
});
