import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_DERNIER, CLE_ERREURS, CLE_HISTORIQUE, convertir, jourLocal, type LigneMission } from '@/services/mission';
import { enregistrerProfil } from '@/services/profil';
import { CLE_PREMIERE_OUVERTURE, CLE_RAPPEL } from '@/services/rappels';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Accueil, titreMission } from '../Accueil';
import { FinMission } from '../FinMission';
import { Mission } from '../Mission';
import { RefaireErreurs } from '../RefaireErreurs';

const mockRpc = jest.fn();
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect: effet } = jest.requireActual('react');
    effet(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
let mockPret: string | null = 'u1';
let mockInvite = false;
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => mockPret, useSession: () => ({ session: { user: { is_anonymous: mockInvite } } }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetBackdrop: () => null };
});
const mockPermission = jest.fn();
const mockProgrammer = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
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
const T = { fr, en };
const SOIR = new Date(2026, 9, 1, 20, 0);

beforeEach(async () => {
  jest.clearAllMocks();
  mockPret = 'u1';
  mockInvite = false;
  mockPermission.mockResolvedValue({ granted: true });
  await AsyncStorage.clear();
  await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'actif', le: '2026-09-01T00:00:00Z' }));
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockRpc.mockResolvedValue({ data: LIGNES, error: null });
});
afterAll(() => changerLangue('fr'));

it('titre de la carte : deux premiers chapitres', () => {
  expect(titreMission(null)).toBeNull();
  expect(titreMission({ jour: 'x', source: 'serveur', questions: [{ chapitre: 'A' }, { chapitre: 'A' }, { chapitre: 'B' }, { chapitre: 'C' }] as never })).toBe('A, B');
});

