import {
  anglePendule,
  blocsReponseDemo,
  echantillonsFonction,
  expressionFonction,
  formaterDecimal,
  frequencePendule,
  oscillationsParMinute,
  periodePendule,
  sommetFonction,
  valeurFonction,
} from '../laboChat';

describe('laboChat — pendule', () => {
  it('période pour L = 1 m et g = 9,8 : environ 2,01 s (valeur de la capture de référence)', () => {
    expect(periodePendule(1, 9.8)).toBeCloseTo(2.007, 3);
    expect(formaterDecimal(periodePendule(1, 9.8))).toBe('2,01');
  });

  it('fréquence et oscillations par minute cohérentes avec la période', () => {
    expect(frequencePendule(1, 9.8)).toBeCloseTo(0.498, 3);
    expect(oscillationsParMinute(1, 9.8)).toBeCloseTo(29.9, 1);
  });

  it('la période augmente avec la longueur et diminue avec la pesanteur', () => {
    expect(periodePendule(2, 9.8)).toBeGreaterThan(periodePendule(1, 9.8));
    expect(periodePendule(1, 20)).toBeLessThan(periodePendule(1, 9.8));
  });

  it('angle : amplitude au départ, opposée à la demi-période, nulle au quart', () => {
    const t = periodePendule(1, 9.8);
    expect(anglePendule(30, 0, t)).toBeCloseTo(30, 6);
    expect(anglePendule(30, t / 2, t)).toBeCloseTo(-30, 6);
    expect(anglePendule(30, t / 4, t)).toBeCloseTo(0, 6);
  });
});

describe('laboChat — fonction', () => {
  it('sommet de f(x) = 2x² + 3x + 4 : (−0,75 ; 2,875), comme la méthode de la capture de référence', () => {
    expect(sommetFonction(2, 3, 4)).toEqual({ x: -0.75, y: 2.875 });
  });

  it('pas de sommet si a = 0', () => {
    expect(sommetFonction(0, 3, 4)).toBeNull();
  });

  it('valeurs et échantillons', () => {
    expect(valeurFonction(2, 3, 4, 0)).toBe(4);
    expect(valeurFonction(2, 3, 4, -4)).toBe(24);
    const pts = echantillonsFonction(2, 3, 4, -4, 3, 0.05);
    expect(pts[0]).toEqual({ x: -4, y: 24 });
    expect(pts[pts.length - 1].x).toBeCloseTo(3, 6);
    expect(pts.length).toBe(141);
  });

  it('expression lisible de la fonction', () => {
    expect(expressionFonction(2, 3, 4)).toBe('f(x) = 2x² + 3x + 4');
    expect(expressionFonction(1, 0, -4)).toBe('f(x) = x² − 4');
    expect(expressionFonction(0, 0, 0)).toBe('f(x) = 0');
  });
});

describe('laboChat — format et réponses de démonstration', () => {
  it('format français : virgule et moins typographique', () => {
    expect(formaterDecimal(2.0063)).toBe('2,01');
    expect(formaterDecimal(-0.75)).toBe('−0,75');
    expect(formaterDecimal(2.875, 3)).toBe('2,875');
  });

  it('la démo pendule contient un bloc pendule entouré de texte', () => {
    const blocs = blocsReponseDemo('pendule');
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'pendule', 'texte']);
  });

  it('la démo photo seule reste une correction structurée (parcours actuel, aucun bloc interactif)', () => {
    const blocs = blocsReponseDemo('photoSeule');
    expect(blocs.every((b) => b.type === 'texte')).toBe(true);
    expect(blocs.map((b) => (b.type === 'texte' ? b.texte : '')).join(' ')).toContain('À retenir');
  });

  it('la démo photo répond au pendule reconnu par le bloc interactif pendule', () => {
    const blocs = blocsReponseDemo('photo');
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'pendule', 'texte']);
  });

  it('la démo fonction contient le graphe de 2x² + 3x + 4', () => {
    const blocs = blocsReponseDemo('fonction');
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'fonction', 'texte']);
    const graphe = blocs[1];
    expect(graphe.type === 'fonction' && [graphe.a, graphe.b, graphe.c]).toEqual([2, 3, 4]);
  });
});
