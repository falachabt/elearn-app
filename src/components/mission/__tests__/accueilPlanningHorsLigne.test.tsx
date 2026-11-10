import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { CLE_ALERTE_SERIE, type LigneMission } from '@/services/mission';
import { enregistrerProfil } from '@/services/profil';
import { CLE_RAPPEL } from '@/services/rappels';
import { CLE_RYTHME } from '@/services/rythme';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Accueil } from '../Accueil';

const mockRpc = jest.fn();
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect: effet } = jest.requireActual('react');
    effet(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
jest.mock('@/services/assistantConfiguration', () => ({
  lireProgressionAssistant: jest.fn(async () => ({ mission: false, lecon: false, quiz: false, exercice: false, correction: false, fil: false })),
  estAssistantMasque: jest.fn(async () => false),
  enregistrerCompletionAssistant: jest.fn(async () => undefined),
}));
let mockPret: string | null = 'u1';
let mockInvite = false;
let mockMetadata: Record<string, unknown> = {};
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => mockPret, useSession: () => ({ session: { user: { id: 'u1', is_anonymous: mockInvite, user_metadata: mockMetadata } } }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetFlatList: passe, BottomSheetScrollView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});
const mockPermission = jest.fn();
const mockLirePermission = jest.fn();
const mockProgrammer = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockLirePermission(),
  requestPermissionsAsync: () => mockPermission(),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: (...a: unknown[]) => mockProgrammer(...a),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), from: () => ({ insert: mockInsert }) }) }));

const ligne = (i: number, sujet = 'Maths'): LigneMission => ({
  question_id: i,
  quiz_id: `q${i}`,
  chapter: `Chapitre ${i}`,
  subject: sujet,
  kind: 'select',
  prompt: `Question ${i} ?`,
  options: [
    { id: 'a', text: `Bonne ${i}` },
    { id: 'b', text: `Fausse ${i}` },
  ],
  correct: ['a'],
  explanation: 'Explication.',
});
const LIGNES = [ligne(1), ligne(2, 'Chimie'), ligne(3), ligne(4), ligne(5)];

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);


beforeEach(async () => {
  jest.clearAllMocks();
  mockPret = 'u1';
  mockInvite = false;
  mockPermission.mockResolvedValue({ granted: true });
  // Notifications déjà autorisées par défaut : la proposition d'autoriser n'apparaît que dans ses propres tests.
  mockLirePermission.mockResolvedValue({ granted: true, canAskAgain: true });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'actif', le: '2026-09-01T00:00:00Z' }));
  await AsyncStorage.setItem(CLE_RYTHME, '20');
  // Alerte de série déjà montrée ce jour-là : la feuille de danger ne s'ouvre pas dans les autres tests (elle masque l'accueil).
  await AsyncStorage.setItem(CLE_ALERTE_SERIE, '2026-10-01');
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockRpc.mockResolvedValue({ data: LIGNES, error: null });
});
afterAll(() => changerLangue('fr'));


/**
 * Issue #74, retour de test terrain (Benny, 23 octobre) : au démarrage à froid hors ligne, la carte du programme et le
 * compte à rebours disparaissaient de l'accueil. Les tests de l'accueil simulaient jusqu'ici un compte sans identifiant,
 * donc la carte n'y était jamais montée et le trou restait invisible. Ici : session présente (identifiant u1), copies
 * locales semées (calendrier de la classe, planning prêt), et toutes les RPC en erreur réseau — la carte doit rester.
 */
const RESEAU = { name: 'TypeError', message: 'Network request failed' };
const leconTest = (id: number, cours: number, nom: string) => ({ kind: 'lesson', course_id: cours, course: `Cours ${cours}`, subject: 'Mathématique', lesson_id: id, lesson: nom, minutes: 15 });
const PLAN_TEST = {
  status: 'ready',
  minutes_per_day: 30,
  target: { type: 'examen', label: 'Baccalauréat', date: '2027-05-25', status: 'reprise' },
  days_left: 214,
  coverage: { lessons_total: 10, lessons_scheduled: 10 },
  weeks: [
    {
      start: '2026-10-19',
      phase: 'learning',
      days: [
        { day: '2026-10-23', phase: 'learning', minutes: 30, items: [leconTest(2, 1, 'Définition'), leconTest(4, 3, 'Noms')], done: false },
        { day: '2026-10-24', phase: 'learning', minutes: 30, items: [leconTest(5, 1, 'Suites')], done: false },
        { day: '2026-10-25', phase: 'learning', minutes: 30, items: [leconTest(6, 2, 'Cellule')], done: false },
      ],
    },
  ],
};

it('hors ligne avec les copies locales : la carte du programme reste affichée sur l’accueil', async () => {
  mockPret = 'u1';
  mockMetadata = {};
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  await AsyncStorage.setItem('calendrier.classe.Tle.CM', JSON.stringify([{ type: 'examen', libelle: 'Baccalauréat', date_cible: '2027-05-25', statut: 'reprise', annee_scolaire: '2026-2027' }]));
  await AsyncStorage.setItem('planning.copie.u1', JSON.stringify(PLAN_TEST));
  // Démarrage à froid hors ligne : chaque RPC répond par une erreur réseau.
  mockRpc.mockImplementation(async () => ({ data: null, error: RESEAU }));
  await monter(<Accueil maintenant={new Date()} />);
  expect(await screen.findByText('Mon programme de révision')).toBeTruthy();
});
