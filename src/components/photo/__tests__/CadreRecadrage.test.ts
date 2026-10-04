import { CADRE_INITIAL, rectangleAffiche } from '../CadreRecadrage';

describe('rectangleAffiche', () => {
  it('centre une photo haute dans une zone large', () => {
    const r = rectangleAffiche({ largeur: 400, hauteur: 300 }, { largeur: 300, hauteur: 600 });
    expect(r).toEqual({ x: 125, y: 0, largeur: 150, hauteur: 300 });
  });
  it('remplit la largeur d’une photo large', () => {
    const r = rectangleAffiche({ largeur: 400, hauteur: 600 }, { largeur: 800, hauteur: 400 });
    expect(r).toEqual({ x: 0, y: 200, largeur: 400, hauteur: 200 });
  });
  it('cadre initial avec 8 % de marge', () => {
    expect(CADRE_INITIAL.x + CADRE_INITIAL.largeur).toBeCloseTo(0.92);
  });
});
