import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { enregistrerProfil } from '@/services/profil';
import { noterFinChapitreVue } from '@/services/entrainement';
import { lireCorrection } from '@/services/correction';
import { lireLues, marquerLue } from '@/services/reviser';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Chapitre } from '../Chapitre';
import { FicheCours } from '../FicheCours';
import { LeconLecteur } from '../LeconLecteur';
import { MatiereCours } from '../MatiereCours';
import { QuizLecon } from '../QuizLecon';
import { Reviser } from '../Reviser';

const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});
let mockPret: string | null = 'u1';
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => mockPret, useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const COURS = [
  { course_id: 1, name: 'Fractions', subject: 'Mathématique', lessons: 2 },
  { course_id: 2, name: 'Pythagore', subject: 'Mathématique', lessons: 1 },
  { course_id: 3, name: 'Le conte', subject: 'Français', lessons: 1 },
];
const LECONS = [
  { lesson_id: 11, name: 'Définition', reading_minutes: 5 },
  { lesson_id: 12, name: 'Additionner', reading_minutes: 8 },
];
const CONTENU = (id: number) => ({
  lesson_id: id,
  course_id: 1,
  name: id === 11 ? 'Définition' : 'Additionner',
  content: [
    { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Objectif' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'On calcule ' }, { type: 'inlineMath', props: { latex: '\\frac{2}{3}' } }] },
  ],
  content_compressed: null,
});

const QUIZ = [1, 2, 3].map((i) => ({
  question_id: i,
  quiz_id: 'q',
  chapter: 'Fractions',
  subject: 'Mathématique',
  kind: 'select',
  prompt: `Question ${i} ?`,
  options: [{ id: 'a', text: `Bonne ${i}` }, { id: 'b', text: `Fausse ${i}` }],
  correct: ['a'],
  explanation: 'Parce que.',
}));

function repondre(nom: string, args: Record<string, number>) {
  if (nom === 'revision_courses') return { data: COURS, error: null };
  if (nom === 'contest_courses') return { data: [{ course_id: 8, name: 'Mécanique', subject: 'Physique', lessons: 3 }], error: null };
  if (nom === 'course_lessons') return { data: LECONS, error: null };
  if (nom === 'course_summary') return { data: args.p_course === 1 ? [{ summary_id: 5, name: 'Fiche Fractions', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'À retenir' }] }] }] : [], error: null };
  if (nom === 'lesson_quiz') return { data: args.p_course === 1 ? QUIZ : [], error: null };
  if (nom === 'lesson_content') return { data: [CONTENU(args.p_lesson)], error: null };
  return { data: null, error: new Error(nom) };
}

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  mockPret = 'u1';
  await AsyncStorage.clear();
  mockParams = {};
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockRpc.mockImplementation(async (nom: string, args: Record<string, number>) => repondre(nom, args));
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('D1, D2 · réviser (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));
  const vu = (n: number) => x.reviser.vu.replace('{{n}}', String(n));

  it('matières de la classe en tuiles, part lue, ouverture d’une matière', async () => {
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1 }));
    await monter(<Reviser />);
    await waitFor(() => expect(screen.getByRole('button', { name: `Maths, ${vu(33)}` })).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('revision_courses', { p_level: '3e', p_country: 'CM' });
    expect(screen.getByRole('button', { name: `Français, ${vu(0)}` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: `Maths, ${vu(33)}` }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/matiere', params: { nom: 'Maths' } });
  });

  it('en-tête : le compteur de crédits est à côté du titre (squelette tant que le solde se charge)', async () => {
    await monter(<Reviser />);
    expect(await screen.findByText(x.reviser.titre)).toBeTruthy();
    expect(screen.getByTestId('compteur-chargement', { includeHiddenElements: true })).toBeTruthy();
  });

  it('erreur réseau sans copie, puis nouvel essai', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('hors ligne') });
    await monter(<Reviser />);
    await waitFor(() => expect(screen.getByText(x.reviser.erreur)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.reessayer }));
    await waitFor(() => expect(screen.getByText('Maths')).toBeTruthy());
  });

  it('chapitres d’une matière', async () => {
    mockParams = { nom: 'Maths' };
    await monter(<MatiereCours />);
    await waitFor(() => expect(screen.getByText('Fractions')).toBeTruthy());
    expect(screen.queryByText('Le conte')).toBeNull();
    await fireEvent.press(screen.getByText('Fractions'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/chapitre', params: { id: '1', nom: 'Fractions', matiere: 'Maths', couleur: expect.any(String) } });
  });

  it('candidat : les chapitres de la matière viennent de son concours', async () => {
    await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENSPD', nom: 'ENSPD' }, termine: true });
    mockParams = { nom: 'Physique' };
    await monter(<MatiereCours />);
    await waitFor(() => expect(screen.getByText('Mécanique')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('contest_courses', { p_contest: 'c1' });
  });

  it('cours terminé : à sa place, marqué Terminé ; cours commencé : Continuer sur la leçon suivante', async () => {
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1, 12: 1 }));
    mockParams = { nom: 'Maths' };
    await monter(<MatiereCours />);
    await waitFor(() => expect(screen.getByTestId('chapitre-fini-1')).toBeTruthy());
    const noms = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string).filter((l) => /Fractions|Pythagore/.test(l ?? ''));
    expect(noms[0]).toMatch(/^Fractions/);
    expect(screen.getByText(x.reviser.termine)).toBeTruthy();
    // Un cours fini n'a rien à continuer.
    expect(screen.queryByText(new RegExp(x.reviser.continuerLecon.split(' ')[0]))).toBeNull();
  });

  it('cours commencé : carte Continuer sur la leçon non validée', async () => {
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1 }));
    mockParams = { nom: 'Maths' };
    await monter(<MatiereCours />);
    await waitFor(() => expect(screen.getByText(x.reviser.continuerLecon.replace('{{n}}', '2'))).toBeTruthy());
    await fireEvent.press(screen.getByText(x.reviser.continuerLecon.replace('{{n}}', '2')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/lecon', params: { id: '12', cours: '1', matiere: 'Maths' } });
  });

  it('leçons d’un chapitre dans l’ordre', async () => {
    mockParams = { id: '1', nom: 'Fractions', matiere: 'Maths' };
    await monter(<Chapitre />);
    await waitFor(() => expect(screen.getByText('Définition')).toBeTruthy());
    await fireEvent.press(screen.getByText('Additionner'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/lecon', params: { id: '12', cours: '1', matiere: 'Maths' } });
  });

  it('leçon en cours : la première non validée d’un cours commencé, avec Continuer', async () => {
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1 }));
    mockParams = { id: '1', nom: 'Fractions', matiere: 'Maths' };
    await monter(<Chapitre />);
    await waitFor(() => expect(screen.getByText(x.reviser.continuer)).toBeTruthy());
    expect(screen.getByText(x.reviser.leconsEtiquette.replace('{{n}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByText('50 %')).toBeTruthy();
  });

  it('leçon : contenu, formule ; pas validée à l’ouverture, feuille avant la leçon suivante', async () => {
    mockParams = { id: '11', cours: '1', matiere: 'Maths' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByText('Objectif')).toBeTruthy());
    expect(screen.getByLabelText('2/3')).toBeTruthy();
    expect(screen.getByText(new RegExp(x.reviser.leconN.replace('{{n}}', '1').replace('{{total}}', '2')))).toBeTruthy();
    expect(await lireLues()).toEqual({});
    expect(screen.queryByText(x.reviser.invitationTitre)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.suivante }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(x.reviser.invitationTitre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.invitationPasser }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/cours/lecon', params: { id: '12', cours: '1', matiere: 'Maths' } });
    expect(await lireLues()).toEqual({});
  });

  it('leçon déjà validée : leçon suivante directe', async () => {
    await marquerLue(11, 1);
    mockParams = { id: '11', cours: '1', matiere: 'Maths' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByText('Objectif')).toBeTruthy());
    expect(screen.queryByRole('button', { name: x.reviser.quiz })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.suivante }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/cours/lecon', params: { id: '12', cours: '1', matiere: 'Maths' } });
  });

  it('feuille : répondre aux questions ouvre le quiz', async () => {
    mockParams = { id: '11', cours: '1' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByText('Objectif')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.suivante }));
    const boutons = screen.getAllByRole('button', { name: x.reviser.quiz });
    await fireEvent.press(boutons[boutons.length - 1]);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/quiz', params: { cours: '1', lecon: '11', suivante: '12', matiere: '' } });
  });

  it('chapitre avec fiche : ouverture de la fiche', async () => {
    mockParams = { id: '1', nom: 'Fractions', matiere: 'Maths' };
    await monter(<Chapitre />);
    await waitFor(() => expect(screen.getByText(x.reviser.fiche)).toBeTruthy());
    await fireEvent.press(screen.getByText(x.reviser.fiche));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/fiche', params: { cours: '1', nom: 'Fractions', matiere: 'Maths' } });
  });

  it('chapitre sans fiche : pas d’entrée', async () => {
    mockParams = { id: '2', nom: 'Pythagore' };
    await monter(<Chapitre />);
    await waitFor(() => expect(screen.getByText('Définition')).toBeTruthy());
    expect(screen.queryByText(x.reviser.fiche)).toBeNull();
  });

  it('fiche résumé : contenu, ou message si absente', async () => {
    mockParams = { cours: '1', nom: 'Fractions', matiere: 'Maths' };
    await monter(<FicheCours />);
    await waitFor(() => expect(screen.getByText('À retenir')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('course_summary', { p_course: 1 });
  });

  it('retour sur une fiche déjà vue : contenu tout de suite, sans chargement ni nouvelle requête', async () => {
    mockParams = { cours: '1', nom: 'Fractions', matiere: 'Maths' };
    const premiere = await monter(<FicheCours />);
    await waitFor(() => expect(screen.getByText('À retenir')).toBeTruthy());
    await premiere.unmount();
    mockRpc.mockClear();
    const retour = await monter(<FicheCours />);
    expect(retour.getByText('À retenir')).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fiche absente', async () => {
    mockParams = { cours: '2' };
    await monter(<FicheCours />);
    await waitFor(() => expect(screen.getByText(x.reviser.ficheVide)).toBeTruthy());
  });

  it('leçon : répondre aux 3 questions', async () => {
    mockParams = { id: '11', cours: '1' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.reviser.quiz })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.quiz }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/quiz', params: { cours: '1', lecon: '11', suivante: '12', matiere: '' } });
  });

  it('quiz de leçon : 3 questions puis score', async () => {
    mockParams = { cours: '1', lecon: '11' };
    await monter(<QuizLecon />);
    await waitFor(() => expect(screen.getByText('Question 1 ?')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('lesson_quiz', { p_course: 1, p_lesson: 11, p_size: 3 });
    for (const i of [1, 2, 3]) {
      await waitFor(() => expect(screen.getByText(`Question ${i} ?`)).toBeTruthy());
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 3 ? x.reviser.quizTerminer : x.miniTest.suivant }));
    }
    await waitFor(() => expect(screen.getByText(x.reviser.quizScore.replace('{{score}}', '2').replace('{{total}}', '3'))).toBeTruthy());
    expect(screen.getByText(x.reviser.quizValidee)).toBeTruthy();
    expect(await lireLues()).toEqual({ 11: 1 });
    // Pas de leçon suivante : la fin de chapitre (M5-11).
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/cours/fin', params: { cours: '1', matiere: '' } }));
  });

  it('fin de chapitre déjà vue : simple retour', async () => {
    await marquerLue(12, 1);
    await noterFinChapitreVue(1);
    mockParams = { id: '12', cours: '1' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.reviser.finChapitre })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/reviser'));
    expect(router.replace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/cours/fin' }));
  });

  async function jouerQuizLecon() {
    for (const i of [1, 2, 3]) {
      await waitFor(() => expect(screen.getByText(`Question ${i} ?`)).toBeTruthy());
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 3 ? x.reviser.quizTerminer : x.miniTest.suivant }));
    }
  }

  it('quiz de leçon réussi : la leçon est déjà cochée quand le score s’affiche (aucune course avec le retour au chapitre)', async () => {
    mockParams = { cours: '1', lecon: '11', suivante: '12' };
    await monter(<QuizLecon />);
    await jouerQuizLecon();
    await waitFor(() => expect(screen.getByText(x.reviser.quizValidee)).toBeTruthy());
    // Écrite AVANT l'écran de score, pas en arrière-plan : le chapitre, rouvert aussitôt, affiche la case cochée.
    expect(await AsyncStorage.getItem('reviser.lues')).toBe(JSON.stringify({ 11: 1 }));
  });

  it('quiz de leçon avec stockage local en échec : le score s’affiche, l’élève n’est pas bloqué', async () => {
    const setItem = jest.mocked(AsyncStorage.setItem);
    const original = setItem.getMockImplementation();
    setItem.mockRejectedValue(new Error('stockage plein'));
    try {
      mockParams = { cours: '1', lecon: '11', suivante: '12' };
      await monter(<QuizLecon />);
      await jouerQuizLecon();
      await waitFor(() => expect(screen.getByText(x.reviser.quizScore.replace('{{score}}', '2').replace('{{total}}', '3'))).toBeTruthy());
      // Le stockage a refusé d'écrire la correction : « Refaire mes erreurs » et « Revoir la correction » la lisent quand même.
      const correction = await lireCorrection();
      expect(correction?.questions).toHaveLength(3);
      expect(correction?.reponses.filter((r, i) => r !== correction.questions[i].bonne)).toHaveLength(1);
    } finally {
      if (original) setItem.mockImplementation(original);
    }
  });

  it('quiz de leçon raté : pas validée, réessayer', async () => {
    mockParams = { cours: '1', lecon: '11', suivante: '12' };
    await monter(<QuizLecon />);
    for (const i of [1, 2, 3]) {
      await waitFor(() => expect(screen.getByText(`Question ${i} ?`)).toBeTruthy());
      await fireEvent.press(screen.getByText(i === 1 ? `Bonne ${i}` : `Fausse ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 3 ? x.reviser.quizTerminer : x.miniTest.suivant }));
    }
    await waitFor(() => expect(screen.getByText(x.reviser.quizNonValidee)).toBeTruthy());
    expect(await lireLues()).toEqual({});
    expect(screen.queryByRole('button', { name: x.reviser.quizSuivante })).toBeNull();
    // La correction est enregistrée AVEC les 2 fautes : c'est elle que « Refaire mes erreurs » relit. Si elle était
    // perdue, l'écran de reprise annoncerait « aucune erreur » alors que l'élève vient d'en faire.
    const correction = await lireCorrection();
    expect(correction?.source).toBe('lecon');
    expect(correction?.contexte).toEqual({ type: 'lecon', lecon: 11, cours: 1 });
    expect(correction?.questions).toHaveLength(3);
    expect(correction?.reponses.filter((r, i) => r !== correction.questions[i].bonne)).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.quizReessayer }));
    await waitFor(() => expect(screen.getByText('Question 1 ?')).toBeTruthy());
  });

  it('fin de chapitre déjà vue, matière connue : retour à la liste des chapitres, pas à la dernière leçon', async () => {
    await marquerLue(12, 1);
    await noterFinChapitreVue(1);
    mockParams = { id: '12', cours: '1', matiere: 'Maths' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.reviser.finChapitre })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/cours/matiere', params: { nom: 'Maths' } }));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('terminer le chapitre depuis le quiz de la dernière leçon : la fin de chapitre garde la matière', async () => {
    mockParams = { cours: '1', lecon: '12', matiere: 'Maths' };
    await monter(<QuizLecon />);
    await jouerQuizLecon();
    await waitFor(() => expect(screen.getByText(x.reviser.quizValidee)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/cours/fin', params: { cours: '1', matiere: 'Maths' } }));
  });

  it('quiz de leçon sans questions', async () => {
    mockParams = { cours: '2', lecon: '21' };
    await monter(<QuizLecon />);
    await waitFor(() => expect(screen.getByText(x.reviser.quizVide)).toBeTruthy());
    expect(await lireLues()).toEqual({ 21: 2 });
  });

  it('dernière leçon : terminer le chapitre', async () => {
    await marquerLue(12, 1);
    mockParams = { id: '12', cours: '1' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.reviser.finChapitre })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/cours/fin', params: { cours: '1', matiere: '' } }));
  });

  it('fin de chapitre déjà vue : simple retour', async () => {
    await marquerLue(12, 1);
    await noterFinChapitreVue(1);
    mockParams = { id: '12', cours: '1' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.reviser.finChapitre })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.finChapitre }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/reviser'));
    expect(router.replace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/cours/fin' }));
  });

  it('leçon introuvable', async () => {
    mockRpc.mockImplementation(async () => ({ data: [], error: null }));
    mockParams = { id: '99' };
    await monter(<LeconLecteur />);
    await waitFor(() => expect(screen.getByText(x.reviser.leconErreur)).toBeTruthy());
  });
});

it('attend la session avant de lire les cours', async () => {
  mockPret = null;
  const { rerender } = await monter(<Reviser />);
  expect(mockRpc).not.toHaveBeenCalled();
  mockPret = 'u1';
  await rerender(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><Reviser /></ThemeProvider></SafeAreaProvider>);
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('revision_courses', { p_level: '3e', p_country: 'CM' }));
});
