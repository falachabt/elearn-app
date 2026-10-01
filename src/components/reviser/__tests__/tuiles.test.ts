import { matiere, matiereSecours } from '@/theme/theme';

import { couleursTuiles } from '../Reviser';

const m = (nom: string, couleur?: keyof typeof matiere) => ({ nom, couleur, cours: [] }) as never;

describe('couleurs des tuiles (revue design)', () => {
  it('couleur de la matière, sinon secours différent de la voisine, jamais blanc', () => {
    const c = couleursTuiles([m('Maths', 'maths'), m('Informatique'), m('Géographie'), m('Musique'), m('Dessin'), m('Couture')]);
    expect(c[0]).toBe(matiere.maths);
    expect(c.slice(1).every((x) => (matiereSecours as readonly string[]).includes(x))).toBe(true);
    for (let i = 1; i < c.length; i += 2) expect(c[i]).not.toBe(c[i - 1]);
    expect(c).not.toContain('#FFFFFF');
  });

  it('saute la couleur de secours égale à la voisine', () => {
    const c = couleursTuiles([m('Philo', 'philo'), m('Informatique')]);
    expect(matiere.philo).toBe(matiereSecours[0]);
    expect(c[1]).toBe(matiereSecours[1]);
  });
});
