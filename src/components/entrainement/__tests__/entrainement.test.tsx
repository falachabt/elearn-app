import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { lireCorrection, statuts } from '@/services/correction';
import { CLE_SCORES, enregistrerSession, finChapitreVue, lireEntrainement, lireSessions, lireExercicesFaits, lireMeilleursScores, noterDernier } from '@/services/entrainement';
import { enregistrerProfil } from '@/services/profil';
import { lireReprise } from '@/services/reprise';
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
const mockDepenser = jest.fn();
let mockPass = false;
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: mockPass ? { illimite: true, total: 0, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: new Date(Date.now() + 86400000).toISOString(), illimiteJusqua: null, expirationRecompenses: null } : null, couts: mockPass ? { exercise_solution: 2 } : {}, depenser: (...a: unknown[]) => mockDepenser(...a), rafraichir: async () => {} }),
}));
let mockParams: Record<string, string> = {};
// Navigation : la sortie de l'écran (✕, retour Android, geste) passe par « beforeRemove ».
let mockSortie: ((e: { preventDefault: () => void; data: { action: object } }) => void) | null = null;
const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({
    addListener: (_: string, f: typeof mockSortie) => {
      mockSortie = f;
      return () => undefined;
    },
    dispatch: (...a: unknown[]) => mockDispatch(...a),
  }),
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
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
      ? { data: [{ exercise_id: 'e1', title: 'Simplifier', statement: 'Simplifier 6/8.', context: para('Rappel : diviser par le PGCD.'), context_compressed: null, content: para('Simplifie la fraction 6/8.'), content_compressed: null, has_correction: true }], error: null }
      : { data: [{ exercise_id: 'e2', title: 'Comparer', statement: 'Comparer 1/2 et 2/3.', context: null, context_compressed: null, content: null, content_compressed: null, has_correction: false }], error: null };
  }
  return { data: [], error: null };
}

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

