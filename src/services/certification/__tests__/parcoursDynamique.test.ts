import { composerJournee, estAReprendre, fileAReprendre, melanger, miniTestDu, questionsApresLecon, repondreDansLaFile, revueDeLaSemaine, testCompletDu, type ErreurFile } from '../parcoursDynamique';

const base = (over: Partial<ErreurFile> = {}): ErreurFile => ({
  questionId: 'q1',
  notionId: 'n1',
  erreurLe: '2026-11-16',
  etat: { prochaineRevue: '2026-11-17', serie: 0 },
  ...over,
});
const R = { delaisRejeuJours: [1, 3, 7], rejeuRetraitApres: 2 };

describe('questions après une leçon', () => {
  it('5 questions par défaut, 10 pour une séance de 30 minutes', () => {
    expect(questionsApresLecon(10)).toBe(5);
    expect(questionsApresLecon(20)).toBe(5);
    expect(questionsApresLecon(30)).toBe(10);
  });
});

describe('file « À reprendre »', () => {
  it('une erreur reste à reprendre tant qu’elle n’est pas sortie', () => {
    const e = base();
    expect(estAReprendre(e)).toBe(true);
    expect(fileAReprendre([e, base({ questionId: 'q2', etat: { prochaineRevue: null, serie: 2 } })])).toHaveLength(1);
  });

  it('sort après deux bonnes réponses de suite, une fausse réponse la remet dans la file', () => {
    let e = base();
    e = repondreDansLaFile(e, true, '2026-11-17', R);
    expect(estAReprendre(e)).toBe(true);
    e = repondreDansLaFile(e, true, '2026-11-18', R);
    expect(estAReprendre(e)).toBe(false);

    let f = base();
    f = repondreDansLaFile(f, true, '2026-11-17', R);
    f = repondreDansLaFile(f, false, '2026-11-18', R);
    expect(estAReprendre(f)).toBe(true);
    expect(f.etat.serie).toBe(0);
  });
});

describe('revue du samedi', () => {
  it('reprend les erreurs de la semaine encore dans la file, pas celles d’une autre semaine', () => {
    const cette = base({ questionId: 'a', erreurLe: '2026-11-17' });
    const sortie = base({ questionId: 'b', erreurLe: '2026-11-18', etat: { prochaineRevue: null, serie: 2 } });
    const semaineDerniere = base({ questionId: 'c', erreurLe: '2026-11-10' });
    const dimanche = base({ questionId: 'd', erreurLe: '2026-11-22' });
    const revue = revueDeLaSemaine([cette, sortie, semaineDerniere, dimanche], '2026-11-21');
    expect(revue.map((e) => e.questionId)).toEqual(['a', 'd']);
  });
});

describe('entrelacement', () => {
  it('ne met pas deux fois de suite la même notion quand il y a le choix', () => {
    const items = [
      { notionId: 'x', k: 1 },
      { notionId: 'x', k: 2 },
      { notionId: 'y', k: 3 },
      { notionId: 'z', k: 4 },
    ];
    const m = melanger(items);
    expect(m).toHaveLength(4);
    for (let i = 1; i < m.length; i++) expect(m[i].notionId).not.toBe(m[i - 1].notionId);
    expect(m.filter((e) => e.notionId === 'x').map((e) => e.k)).toEqual([1, 2]);
  });
});

describe('cadence du mini-test et du test complet', () => {
  it('mini-test dû jamais fait, puis une fois par semaine', () => {
    expect(miniTestDu(null, '2026-11-17')).toBe(true);
    expect(miniTestDu('2026-11-11', '2026-11-17')).toBe(false);
    expect(miniTestDu('2026-11-10', '2026-11-17')).toBe(true);
  });

  it('test complet à J-7 de l’examen, puis tous les 15 jours', () => {
    expect(testCompletDu(null, '2026-11-24', '2026-11-17')).toBe(true);
    expect(testCompletDu(null, '2026-12-20', '2026-11-17')).toBe(false);
    expect(testCompletDu('2026-11-01', null, '2026-11-17')).toBe(true);
    expect(testCompletDu('2026-11-10', null, '2026-11-17')).toBe(false);
  });
});

describe('composition de la journée', () => {
  it('ordre : pratique, mots, à reprendre, série ; pas de revue un mardi', () => {
    const etapes = composerJournee({
      aujourdhui: '2026-11-17',
      minutes: 20,
      leconDuJour: 'n1',
      erreurs: [base()],
      motsEchus: 6,
      dernierMiniTest: '2026-11-16',
    });
    expect(etapes.map((e) => e.type)).toEqual(['pratique', 'rappel_mots', 'a_reprendre', 'serie']);
    expect(etapes[0]).toEqual({ type: 'pratique', notionId: 'n1', questions: 5 });
  });

  it('le samedi, ajoute la revue quand il reste des erreurs de la semaine, et le mini-test s’il est dû', () => {
    const etapes = composerJournee({
      aujourdhui: '2026-11-21',
      minutes: 30,
      leconDuJour: null,
      erreurs: [base({ erreurLe: '2026-11-17' })],
      motsEchus: 0,
      dernierMiniTest: null,
    });
    expect(etapes.map((e) => e.type)).toEqual(['a_reprendre', 'serie', 'revue_semaine', 'mini_test']);
    expect(etapes.find((e) => e.type === 'revue_semaine')).toEqual({ type: 'revue_semaine', questions: 1 });
  });
});

import { etatPratique, etatTest, pratiqueValidee, testValide } from '../parcoursDynamique';

describe('validation (seuil 80 %)', () => {
  it('pratique : 4 justes sur 5 valident, 3 sur 5 non', () => {
    expect(pratiqueValidee(4, 5, 5)).toBe(true);
    expect(pratiqueValidee(3, 5, 5)).toBe(false);
  });

  it('pratique : 3 questions sur 10 ne valident rien, même toutes justes', () => {
    expect(pratiqueValidee(3, 3, 10)).toBe(false);
    expect(pratiqueValidee(8, 10, 10)).toBe(true);
  });

  it('test : objectif 800 donne un seuil de 640 sur 990', () => {
    expect(testValide(640, 800)).toBe(true);
    expect(testValide(639, 800)).toBe(false);
    expect(testValide(700, 0)).toBe(false);
  });

  it('états : à faire, validé ou à refaire (rouge)', () => {
    expect(etatPratique(0, 0, 5)).toBe('a_faire');
    expect(etatPratique(3, 3, 5)).toBe('a_faire');
    expect(etatPratique(5, 4, 5)).toBe('validee');
    expect(etatPratique(5, 2, 5)).toBe('a_refaire');
    expect(etatTest(null, 800)).toBe('a_faire');
    expect(etatTest(600, 800)).toBe('a_refaire');
    expect(etatTest(660, 800)).toBe('validee');
  });
});
