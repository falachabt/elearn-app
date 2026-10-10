import { CODES_PAYS, drapeauPays, listerPays, nomPays } from '../pays';

describe('liste des pays du paiement', () => {
  it('est exhaustive et sans doublon : c’est elle qui permet de payer depuis n’importe où', () => {
    expect(CODES_PAYS.length).toBeGreaterThan(200);
    expect(new Set(CODES_PAYS).size).toBe(CODES_PAYS.length);
    expect(CODES_PAYS.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    // Pays hors zone Mobile Money : c'est là que Chariow prend le relais.
    expect(CODES_PAYS).toEqual(expect.arrayContaining(['FR', 'BE', 'CA', 'US', 'CD', 'CM']));
  });

  it('nomme les pays dans la langue de l’élève, jamais vide', () => {
    expect(nomPays('CM', 'fr')).toBe('Cameroun');
    expect(nomPays('FR', 'en')).toBe('France');
    expect(nomPays('ZZ', 'fr')).toBe('ZZ');
    expect(nomPays(null, 'fr')).toBe('');
  });

  it('donne un drapeau par code, et rien pour un code invalide', () => {
    expect(drapeauPays('cm')).toBe('https://flagcdn.com/w40/cm.png');
    expect(drapeauPays('FR')).toBe('https://flagcdn.com/w40/fr.png');
    expect(drapeauPays('ZZZ')).toBeNull();
    expect(drapeauPays(null)).toBeNull();
  });

  it('rend la liste triée et complète, même sans le serveur', () => {
    const pays = listerPays('fr');
    expect(pays).toHaveLength(CODES_PAYS.length);
    expect(pays.every((p) => p.name && p.alpha2)).toBe(true);
    expect(pays.every((p) => p.prefix === '')).toBe(true);
    const noms = pays.map((p) => p.name);
    expect([...noms].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(noms);
  });

  it('ajoute les indicatifs quand le serveur les fournit', () => {
    const pays = listerPays('fr', { CM: '237' });
    expect(pays.find((p) => p.alpha2 === 'CM')?.prefix).toBe('237');
    expect(pays.find((p) => p.alpha2 === 'FR')?.prefix).toBe('');
  });
});
