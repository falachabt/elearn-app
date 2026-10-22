import { meilleurDeSection, nombreFaits, statutLigne, testConseille } from '../listesTests';
import type { DefTest } from '../types';

const base: DefTest = {
  id: 'a', kind: 'listening', numero: 1, questions: 100, tentatives: 0, fini: false,
  meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 100,
};

describe('listes de tests (v38)', () => {
  it('statut : pas fait, commencé, fait', () => {
    expect(statutLigne(base)).toBe('pas_fait');
    expect(statutLigne({ ...base, tentatives: 1 })).toBe('commence');
    expect(statutLigne({ ...base, tentatives: 2, fini: true })).toBe('fait');
  });

  it('meilleur de section : le plus haut des scores finis, null sans score', () => {
    expect(meilleurDeSection([base])).toBeNull();
    expect(meilleurDeSection([{ ...base, meilleurScoreMax: 410 }, { ...base, id: 'b', meilleurScoreMax: 380 }])).toBe(410);
  });

  it('fait : compte les tests finis', () => {
    expect(nombreFaits([{ ...base, fini: true }, base, { ...base, id: 'c', fini: true }])).toBe(2);
  });

  it('conseillé : le premier test non fini, rien quand tout est fini', () => {
    expect(testConseille([{ ...base, fini: true }, { ...base, id: 'd' }])?.id).toBe('d');
    expect(testConseille([{ ...base, fini: true }])).toBeNull();
  });
});
