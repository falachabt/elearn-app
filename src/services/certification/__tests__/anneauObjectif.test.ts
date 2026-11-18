import { ECHELLE_ANNEAU, etatAnneau } from '../anneauObjectif';

describe('etatAnneau', () => {
  it('utilise une échelle de 990', () => {
    expect(ECHELLE_ANNEAU).toBe(990);
  });

  it('sous l’objectif : rouge, score rempli, tiret à la position de l’objectif', () => {
    const e = etatAnneau(640, 800);
    expect(e.atteint).toBe(false);
    expect(e.sansScore).toBe(false);
    expect(e.remplissage).toBeCloseTo(640 / 990);
    expect(e.tiret).toBeCloseTo(800 / 990);
  });

  it('au-dessus de l’objectif : vert et tiret au centre', () => {
    expect(etatAnneau(850, 800).atteint).toBe(true);
  });

  it('exactement à l’objectif : compté comme atteint (égalité comprise)', () => {
    expect(etatAnneau(800, 800).atteint).toBe(true);
  });

  it('sans score : aucun remplissage, pas atteint', () => {
    const e = etatAnneau(null, 800);
    expect(e).toEqual({ remplissage: 0, tiret: 800 / 990, atteint: false, sansScore: true });
  });

  it('borne le remplissage et le tiret entre 0 et 1', () => {
    expect(etatAnneau(1200, 1100).remplissage).toBe(1);
    expect(etatAnneau(-5, 0).remplissage).toBe(0);
    expect(etatAnneau(0, 1500).tiret).toBe(1);
  });
});
