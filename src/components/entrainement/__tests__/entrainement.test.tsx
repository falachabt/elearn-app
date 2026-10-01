import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { lireCorrection, statuts } from '@/services/correction';
import { CLE_SCORES, finChapitreVue, lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import { enregistrerProfil } from '@/services/profil';
import { marquerLue } from '@/services/reviser';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranResultats } from '../../quiz/EcranResultats';
import { Chapitre } from '../../reviser/Chapitre';
import { Reviser } from '../../reviser/Reviser';
import { ChapitreEntrainement } from '../ChapitreEntrainement';
import { ExerciceLibre } from '../ExerciceLibre';
import { FinChapitre } from '../FinChapitre';
import { QuizLibreEcran } from '../QuizLibre';

const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const COURS = [
  { course_id: 1, name: 'Fractions', subject: 'Mathématique', lessons: 2 },
  { course_id: 2, name: 'Pythagore', subject: 'Mathématique', lessons: 1 },
  { course_id: 3, name: 'Le conte', subject: 'Français', lessons: 1 },
];
const QUIZ = [{ quiz_id: 'qz1', name: 'Quiz Fractions', questions: 12 }, { quiz_id: 'qz2', name: 'Quiz défi', questions: 4 }];
const EXERCICES = [{ exercise_id: 'e1', title: 'Simplifier', statement: 'Simplifier 6/8.' }, { exercise_id: 'e2', title: 'Comparer', statement: 'Comparer 1/2 et 2/3.' }];
const QUESTIONS = [1, 2, 3].map((i) => ({
  question_id: i, quiz_id: 'qz1', chapter: 'Fractions', subject: 'Mathématique', kind: 'select',
  prompt: `Question ${i} ?`, options: [{ id: 'a', text: `Bonne ${i}` }, { id: 'b', text: `Fausse ${i}` }], correct: ['a'], explanation: 'Parce que.',
}));

