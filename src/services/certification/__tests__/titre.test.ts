import { titreAffiche } from '../titre';

describe('titreAffiche', () => {
  it('retire « (démo) » en fin de titre, sans toucher au reste', () => {
    expect(titreAffiche('Décrire une photo (démo)')).toBe('Décrire une photo');
    expect(titreAffiche('Comprendre un exposé (DÉMO)')).toBe('Comprendre un exposé');
  });

  it('laisse intact un titre sans suffixe démo', () => {
    expect(titreAffiche('Phrases à compléter')).toBe('Phrases à compléter');
    expect(titreAffiche('Démo de la règle')).toBe('Démo de la règle');
  });
});