afterEach(() => jest.restoreAllMocks());
beforeEach(async () => {
  jest.clearAllMocks();
  mockPass = false;
  await AsyncStorage.clear();
  mockParams = {};
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockDepenser.mockResolvedValue({ statut: 'spent', cout: 2, solde: 9, contenu: { correction: [{ type: 'paragraph', content: [{ type: 'text', text: '6/8 = 3/4.' }] }] } });
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
    // Une carte par chapitre, avec ses compteurs quiz et exercices.
    expect(screen.getByLabelText(x.entrainement.compteurQuiz.replace('{{n}}', '0').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByLabelText(x.entrainement.compteurExercices.replace('{{n}}', '0').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByText('Le conte')).toBeTruthy();
    expect(screen.queryByText(x.entrainement.reprendre)).toBeNull();
    // Puces de matière.
    await fireEvent.press(screen.getByRole('button', { name: 'Français' }));
    expect(screen.queryByText('Fractions')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.toutes }));
    await fireEvent.press(screen.getByText('Fractions'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/chapitre', params: { cours: '1', nom: 'Fractions' } });
  });

  it('changer d’onglet ne remonte rien : l’onglet quitté reste monté, son chargement n’est pas relancé', async () => {
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.onglet }));
    await waitFor(() => expect(screen.getByText('Fractions')).toBeTruthy());
    const appels = () => mockRpc.mock.calls.filter((c) => c[0] === 'practice_counts').length;
    expect(appels()).toBe(1);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.ongletCours }));
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.onglet }));
    expect(screen.getByText('Fractions')).toBeTruthy();
    expect(appels()).toBe(1);
  });

  it('S’entraîner : carte « Reprendre » sur le dernier quiz joué', async () => {
    await lireEntrainement({ rpc: (...args: unknown[]) => mockRpc(...args) } as never, 1);
    await AsyncStorage.setItem(CLE_SCORES, JSON.stringify({ qz2: 75 }));
    await noterDernier({ type: 'quiz', id: 'qz2', cours: 1, chapitre: 'Fractions' });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.entrainement.onglet }));
    await waitFor(() => expect(screen.getByText(x.entrainement.reprendre)).toBeTruthy());
    expect(screen.getByText(x.entrainement.reprendreMeilleur.replace('{{chapitre}}', 'Fractions').replace('{{n}}', '75'))).toBeTruthy();
    expect(screen.getByLabelText(x.entrainement.compteurQuiz.replace('{{n}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    await fireEvent.press(screen.getByText(x.entrainement.reprendre));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/entrainement/quiz', params: { id: 'qz2', cours: '1', nom: 'Fractions' } });
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
    await waitFor(() => expect(screen.getByText(x.reviser.entrainerCours)).toBeTruthy());
    await fireEvent.press(screen.getByText(x.reviser.entrainerCours));
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
    // 2/3 : « bien joué ».
    expect(screen.getByText(x.correction.titreScore.replace('{{score}}', '2').replace('{{total}}', '3').replace('{{message}}', x.correction.bienJoue))).toBeTruthy();
    // Le ✕ en haut ET le bouton « Terminer » du bilan : même action.
    expect(screen.getAllByRole('button', { name: x.correction.terminer })).toHaveLength(2);
    (router.back as jest.Mock).mockClear();
    await fireEvent.press(screen.getAllByRole('button', { name: x.correction.terminer })[1]);
    expect(router.replace).toHaveBeenCalledWith('/');
    await fireEvent.press(screen.getByRole('button', { name: x.correction.relireCours }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/chapitre', params: { id: '1', nom: 'Fractions' } });
    const c = await lireCorrection();
    expect(c?.source).toBe('libre');
    expect(statuts(c!)).toEqual(['juste', 'faux', 'juste']);
  });

  async function jouerQuizLibre() {
    mockParams = { id: 'qz1', cours: '1', nom: 'Fractions' };
    await monter(<QuizLibreEcran />);
    for (const i of [1, 2, 3]) {
      await waitFor(() => expect(screen.getByText(`Question ${i} ?`)).toBeTruthy());
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 3 ? x.entrainement.quizTerminer : x.miniTest.suivant }));
    }
  }

  it('quiz libre fini : la carte « Reprendre » est remplie dès l’arrivée sur les résultats', async () => {
    await jouerQuizLibre();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/quiz/resultats'));
    // Écritures attendues avant la navigation : rien à patienter, la carte n'est jamais vide.
    const reprise = await lireReprise([{ id: 1, nom: 'Fractions', matiere: 'Mathématiques', lecons: 2 }] as never);
    expect(reprise.map((e) => e.type)).toEqual(['quiz']);
    expect(reprise[0]).toMatchObject({ chapitre: 'Fractions' });
  });

  it('quiz libre fini avec stockage local en échec : la navigation vers le score a lieu quand même', async () => {
    const setItem = jest.mocked(AsyncStorage.setItem);
    const original = setItem.getMockImplementation();
    const avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setItem.mockRejectedValue(new Error('stockage plein'));
    try {
      await jouerQuizLibre();
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/quiz/resultats'));
    } finally {
      if (original) setItem.mockImplementation(original);
      avertir.mockRestore();
    }
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

  it('exercice : contexte, énoncé, bascule énoncé/corrigé ; « fait » seulement sur demande, au Suivant', async () => {
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('exercise_detail', { p_exercise: 'e1' });
    expect(screen.getByText('Rappel : diviser par le PGCD.')).toBeTruthy();
    expect(screen.queryByText('6/8 = 3/4.')).toBeNull();
    expect(screen.getByText(x.entrainement.exerciceRang.replace('{{n}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByText(x.entrainement.contexte.toUpperCase())).toBeTruthy();
    // Le contexte arrive replié (début du texte sur une ligne) ; un appui le déplie, un autre le referme.
    const contexte = () => screen.getByRole('button', { name: x.entrainement.contexte });
    expect(contexte().props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(contexte());
    expect(contexte().props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText('Rappel : diviser par le PGCD.')).toBeTruthy();
    await fireEvent.press(contexte());
    expect(contexte().props.accessibilityState).toMatchObject({ expanded: false });
    // Ouvrir le corrigé ne marque plus rien.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirCorrige }));
    expect(mockDepenser).toHaveBeenCalledWith('exercise_solution', 'e1');
    await waitFor(() => expect(screen.getByText('6/8 = 3/4.')).toBeTruthy());
    expect(screen.getByText(`✓ ${x.entrainement.corrige.toUpperCase()}`)).toBeTruthy();
    expect(await lireExercicesFaits()).toEqual({});
    expect(screen.queryByText('Rappel : diviser par le PGCD.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirEnonce }));
    expect(screen.getByText('Rappel : diviser par le PGCD.')).toBeTruthy();
    // « Suivant » : « Tu as fini cet exercice ? » ; « Oui » marque fait puis enchaîne.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.exerciceSuivant }));
    expect(screen.getByText(x.entrainement.finiTitre)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.finiOui }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e2', cours: '1' } }));
    expect(await lireExercicesFaits()).toEqual({ e1: true });
  });

  it('exercice : plus de crédits → feuille du bas « Recharger », visible sans défiler', async () => {
    mockParams = { id: 'e1', cours: '1' };
    mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 2, solde: 0, contenu: null });
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirCorrige }));
    await waitFor(() => expect(screen.getByText(x.credits.rechargeTitre)).toBeTruthy());
    expect(screen.queryByText('6/8 = 3/4.')).toBeNull();
    await fireEvent.press(screen.getByText(x.credits.recharger));
    expect(router.push).toHaveBeenCalledWith('/offres?declencheur=limite');
  });

  it('exercice avec un pass : le corrigé est préchargé sans changer d’onglet', async () => {
    mockPass = true;
    mockDepenser.mockResolvedValue({ statut: 'unlimited', cout: 0, solde: 0, contenu: { correction: [{ type: 'paragraph', content: [{ type: 'text', text: '6/8 = 3/4.' }] }] } });
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(mockDepenser).toHaveBeenCalledWith('exercise_solution', 'e1'));
    expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy();
    expect(screen.getByRole('button', { name: x.entrainement.voirCorrige })).toBeTruthy();
    expect(screen.queryByText('6/8 = 3/4.')).toBeNull();
    expect(screen.queryByLabelText(fr.profil.chargement)).toBeNull();
    // L'action explicite ouvre ensuite le corrigé déjà chargé.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirCorrige }));
    await waitFor(() => expect(screen.getByText('6/8 = 3/4.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.voirEnonce }));
    expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy();
    expect(screen.getByRole('button', { name: x.entrainement.voirCorrige })).toBeTruthy();
    expect(screen.queryByLabelText(fr.profil.chargement)).toBeNull();
    expect(screen.queryByText(/Inclus dans ton pass/)).toBeNull();
  });

  it('exercice : « Pas encore » enchaîne sans marquer ; un exercice fait ne demande rien', async () => {
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.exerciceSuivant }));
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.finiPasEncore }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/entrainement/exercice', params: { id: 'e2', cours: '1' } });
    expect(await lireExercicesFaits()).toEqual({});
    await AsyncStorage.setItem('entrainement.exercicesFaits', JSON.stringify({ e1: true }));
    (router.replace as jest.Mock).mockClear();
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.fait)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.exerciceSuivant }));
    expect(screen.queryByText(x.entrainement.finiTitre)).toBeNull();
    expect(router.replace).toHaveBeenCalled();
  });

  it('exercice : en quittant après plus de 10 s, « Tu t’arrêtes là ? »', async () => {
    const maintenant = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockParams = { id: 'e1', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Simplifie la fraction 6/8.')).toBeTruthy());
    const quitter = async () => {
      const e = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
      await act(async () => mockSortie?.(e));
      return e;
    };
    // Moins de 10 s : on sort sans rien demander.
    expect((await quitter()).preventDefault).not.toHaveBeenCalled();
    maintenant.mockReturnValue(1_000_000 + 11_000);
    expect((await quitter()).preventDefault).toHaveBeenCalled();
    expect(screen.getByText(x.entrainement.arretTitre)).toBeTruthy();
    // « Rester » referme ; « Le finir plus tard » sort sans marquer.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.arretRester }));
    expect(screen.queryByText(x.entrainement.arretTitre)).toBeNull();
    await quitter();
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.arretPlusTard }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    expect(await lireExercicesFaits()).toEqual({});
    maintenant.mockRestore();
  });

  it('exercice sans corrigé ni énoncé structuré : la description, et le dit', async () => {
    mockParams = { id: 'e2', cours: '1' };
    await monter(<ExerciceLibre />);
    await waitFor(() => expect(screen.getByText('Comparer 1/2 et 2/3.')).toBeTruthy());
    expect(screen.getByText(x.entrainement.corrigeBientot)).toBeTruthy();
    expect(screen.queryByRole('button', { name: x.entrainement.voirCorrige })).toBeNull();
    // Sans corrigé, on marque l'exercice soi-même, sans feuille ; dernier exercice : « Terminer », retour au chapitre.
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.marquerFait }));
    await waitFor(() => expect(screen.getByRole('button', { name: x.entrainement.annulerFait })).toBeTruthy());
    expect(await lireExercicesFaits()).toEqual({ e2: true });
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.terminer }));
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

  it('fin de chapitre : « Plus tard » ramène à la liste des chapitres de la matière, pas à la dernière leçon', async () => {
    await marquerLue(11, 1);
    await marquerLue(12, 1);
    mockParams = { cours: '1', nom: 'Fractions', matiere: 'Maths' };
    await monter(<FinChapitre />);
    await waitFor(() => expect(screen.getByText(x.entrainement.finTitre)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.entrainement.plusTard }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/cours/matiere', params: { nom: 'Maths' } });
    expect(router.back).not.toHaveBeenCalled();
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
