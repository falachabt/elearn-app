import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { CLE_ALERTE_SERIE, type LigneMission } from '@/services/mission';
import { enregistrerProfil } from '@/services/profil';
import { CLE_RAPPEL } from '@/services/rappels';
import { CLE_RYTHME } from '@/services/rythme';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Accueil } from '../Accueil';

const mockRpc = jest.fn();
const mockPush = jest.fn();
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), canGoBack: jest.fn(() => false) },
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
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => mockPret, useSession: () => ({ session: { user: { id: 'u1', is_anonymous: mockInvite, user_metadata: {} } } }) }));
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
const mockLireEtatHorsLigne = jest.fn((..._a: unknown[]) => Promise.resolve(null as { statut: string } | null));
jest.mock('@/services/horsLigne', () => ({ lireEtatHorsLigne: (...a: unknown[]) => mockLireEtatHorsLigne(...a) }));
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
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  mockLireEtatHorsLigne.mockResolvedValue(null);
  mockRpc.mockResolvedValue({ data: LIGNES, error: null });
});
afterAll(() => changerLangue('fr'));

const MAINTENANT = new Date('2026-10-01T10:00:00');
// Clé de cadence de la proposition (issue #118) : littéral plutôt qu'import du service.
const CLE_PROPOSITION = 'rappel.propositionHorsLigne';

/**
 * Issue #118 : proposition proactive du téléchargement hors ligne sur l'accueil.
 * Déclencheur utilisé ici : arrivée dans l'app hors ligne (session prête « hors-ligne »).
 */
it('arrivée hors ligne, compte et profil prêts, aucun pack : la feuille propose le téléchargement', async () => {
  mockPret = 'hors-ligne';
  await monter(<Accueil maintenant={MAINTENANT} />);
  expect(await screen.findByText('Travaille même sans connexion')).toBeTruthy();
  expect(screen.getByText('Télécharger mes contenus')).toBeTruthy();
  expect(screen.getByText('Plus tard')).toBeTruthy();
  // L'affichage est noté (cadence consommée).
  const brut = await AsyncStorage.getItem(CLE_PROPOSITION);
  expect(JSON.parse(brut ?? '{}').vus).toBe(1);
});

it('« Télécharger mes contenus » envoie vers la page hors ligne', async () => {
  mockPret = 'hors-ligne';
  await monter(<Accueil maintenant={MAINTENANT} />);
  fireEvent.press(await screen.findByText('Télécharger mes contenus'));
  expect(mockPush).toHaveBeenCalledWith('/hors-ligne');
});

it('pack partiel : la variante reprise est proposée', async () => {
  mockPret = 'hors-ligne';
  mockLireEtatHorsLigne.mockResolvedValue({ statut: 'partiel' });
  await monter(<Accueil maintenant={MAINTENANT} />);
  expect(await screen.findByText('Termine ton téléchargement')).toBeTruthy();
  expect(screen.getByText('Reprendre')).toBeTruthy();
});

it('pack déjà téléchargé : aucune proposition', async () => {
  mockPret = 'hors-ligne';
  mockLireEtatHorsLigne.mockResolvedValue({ statut: 'termine' });
  await monter(<Accueil maintenant={MAINTENANT} />);
  expect(await screen.findByText('Aide par photo')).toBeTruthy();
  expect(screen.queryByText('Travaille même sans connexion')).toBeNull();
  expect(screen.queryByText('Termine ton téléchargement')).toBeNull();
});

it('invité : aucune proposition, même hors ligne sans pack', async () => {
  mockPret = 'hors-ligne';
  mockInvite = true;
  await monter(<Accueil maintenant={MAINTENANT} />);
  expect(await screen.findByText('Aide par photo')).toBeTruthy();
  expect(screen.queryByText('Travaille même sans connexion')).toBeNull();
});

it('cadence épuisée (3 affichages) : aucune proposition', async () => {
  mockPret = 'hors-ligne';
  await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ vus: 3, le: '2026-09-20T10:00:00.000Z' }));
  await monter(<Accueil maintenant={MAINTENANT} />);
  expect(await screen.findByText('Aide par photo')).toBeTruthy();
  expect(screen.queryByText('Travaille même sans connexion')).toBeNull();
});
