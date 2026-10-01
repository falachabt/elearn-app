import AsyncStorage from '@react-native-async-storage/async-storage';

import { basculerExerciceFait, enregistrerScore, lireCompteurs, lireEntrainement, lireExercicesFaits, lireMeilleursScores } from '../entrainement';

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
});
