import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { lireCorrection, statuts } from '@/services/correction';
import { CLE_SCORES, enregistrerSession, finChapitreVue, lireSessions, lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import { enregistrerProfil } from '@/services/profil';
import { marquerLue } from '@/services/reviser';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranResultats } from '../../quiz/EcranResultats';
import { Chapitre } from '../../reviser/Chapitre';
import { Reviser } from '../../reviser/Reviser';
import { ChapitreEntrainement } from '../ChapitreEntrainement';
import { DetailQuiz } from '../DetailQuiz';
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
const QUIZ = [{ quiz_id: 'qz1', name: 'Quiz Fractions', questions: 12 }, { quiz_id: 'qz2', name: '10mouvement dans les champs', questions: 4 }];
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
  if (nom === 'exercise_detail') {
    const para = (texte: string) => [{ type: 'paragraph', content: [{ type: 'text', text: texte }] }];
    return args.p_exercise === 'e1'
      ? { data: [{ exercise_id: 'e1', title: 'Simplifier', statement: 'Simplifier 6/8.', context: para('Rappel : diviser par le PGCD.'), context_compressed: null, content: para('Simplifie la fraction 6/8.'), content_compressed: null, correction: para('6/8 = 3/4.'), correction_compressed: null }], error: null }
      : { data: [{ exercise_id: 'e2', title: 'Comparer', statement: 'Comparer 1/2 et 2/3.', context: null, context_compressed: null, content: null, content_compressed: null, correction: null, correction_compressed: null }], error: null };
  }
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
    // Deux cartes par chapitre : Quiz et Exercices ; le chapitre « Le conte » n'a qu'un exercice.
    expect(screen.getAllByText(x.entrainement.carteQuiz.replace('{{n}}', '2'))).toHaveLength(1);
    expect(screen.getByText(x.entrainement.carteExercices.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(x.entrainement.carteExercices.replace('{{n}}', '1'))).toBeTruthy();
    // Puces de matière.
    await fireEvent.press(screen.getByRole('button', { name: 'Français' }));
    expect(screen.queryByText('Fractions')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.toutes }));
    await fireEvent.press(screen.getByText(x.entrainement.carteExercices.replace('{{n}}', '2')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions', onglet: 'exercices' } });
  });

  it('chapitre : onglets Tout, Quiz, Exercices ; cartes reconnaissables', async () => {
    await AsyncStorage.setItem(CLE_SCORES, JSON.stringify({ qz1: 80 }));
    await AsyncStorage.setItem('entrainement.exercicesFaits', JSON.stringify({ e2: true }));
    mockParams = { cours: '1', nom: 'Fractions' };
    await monter(<ChapitreEntrainement />);
    await waitFor(() => expect(screen.getByText(x.entrainement.quizChapitre)).toBeTruthy());
    // Tout : quiz et exercices dans une seule liste, chacun avec son étiquette.
    expect(screen.getByText('Simplifier')).toBeTruthy();
    expect(screen.getByText(x.entrainement.titreQuizN.replace('{{n}}', '10').replace('{{titre}}', 'Mouvement dans les champs'))).toBeTruthy();
    expect(screen.getByText(x.entrainement.questions.replace('{{n}}', '12'))).toBeTruthy();
    expect(screen.getByText('80 %')).toBeTruthy();
    expect(screen.getAllByTestId('pastille-quiz')).toHaveLength(2);
    expect(screen.getAllByTestId('pastille-exercice')).toHaveLength(2);
    // Progression du chapitre : quiz à 80 % et exercice fait.
    expect(screen.getByText(x.entrainement.progression.replace('{{n}}', '2').replace('{{total}}', '4'))).toBeTruthy();
    expect(screen.getByText(x.entrainement.fait)).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.quiz }));
    expect(screen.queryByText('Simplifier')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.exercices }));
    expect(screen.queryByText(x.entrainement.quizChapitre)).toBeNull();
    await fireEvent.press(screen.getByText('Simplifier'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e1', cours: '1' } });
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.tout }));
    // Jamais joué : la session démarre directement.
    await fireEvent.press(screen.getByText(x.entrainement.quizChapitre));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/quiz', params: { id: 'qz1', cours: '1', nom: 'Fractions' } }));
  });

  it('quiz déjà joué : page du quiz avec les sessions passées', async () => {
    await enregistrerSession('qz1', { questions: [], reponses: [] }, new Date('2026-09-30T10:00:00Z'));
    mockParams = { cours: '1', nom: 'Fractions' };
    await monter(<ChapitreEntrainement />);
    await waitFor(() => expect(screen.getByText(x.entrainement.quizChapitre)).toBeTruthy());
    await fireEvent.press(screen.getByText(x.entrainement.quizChapitre));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/detail', params: { id: 'qz1', cours: '1', nom: 'Fractions', titre: 'Quiz Fractions', questions: '12', numero: '' } }),
    );
  });

  it('chapitre : erreur plein écran et « Réessayer »', async () => {
    mockRpc.mockImplementation(async () => ({ data: null, error: { message: 'hors ligne' } }));
    mockParams = { cours: '1', nom: 'Fractions', onglet: 'exercices' };
    await monter(<ChapitreEntrainement />);
    await waitFor(() => expect(screen.getByText(x.entrainement.erreurTitre)).toBeTruthy());
    mockRpc.mockImplementation(async (nom: string, args: Record<string, unknown>) => repondre(nom, args));
    await fireEvent.press(screen.getByText(x.entrainement.reessayer));
    await waitFor(() => expect(screen.getByText('Simplifier')).toBeTruthy());
    // Ouvert sur l'onglet Exercices : pas de quiz.
    expect(screen.queryByText(x.entrainement.quizChapitre)).toBeNull();
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
    expect((await lireSessions('qz1'))[0]).toMatchObject({ score: 2, total: 3 });
    // Résultats : une erreur, un seul chapitre → « Relire le cours ».
    await monter(<EcranResultats />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.correction.relireCours })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.correction.relireCours }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/chapitre', params: { id: '1', nom: 'Fractions' } });
    const c = await lireCorrection();
    expect(c?.source).toBe('libre');
    expect(statuts(c!)).toEqual(['juste', 'faux', 'juste']);
  });

  it('page du quiz : meilleur score, revoir une session, nouvelle session', async () => {
    const q = [{ id: 'a', matiere: 'maths' as const, chapitre: 'Fractions', enonce: 'Q ?', choix: ['Un', 'Deux'], bonne: 1, explication: '' }];
    await enregistrerSession('qz1', { questions: q as never, reponses: [0] }, new Date('2026-09-29T10:00:00Z'));
    await enregistrerSession('qz1', { questions: q as never, reponses: [1] }, new Date('2026-09-30T10:00:00Z'));
    mockParams = { id: 'qz1', cours: '1', nom: 'Fractions', titre: 'Quiz Fractions', questions: '12', numero: '' };
    await monter(<DetailQuiz />);
    await waitFor(() => expect(screen.getByText(x.entrainement.detailSessions)).toBeTruthy());
    expect(screen.getByText(x.entrainement.quizChapitre)).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getAllByTestId('mini-grille')).toHaveLength(2);
    const sessions = screen.getAllByText(new RegExp(`^[01]/1`));
    expect(sessions.map((e) => e.props.children)).toEqual([
      x.entrainement.detailSession.replace('{{score}}', '1').replace('{{total}}', '1').replace('{{pct}}', '100'),
      x.entrainement.detailSession.replace('{{score}}', '0').replace('{{total}}', '1').replace('{{pct}}', '0'),
    ]);
    await fireEvent.press(sessions[1]);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/quiz/resultats'));
    expect((await lireCorrection())?.reponses).toEqual([0]);
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.detailNouvelle }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/quiz', params: { id: 'qz1', cours: '1', nom: 'Fractions' } });
  });

  it('quiz libre indisponible', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('hors ligne') });
    mockParams = { id: 'qz1' };
    await monter(<QuizLibreEcran />);
    await waitFor(() => expect(screen.getByText(x.entrainement.quizErreur)).toBeTruthy());
  });

  it('exercice : contexte, énoncé, corrigé caché puis montré, fait, exercice suivant', async () => {
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('exercise_detail', { p_exercise: 'e1' });
    expect(screen.getByText('Rappel : diviser par le PGCD.')).toBeTruthy();
    expect(screen.queryByText('6/8 = 3/4.')).toBeNull();
    expect(screen.getByText(x.entrainement.exerciceRang.replace('{{n}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByText(x.entrainement.contexte)).toBeTruthy();
    // Ouvrir le corrigé marque l'exercice « Fait ».
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirCorrige }));
    expect(screen.getByText('6/8 = 3/4.')).toBeTruthy();
    await waitFor(async () => expect(await lireExercicesFaits()).toEqual({ e1: true }));
    expect(screen.queryByRole('button', { name: x.entrainement.voirCorrige })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.exerciceSuivant }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e2', cours: '1' } });
  });

  it('exercice sans corrigé ni énoncé structuré : la description, et le dit', async () => {
    mockParams = { id: 'e2', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Comparer 1/2 et 2/3.')).toBeTruthy());
    expect(screen.getByText(x.entrainement.corrigeBientot)).toBeTruthy();
    expect(screen.queryByRole('button', { name: x.entrainement.voirCorrige })).toBeNull();
    // Sans corrigé, on marque l'exercice soi-même ; dernier exercice : retour au chapitre.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.marquerFait }));
    await waitFor(() => expect(screen.getByRole('button', { name: x.entrainement.annulerFait })).toBeTruthy());
    expect(await lireExercicesFaits()).toEqual({ e2: true });
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.retourChapitre }));
    expect(router.replace).toHaveBeenCalledWith('/reviser');
  });

  it('fin de chapitre complète : quiz du chapitre et exercices', async () => {
    await marquerLue(11, 1);
    await marquerLue(12, 1);
    mockParams = { cours: '1', nom: 'Fractions' };
    await monter(<FinChapitre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.finTitre)).toBeTruthy());
    expect(screen.getByText(`Fractions · ${x.entrainement.finLecons.replace('{{n}}', '2').replace('{{total}}', '2')}`)).toBeTruthy();
    expect(await finChapitreVue(1)).toBe(true);
    await fireEvent.press(screen.getByText(x.entrainement.carteQuiz.replace('{{n}}', '2')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions', onglet: 'quiz' } });
    await fireEvent.press(screen.getByText(x.entrainement.carteExercices.replace('{{n}}', '2')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions', onglet: 'exercices' } });
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.ouvrir }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions' } });
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.plusTard }));
    expect(router.replace).toHaveBeenCalledWith('/reviser');
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
