import { formaterPlage, maitriseParGroupe, ordonnerDiagnostic, pointsFaibles, scoreEstime } from '../certDiagnostic';
import type { QuestionServie, ResultatReponse } from '../types';
import { REGLAGES as R } from './fixtures';
import { questionsTest } from './apiFausse';

const resultat = (q: QuestionServie, correct: boolean, titre = `Notion ${q.part}`): ResultatReponse => ({
  question_id: q.id, client_uuid: `c-${q.id}`, correct, skipped: false, correct_index: 0, trap: null, transcript: null, replay: false,
  notion: { id: `n-${titre}`, code: titre, title: titre, family: 'grammaire' }, notions: [],
});

describe('ordre du diagnostic (D-19)', () => {
  it('range Listening puis Reading, parties P1 à P7, en gardant l’ordre des groupes dans une partie', () => {
    const q = questionsTest();
    const melange = [q[5], q[0], q[18], q[2], q[9], q[1], ...q.filter((x) => ![5, 0, 18, 2, 9, 1].includes(q.indexOf(x)))];
    const ordre = ordonnerDiagnostic(melange);
    expect(ordre.map((x) => x.part)).toEqual([...ordre.map((x) => x.part)].sort((a, b) => a - b));
    const p3 = ordre.filter((x) => x.part === 3).map((x) => x.id);
    expect(p3).toEqual(melange.filter((x) => x.part === 3).map((x) => x.id));
  });
});

describe('maîtrise par groupe de parties (F4, A7)', () => {
  const parPartie = (b: number, n: number) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((p) => [String(p), { answered: n, correct: b }]));
  it('0 % : tout fragile', () => {
    const l = maitriseParGroupe(parPartie(0, 4), R);
    expect(l.map((x) => x.id)).toEqual(['p1p2', 'p3p4', 'p5', 'p6', 'p7']);
    expect(l.every((x) => x.etat === 'fragile' && x.m === 0)).toBe(true);
  });
  it('50 % : en progrès', () => {
    expect(maitriseParGroupe(parPartie(2, 4), R).every((x) => x.etat === 'en_progres' && x.m === 0.5)).toBe(true);
  });
  it('100 % : acquise', () => {
    expect(maitriseParGroupe(parPartie(4, 4), R).every((x) => x.etat === 'acquise' && x.m === 1)).toBe(true);
  });
  it('regroupe P1 à P2 : réponses additionnées', () => {
    const l = maitriseParGroupe({ '1': { answered: 1, correct: 1 }, '2': { answered: 3, correct: 0 } }, R);
    expect(l[0]).toMatchObject({ repondues: 4, bonnes: 1, m: 0.25, etat: 'fragile' });
  });
  it('partie sans réponse : pas commencée, jamais un faux chiffre', () => {
    const l = maitriseParGroupe({}, R);
    expect(l[2]).toMatchObject({ etat: 'pas_commencee', m: null });
  });
});

describe('trois points à travailler (A7)', () => {
  const q = questionsTest();
  const sur = (ids: [number, boolean][]) => ids.map(([i, ok]) => resultat(q[i], ok));
  it('prend les notions les plus faibles parmi celles qui ont une erreur, avec les questions ratées', () => {
    // partie 5 : 3 ratées sur 3 ; partie 6 : 1 ratée sur 2 ; partie 7 : tout juste.
    const idx5 = q.map((x, i) => [x, i] as const).filter(([x]) => x.part === 5).map(([, i]) => i);
    const idx6 = q.map((x, i) => [x, i] as const).filter(([x]) => x.part === 6).map(([, i]) => i);
    const idx7 = q.map((x, i) => [x, i] as const).filter(([x]) => x.part === 7).map(([, i]) => i);
    const res = sur([...idx5.map((i) => [i, false] as [number, boolean]), [idx6[0], false], [idx6[1], true], ...idx7.map((i) => [i, true] as [number, boolean])]);
    const f = pointsFaibles(q, res, { total: 0, theme: null }, R);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ genre: 'notion', partie: 5, ratees: 3 });
    expect(f[1]).toMatchObject({ genre: 'notion', partie: 6, ratees: 1 });
  });
  it('au plus trois lignes, la ligne vocabulaire comprise', () => {
    const res = q.map((x) => resultat(x, false));
    const sans = pointsFaibles(q, res, { total: 0, theme: null }, R);
    expect(sans).toHaveLength(3);
    const avec = pointsFaibles(q, res, { total: 5, theme: 'bureau' }, R);
    expect(avec).toHaveLength(3);
    expect(avec[2]).toEqual({ genre: 'vocabulaire', theme: 'bureau', mots: 5 });
  });
  it('moins de trois quand il y a moins de notions ratées, et rien si tout est juste', () => {
    expect(pointsFaibles(q, q.map((x) => resultat(x, true)), { total: 0, theme: null }, R)).toEqual([]);
    expect(pointsFaibles(q, [resultat(q[0], false)], { total: 0, theme: null }, R)).toHaveLength(1);
  });
});

describe('fourchette affichée (F2)', () => {
  it('« 650 à 730 » ; sans estimation, aucune valeur', () => {
    expect(formaterPlage(650, 730)).toBe('650 à 730');
    expect(formaterPlage(null, null)).toBeNull();
  });
});

describe('scoreEstime : score exact, repli sur le milieu de la fourchette', () => {
  it('prend le score exact du serveur', () => {
    expect(scoreEstime({ estimated: true, score: 745, score_min: 720, score_max: 770 })).toBe(745);
  });
  it('sans score exact (résultat ancien), prend le milieu de la fourchette', () => {
    expect(scoreEstime({ estimated: true, score: null, score_min: 650, score_max: 730 })).toBe(690);
  });
  it('sans estimation, ne donne rien', () => {
    expect(scoreEstime({ estimated: false, score: null, score_min: null, score_max: null })).toBeNull();
    expect(scoreEstime(null)).toBeNull();
  });
});
