import { CODES_PAYS, drapeauPays, listerPays, nomPays, numeroPlausible } from '../pays';

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
    // Chaque pays porte son indicatif international : c'est ce qui rend la recherche par numéro possible.
    // Seuls l'Antarctique et les îles Heard-et-MacDonald n'en ont pas.
    expect(pays.find((p) => p.alpha2 === 'CM')?.prefix).toBe('237');
    expect(pays.find((p) => p.alpha2 === 'CI')?.prefix).toBe('225');
    expect(pays.find((p) => p.alpha2 === 'FR')?.prefix).toBe('33');
    expect(pays.filter((p) => !p.prefix).map((p) => p.alpha2)).toEqual(['AQ', 'HM']);
    const noms = pays.map((p) => p.name);
    expect([...noms].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(noms);
  });

  it('l’indicatif du serveur prime quand il est fourni', () => {
    const pays = listerPays('fr', { CM: '00237' });
    expect(pays.find((p) => p.alpha2 === 'CM')?.prefix).toBe('00237');
    expect(pays.find((p) => p.alpha2 === 'FR')?.prefix).toBe('33');
  });

  it('vérifie le numéro selon le pays, avant tout envoi', () => {
    // Cameroun : 8 ou 9 chiffres, commençant par 2 ou 6.
    expect(numeroPlausible('657273753', 'CM')).toBe(true);
    expect(numeroPlausible('6 57 27 37 53', 'CM')).toBe(true);
    // Indicatif saisi par mégarde : on le retire au lieu de refuser.
    expect(numeroPlausible('237657273753', 'CM')).toBe(true);
    expect(numeroPlausible('+237 657 27 37 53', 'CM')).toBe(true);
    expect(numeroPlausible('12345', 'CM')).toBe(false);
    expect(numeroPlausible('', 'CM')).toBe(false);
    expect(numeroPlausible('999999999', 'CM')).toBe(false);

    // France : 9 chiffres, le zéro de tête étant toléré.
    expect(numeroPlausible('0612345678', 'FR')).toBe(true);
    expect(numeroPlausible('612345678', 'FR')).toBe(true);
    expect(numeroPlausible('12345', 'FR')).toBe(false);

    // Côte d'Ivoire : 10 chiffres commençant par 0 ou 2.
    expect(numeroPlausible('0700000000', 'CI')).toBe(true);
    expect(numeroPlausible('07000000', 'CI')).toBe(false);

    // Pays sans règle connue : on garde la borne internationale.
    expect(numeroPlausible('1234567', 'ZZ')).toBe(true);
    expect(numeroPlausible('123', 'ZZ')).toBe(false);
  });
});