function repondre(nom: string, args: Record<string, unknown>) {
  if (nom === 'revision_courses') return { data: COURS, error: null };
  if (nom === 'practice_counts') return { data: [{ course_id: 1, quizzes: 2, exercises: 2 }, { course_id: 3, quizzes: 0, exercises: 1 }], error: null };
  if (nom === 'course_quizzes') return { data: args.p_course === 1 ? QUIZ : [], error: null };
  if (nom === 'course_exercises') return { data: args.p_course === 1 ? EXERCICES : [], error: null };
  if (nom === 'course_lessons') return { data: [{ lesson_id: 11, name: 'Définition', reading_minutes: 5 }, { lesson_id: 12, name: 'Additionner', reading_minutes: 8 }], error: null };
  if (nom === 'practice_quiz') return { data: QUESTIONS, error: null };
  return { data: [], error: null };
}

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockRpc.mockImplementation(async (nom: string, args: Record<string, unknown>) => repondre(nom, args));
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('D7 · s’entraîner (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('onglet S’entraîner : par matière, seulement les chapitres qui ont de quoi s’entraîner', async () => {
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.onglet }));
    await waitFor(() => expect(screen.getByText('Fractions')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('practice_counts', { p_courses: [1, 2, 3] });
    expect(screen.queryByText('Pythagore')).toBeNull();
    expect(screen.getByText(`${x.entrainement.nQuiz.replace('{{n}}', '2')} · ${x.entrainement.nExercices.replace('{{n}}', '2')}`)).toBeTruthy();
    expect(screen.getByText(x.entrainement.unExercice)).toBeTruthy();
    await fireEvent.press(screen.getByText('Fractions'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions' } });
  });

  it('chapitre : quiz avec meilleur score, exercices faits', async () => {
    await AsyncStorage.setItem(CLE_SCORES, JSON.stringify({ qz1: 80 }));
    await AsyncStorage.setItem('entrainement.exercicesFaits', JSON.stringify({ e2: true }));
    mockParams = { cours: '1', nom: 'Fractions' };
    await monter(<ChapitreEntrainement />);
    await waitFor(() => expect(screen.getByText('Quiz Fractions')).toBeTruthy());
    expect(screen.getByText(`${x.entrainement.questions.replace('{{n}}', '12')} · ${x.entrainement.meilleur.replace('{{n}}', '80')}`)).toBeTruthy();
    expect(screen.getByText(`${x.entrainement.exercice.replace('{{n}}', '2').replace('{{total}}', '2')} · ${x.entrainement.fait}`)).toBeTruthy();
    await fireEvent.press(screen.getByText('Quiz Fractions'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/quiz', params: { id: 'qz1', cours: '1', nom: 'Fractions' } });
    await fireEvent.press(screen.getByText('Simplifier'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e1', cours: '1' } });
  });

  it('chapitre sans entraînement', async () => {
    mockParams = { cours: '2' };
    await monter(<ChapitreEntrainement />);
    await waitFor(() => expect(screen.getByText(x.entrainement.videChapitre)).toBeTruthy());
  });

  it('chapitre de cours : accès à l’entraînement', async () => {
    mockParams = { id: '1', nom: 'Fractions' };
    await monter(<Chapitre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.ouvrir)).toBeTruthy());
    await fireEvent.press(screen.getByText(x.entrainement.ouvrir));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions' } });
  });

  it('quiz libre : questions, meilleur score et correction commune', async () => {
    mockParams = { id: 'qz1', cours: '1', nom: 'Fractions' };
    await monter(<QuizLibreEcran />);
    expect(mockRpc).toHaveBeenCalledWith('practice_quiz', { p_quiz: 'qz1', p_size: 20 });
    for (const i of [1, 2, 3]) {
      await waitFor(() => expect(screen.getByText(`Question ${i} ?`)).toBeTruthy());
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 3 ? x.entrainement.quizTerminer : x.miniTest.suivant }));
    }
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/quiz/resultats'));
    expect(await lireMeilleursScores()).toEqual({ qz1: 67 });
    // Résultats : une erreur, un seul chapitre → « Relire le cours ».
    await monter(<EcranResultats />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.correction.relireCours })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.correction.relireCours }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/chapitre', params: { id: '1', nom: 'Fractions' } });
    const c = await lireCorrection();
    expect(c?.source).toBe('libre');
    expect(statuts(c!)).toEqual(['juste', 'faux', 'juste']);
  });

  it('quiz libre indisponible', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('hors ligne') });
    mockParams = { id: 'qz1' };
    await monter(<QuizLibreEcran />);
    await waitFor(() => expect(screen.getByText(x.entrainement.quizErreur)).toBeTruthy());
  });

  it('exercice : énoncé, marqué fait, exercice suivant', async () => {
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifier 6/8.')).toBeTruthy());
    expect(screen.getByText(x.entrainement.pasDeCorrige)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.marquerFait }));
    await waitFor(() => expect(screen.getByRole('button', { name: x.entrainement.annulerFait })).toBeTruthy());
    expect(await lireExercicesFaits()).toEqual({ e1: true });
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.annulerFait }));
    await waitFor(() => expect(screen.getByRole('button', { name: x.entrainement.marquerFait })).toBeTruthy());
    expect(await lireExercicesFaits()).toEqual({});
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.exerciceSuivant }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e2', cours: '1' } });
  });

  it('fin de chapitre complète : quiz du chapitre et exercices', async () => {
    await marquerLue(11, 1);
    await marquerLue(12, 1);
    mockParams = { cours: '1', nom: 'Fractions' };
    await monter(<FinChapitre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.finTitre)).toBeTruthy());
    expect(screen.getByText(`Fractions · ${x.entrainement.finLecons.replace('{{n}}', '2').replace('{{total}}', '2')}`)).toBeTruthy();
    expect(screen.getByText(x.entrainement.vaPlusLoin)).toBeTruthy();
    expect(await finChapitreVue(1)).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.faireQuiz }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/quiz', params: { id: 'qz1', cours: '1', nom: 'Fractions' } });
    await fireEvent.press(screen.getByText(x.entrainement.exercices));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions' } });
  });

  it('fin de chapitre avec des leçons à valider', async () => {
    await marquerLue(11, 1);
    mockParams = { cours: '1' };
    await monter(<FinChapitre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.finTitrePartiel)).toBeTruthy());
    expect(screen.getByText(x.entrainement.finAValider)).toBeTruthy();
    expect(await finChapitreVue(1)).toBe(false);
  });
});
