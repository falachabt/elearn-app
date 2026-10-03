import AsyncStorage from '@react-native-async-storage/async-storage';

import { basculerExerciceFait, enregistrerSession, lireSessions, MAX_SESSIONS, nettoyerNomQuiz, enregistrerScore, lireCompteurs, lireEntrainement, lireExercicesFaits, lireMeilleursScores, lireProgresChapitres, separerMeta } from '../entrainement';

const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) });

beforeEach(() => AsyncStorage.clear());

describe('entrainement', () => {
  it('compteurs par chapitre, gardés pour le hors ligne', async () => {
    const c = client([{ course_id: 1, quizzes: 2, exercises: 0 }]);
    expect(await lireCompteurs(c as never, [1, 2], '3e.CM')).toEqual({ 1: { quiz: 2, exercices: 0 } });
    expect(c.rpc).toHaveBeenCalledWith('practice_counts', { p_courses: [1, 2] });
    expect(await lireCompteurs(client(null, new Error('hors ligne')) as never, [1, 2], '3e.CM')).toEqual({ 1: { quiz: 2, exercices: 0 } });
    expect(await lireCompteurs(c as never, [], '3e.CM')).toEqual({});
  });

  it('quiz et exercices d’un chapitre', async () => {
    const c = { rpc: jest.fn(async (nom: string) => ({ data: nom === 'course_quizzes' ? [{ quiz_id: 'q', name: ' Quiz ', questions: 5 }] : [{ exercise_id: 'e', title: 'Ex ', statement: ' Faire. ' }], error: null })) };
    expect(await lireEntrainement(c as never, 4)).toEqual({ quiz: [{ id: 'q', nom: 'Quiz', questions: 5 }], exercices: [{ id: 'e', titre: 'Ex', enonce: 'Faire.' }] });
  });

  it('garde le meilleur score seulement', async () => {
    expect(await enregistrerScore('q', 3, 4)).toBe(true);
    expect(await enregistrerScore('q', 1, 4)).toBe(false);
    expect(await enregistrerScore('q', 4, 4)).toBe(true);
    expect(await enregistrerScore('q', 0, 0)).toBe(false);
    expect(await lireMeilleursScores()).toEqual({ q: 100 });
  });

  it('exercice fait puis défait', async () => {
    expect(await basculerExerciceFait('e')).toBe(true);
    expect(await lireExercicesFaits()).toEqual({ e: true });
    expect(await basculerExerciceFait('e')).toBe(false);
    expect(await lireExercicesFaits()).toEqual({});
  });

  it('nom de quiz : numéro collé séparé', () => {
    expect(nettoyerNomQuiz('10mouvement dans les champs')).toEqual({ nom: 'Mouvement dans les champs', numero: 10 });
    expect(nettoyerNomQuiz(' 3 - Forces ')).toEqual({ nom: 'Forces', numero: 3 });
    expect(nettoyerNomQuiz('Quiz Fractions')).toEqual({ nom: 'Quiz Fractions' });
    expect(nettoyerNomQuiz('2024')).toEqual({ nom: '2024' });
  });

  it('sessions : la plus récente en premier, 10 au plus', async () => {
    const q = { id: 'a', matiere: 'maths', chapitre: 'c', enonce: 'Q', choix: ['x', 'y'], bonne: 1, explication: '' } as never;
    for (let i = 0; i < MAX_SESSIONS + 2; i++) await enregistrerSession('q', { questions: [q], reponses: [i % 2] }, new Date(2026, 8, 1 + i));
    const s = await lireSessions('q');
    expect(s).toHaveLength(MAX_SESSIONS);
    expect(s[0]).toMatchObject({ score: 1, total: 1, le: new Date(2026, 8, 12).toISOString() });
    expect(await lireSessions('autre')).toEqual([]);
  });
});

describe('lireProgresChapitres', () => {
  it('meilleur score et exercices faits, à partir de la copie du chapitre', async () => {
    await AsyncStorage.setItem('entrainement.cours.5', JSON.stringify({ quiz: [{ id: 'a', nom: 'A', questions: 5 }, { id: 'b', nom: 'B', questions: 5 }], exercices: [{ id: 'e1', titre: '', enonce: '' }, { id: 'e2', titre: '', enonce: '' }] }));
    await AsyncStorage.setItem('entrainement.scores', JSON.stringify({ a: 40, b: 75 }));
    await AsyncStorage.setItem('entrainement.exercicesFaits', JSON.stringify({ e2: true }));
    await expect(lireProgresChapitres([5, 6])).resolves.toEqual({ 5: { meilleur: 75, faits: 1, quizFaits: 2 } });
  });
});

describe('separerMeta', () => {
  const p = (texte: string) => ({ type: 'paragraphe' as const, segments: [{ texte }], retrait: 0 });

  it('retire Titre et Difficulté, garde la description comme question, lit la difficulté', () => {
    const r = separerMeta([p('Titre : Définition'), p('Description : Définissez en une phrase.'), p('Difficulté : facile'), p('Un graphe suit.')]);
    expect(r.difficulte).toBe('facile');
    expect(r.enonce).toEqual([p('Définissez en une phrase.'), p('Un graphe suit.')]);
  });

  it('reconnaît moyen et difficile, laisse un énoncé sans étiquettes intact', () => {
    expect(separerMeta([p('Difficulté : Moyenne')]).difficulte).toBe('moyen');
    expect(separerMeta([p('DIFFICULTE: difficile')]).difficulte).toBe('difficile');
    const brut = [p('Calcule 2 + 2.')];
    expect(separerMeta(brut)).toEqual({ enonce: brut, difficulte: undefined });
  });
});
