import AsyncStorage from '@react-native-async-storage/async-storage';

import { synchroniserEntrainement } from '../synchroEntrainement';

const session = (le: string, score: number) => ({
  le,
  score,
  total: 5,
  questions: [],
  reponses: [],
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('fusionne les meilleurs scores, exercices faits et sessions du compte avec les données locales', async () => {
  const locale = {
    quiz_scores: { quizA: 70 },
    exercises_done: { exerciceA: true },
    quiz_sessions: { quizA: [session('2026-10-01T10:00:00.000Z', 3)] },
  };
  const distante = {
    quiz_scores: { quizA: 85, quizB: 60 },
    exercises_done: { exerciceB: true },
    quiz_sessions: { quizA: [session('2026-10-02T10:00:00.000Z', 4)] },
  };
  await AsyncStorage.multiSet([
    ['entrainement.scores', JSON.stringify(locale.quiz_scores)],
    ['entrainement.exercicesFaits', JSON.stringify(locale.exercises_done)],
    ['entrainement.sessions', JSON.stringify(locale.quiz_sessions)],
  ]);
  const rpc = jest.fn().mockResolvedValue({ data: distante, error: null });

  expect(await synchroniserEntrainement({ rpc } as never)).toBe(true);
  expect(rpc).toHaveBeenCalledWith('sync_my_practice_progress', { p_progress: locale });
  expect(JSON.parse((await AsyncStorage.getItem('entrainement.scores')) ?? '{}')).toEqual({ quizA: 85, quizB: 60 });
  expect(JSON.parse((await AsyncStorage.getItem('entrainement.exercicesFaits')) ?? '{}')).toEqual({ exerciceA: true, exerciceB: true });
  expect(JSON.parse((await AsyncStorage.getItem('entrainement.sessions')) ?? '{}')).toEqual({
    quizA: [session('2026-10-02T10:00:00.000Z', 4), session('2026-10-01T10:00:00.000Z', 3)],
  });
});

