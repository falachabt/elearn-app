import { listerPays } from '@/services/pays';

import { filtrerPays, normaliser } from '../FeuillePays';

const PAYS = listerPays('fr');
const codes = (saisie: string) => filtrerPays(PAYS, saisie).map((p) => p.alpha2);
const contient = (saisie: string, attendu: string) => expect(codes(saisie)).toContain(attendu);

describe('recherche dans le sélecteur de pays', () => {
  it('par nom, sans se soucier des accents ni des majuscules', () => {
    contient('cameroun', 'CM');
    contient('CAMEROUN', 'CM');
    contient('Cameroun', 'CM');
    contient('cote d ivoire', 'CI');
    contient('côte d’ivoire', 'CI');
    contient('senegal', 'SN');
  });

  it('par code à deux lettres, le code exact passant devant', () => {
    expect(codes('CM')[0]).toBe('CM');
    expect(codes('cm')[0]).toBe('CM');
    // « ci » remonte aussi la Cité du Vatican ou le Sahara occidental : le code exact doit être le premier.
    expect(codes('CI')[0]).toBe('CI');
    expect(codes('SN')[0]).toBe('SN');
  });

  it('par code à trois lettres', () => {
    expect(codes('CMR')[0]).toBe('CM');
    expect(codes('cmr')[0]).toBe('CM');
    expect(codes('CIV')[0]).toBe('CI');
    // « FRA » trouve aussi la Guyane et la Polynésie françaises ; la France est première.
    expect(codes('FRA')[0]).toBe('FR');
  });

  it('par indicatif téléphonique, avec ou sans le plus', () => {
    expect(codes('237')[0]).toBe('CM');
    expect(codes('+237')[0]).toBe('CM');
    expect(codes('225')[0]).toBe('CI');
    expect(codes('33')[0]).toBe('FR');
  });

  it('saisie vide : toute la liste ; saisie inconnue : rien', () => {
    expect(filtrerPays(PAYS, '')).toHaveLength(PAYS.length);
    expect(filtrerPays(PAYS, '   ')).toHaveLength(PAYS.length);
    expect(codes('zzzz')).toEqual([]);
  });

  it('normalise accents, apostrophes et casse', () => {
    expect(normaliser('  CÔTE D’IVOIRE ')).toBe('cote d ivoire');
    expect(normaliser('Cameroun')).toBe('cameroun');
  });
});