describe.each(['fr', 'en'] as const)('C1 à C3 · mission du jour (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('accueil : salutation du soir, chapitres et matières de la mission, commencer en 1 appui', async () => {
    await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(['2026-09-29', '2026-09-30']));
    await monter(<Accueil maintenant={SOIR} />);
    expect(screen.getByText(x.mission.bonsoir)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Chapitre 1, Chapitre 2')).toBeTruthy());
    expect(screen.getByText('Chimie')).toBeTruthy();
    expect(screen.getByLabelText(x.mission.serieLibelle.replace('{{n}}', '2'))).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('daily_mission_lessons', expect.objectContaining({ p_level: '3e', p_country: 'CM', p_day: '2026-10-01' }));
    await fireEvent.press(screen.getByRole('button', { name: x.mission.commencer }));
    expect(router.push).toHaveBeenCalledWith('/mission');
  });

  it('accueil : mission déjà faite aujourd’hui', async () => {
    await AsyncStorage.setItem(CLE_DERNIER, JSON.stringify({ jour: '2026-10-01', score: 4, total: 5, chapitres: [], serie: 1 }));
    await monter(<Accueil maintenant={SOIR} />);
    await waitFor(() => expect(screen.getByText(x.mission.faite)).toBeTruthy());
    expect(screen.getByRole('button', { name: x.mission.refaire })).toBeTruthy();
  });

  it('mission : 5 questions, correction, puis fin enregistrée', async () => {
    await monter(<Mission />);
    await waitFor(() => expect(screen.getByText('Question 1 ?')).toBeTruthy());
    expect(suivre).toHaveBeenCalledWith('mission_started', { source: 'serveur', total: 5 });
    for (let i = 1; i <= 5; i++) {
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 5 ? x.mission.terminer : x.miniTest.suivant }));
    }
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mission/terminee'));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ day: jourLocal(), level: '3e', score: 4, total: 5 }));
    expect(suivre).toHaveBeenCalledWith('mission_completed', expect.objectContaining({ score: 4, total: 5, serie: 1 }));
  });

  it('mission hors ligne : questions embarquées', async () => {
    mockRpc.mockRejectedValue(new Error('hors ligne'));
    await monter(<Mission />);
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('mission_started', { source: 'locale', total: 5 }));
  });

  it('fin : score, série, temps, chapitres et jour de grâce', async () => {
    await AsyncStorage.setItem(
      CLE_DERNIER,
      JSON.stringify({ jour: '2026-10-01', score: 3, total: 4, dureeS: 700, serie: 6, graceUtilisee: false, chapitres: [{ chapitre: 'Fractions', matiere: 'logique', bonnes: 2, total: 3 }] }),
    );
    await monter(<FinMission />);
    await waitFor(() => expect(screen.getByText(x.mission.finTitre)).toBeTruthy());
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText(x.mission.joursDeSuite)).toBeTruthy();
    expect(screen.getByText(x.mission.minutes.replace('{{n}}', '12'))).toBeTruthy();
    expect(screen.getByLabelText('Fractions : 2/3')).toBeTruthy();
    expect(screen.getByText(x.mission.grace)).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: x.mission.fin })[1]);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText(x.mission.revoirTitre)).toBeNull();
  });

  it('fin avec erreurs : revoir les leçons ratées et refaire mes erreurs', async () => {
    await AsyncStorage.setItem(
      CLE_DERNIER,
      JSON.stringify({ jour: '2026-10-01', score: 1, total: 3, dureeS: 90, serie: 1, graceUtilisee: false, chapitres: [], erreurs: 2, coursRates: [{ id: 42, nom: 'Forces', erreurs: 2 }] }),
    );
    await monter(<FinMission />);
    await waitFor(() => expect(screen.getByText(x.mission.revoirTitre)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: `Forces. ${x.mission.erreursN.replace('{{n}}', '2')}` }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/chapitre', params: { id: '42', nom: 'Forces' } });
    expect(suivre).toHaveBeenCalledWith('mission_lesson_review_opened', { cours: 42 });
    await fireEvent.press(screen.getByRole('button', { name: x.mission.refaireErreurs.replace('{{n}}', '2') }));
    expect(router.push).toHaveBeenCalledWith('/mission/erreurs');
  });

  it('refaire mes erreurs : rejoue les questions ratées', async () => {
    const q = convertir(ligne(7), { vrai: 'Vrai', faux: 'Faux' }, () => 0)!;
    await AsyncStorage.setItem(CLE_ERREURS, JSON.stringify([q]));
    await monter(<RefaireErreurs />);
    await waitFor(() => expect(screen.getByText('Question 7 ?')).toBeTruthy());
  });

  it('fin de la première mission : explique le rappel puis demande la permission', async () => {
    await AsyncStorage.removeItem(CLE_RAPPEL);
    await AsyncStorage.setItem(CLE_DERNIER, JSON.stringify({ jour: '2026-10-01', score: 5, total: 5, dureeS: 90, serie: 1, graceUtilisee: false, chapitres: [] }));
    await monter(<FinMission />);
    await waitFor(() => expect(screen.getByText(x.rappel.titre)).toBeTruthy());
    expect(suivre).toHaveBeenCalledWith('notification_prompt_shown', { source: 'fin_mission' });
    await fireEvent.press(screen.getByRole('button', { name: x.rappel.oui }));
    await waitFor(() => expect(screen.queryByText(x.rappel.titre)).toBeNull());
    expect(mockProgrammer).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ title: x.rappel.notifTitre }), trigger: expect.objectContaining({ hour: 19 }) }));
    expect(suivre).toHaveBeenCalledWith('notification_prompt_answered', { choix: 'accepte' });
  });

  it('rappel refusé par le système : explication, rien de programmé', async () => {
    await AsyncStorage.removeItem(CLE_RAPPEL);
    mockPermission.mockResolvedValue({ granted: false });
    await AsyncStorage.setItem(CLE_DERNIER, JSON.stringify({ jour: '2026-10-01', score: 5, total: 5, dureeS: 90, serie: 1, graceUtilisee: false, chapitres: [] }));
    await monter(<FinMission />);
    await waitFor(() => expect(screen.getByText(x.rappel.titre)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.rappel.oui }));
    await waitFor(() => expect(screen.getByText(x.rappel.refuse)).toBeTruthy());
    expect(mockProgrammer).not.toHaveBeenCalled();
  });

  it('accueil : invité depuis quelques jours avec une série, rappel de créer son compte', async () => {
    mockInvite = true;
    await AsyncStorage.setItem(CLE_PREMIERE_OUVERTURE, '2026-09-27T08:00:00Z');
    await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(['2026-09-30']));
    await monter(<Accueil maintenant={SOIR} />);
    await waitFor(() => expect(screen.getByText(x.compteRequis.rappelTitre)).toBeTruthy());
    expect(suivre).toHaveBeenCalledWith('account_prompt_shown', { raison: 'rappel' });
  });

  it('accueil : pas de rappel de compte le premier jour', async () => {
    mockInvite = true;
    await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(['2026-09-30']));
    await monter(<Accueil maintenant={SOIR} />);
    await waitFor(() => expect(screen.getByText('Chapitre 1, Chapitre 2')).toBeTruthy());
    expect(screen.queryByText(x.compteRequis.rappelTitre)).toBeNull();
  });

  it('refaire mes erreurs : rien à refaire', async () => {
    await monter(<RefaireErreurs />);
    await waitFor(() => expect(screen.getByText(x.mission.aucuneErreur)).toBeTruthy());
  });
});

