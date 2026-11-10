import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE, meilleurDeSection, nombreFaits, numeroDansPartie, statutLigne, synthesesParties, testConseille, testsDeLaPartie } from '../listesTests';
import type { DefTest } from '../types';

const base: DefTest = {
  id: 'a', kind: 'listening', part: null, numero: 1, questions: 100, tentatives: 0, fini: false,
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

describe('mini-tests par partie et mixte (v39)', () => {
  const mini = (id: string, part: number | null, numero: number, extra: Partial<DefTest> = {}): DefTest => ({
    id, kind: 'mini', part, numero, questions: 10, tentatives: 0, fini: false, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 10, ...extra,
  });

  it('une partie ne liste que ses tests, numérotés à partir de 1', () => {
    const tests = [mini('a', 1, 1), mini('b', 5, 2), mini('c', 5, 4), mini('d', 5, 3)];
    expect(testsDeLaPartie(tests, 5).map((t) => t.id)).toEqual(['b', 'd', 'c']);
    expect(numeroDansPartie(tests, tests[1]!)).toBe(1);
    expect(numeroDansPartie(tests, tests[3]!)).toBe(2);
  });

  it('synthèse : faits, total, et « Conseillé » sur la partie qui a le plus de questions nouvelles', () => {
    const tests = [
      mini('a', 1, 1, { fini: true, tentatives: 1, meilleurScoreMax: 8, nouvellesQuestions: 0 }),
      mini('b', 1, 2, { nouvellesQuestions: 10 }),
      mini('c', 5, 3, { fini: true, tentatives: 1, meilleurScoreMax: 7, nouvellesQuestions: 0 }),
      mini('d', 5, 4, { tentatives: 1, nouvellesQuestions: 6 }),
      mini('e', 5, 5, { nouvellesQuestions: 10 }),
    ];
    const parts = synthesesParties(tests);
    expect(parts.find((p) => p.partie === 1)).toEqual({ partie: 1, faits: 1, total: 2, nouvelles: 10, conseillee: false });
    expect(parts.find((p) => p.partie === 5)).toEqual({ partie: 5, faits: 1, total: 3, nouvelles: 16, conseillee: true });
    expect(parts.find((p) => p.partie === 2)).toEqual({ partie: 2, faits: 0, total: 0, nouvelles: 0, conseillee: false });
    expect(parts.filter((p) => p.conseillee)).toHaveLength(1);
  });

  it('quand tous les tests sont faits, aucune partie n’est conseillée', () => {
    const tests = [mini('a', 3, 1, { fini: true, tentatives: 1, meilleurScoreMax: 9, nouvellesQuestions: 0 })];
    expect(synthesesParties(tests).some((p) => p.conseillee)).toBe(false);
  });

  it('les titres et numéros des mini-tests et du mixte ont leur clé', () => {
    expect(CLE_TITRE_LISTE.mini).toBe('certification.tests.listes.titreMiniPartie');
    expect(CLE_TITRE_LISTE.mixed).toBe('certification.tests.listes.titreMixte');
    expect(CLE_NUMERO_LIGNE.mixed).toBe('certification.tests.listes.numeroMixte');
  });
});
