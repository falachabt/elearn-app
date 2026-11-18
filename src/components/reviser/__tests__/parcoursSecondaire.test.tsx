import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Reviser } from '../Reviser';

const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => false) },
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
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));

const lecon = (id: number, nom: string) => ({ kind: 'lesson', course_id: 1, course: 'Structure atomique', subject: 'Chimie', lesson_id: id, lesson: nom, minutes: 6 });
const quiz = { kind: 'quiz', course_id: 1, course: 'Structure atomique', subject: 'Chimie', quiz_id: 'q1', quiz: 'Quiz atome', questions: 5, minutes: 4 };

// Mardi 17 novembre 2026 : séance du jour (leçon + quiz), mercredi une leçon ; la veille n'a pas été terminée.
const PLAN = {
  status: 'ready',
  minutes_per_day: 30,
  target: { type: 'examen', label: 'Baccalauréat', date: '2027-05-25', status: 'reprise' },
  days_left: 189,
  coverage: { lessons_total: 4, lessons_scheduled: 4 },
  weeks: [
    {
      start: '2026-11-16',
      phase: 'learning',
      days: [
        { day: '2026-11-16', phase: 'learning', minutes: 30, items: [lecon(7, 'Les ions')], done: false },
        { day: '2026-11-17', phase: 'learning', minutes: 30, items: [lecon(1, 'Introduction à la structure atomique'), quiz], done: false },
        { day: '2026-11-18', phase: 'learning', minutes: 30, items: [lecon(2, 'Temps et aspects verbaux')], done: false },
      ],
    },
  ],
};

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (reglage: 'clair' | 'sombre') =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage={reglage}><Reviser /></ThemeProvider></SafeAreaProvider>);

function serveur(plan: unknown) {
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'my_study_plan') return { data: plan, error: null };
    return { data: [], error: null };
  });
}

beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 10, 17, 10, 0) });
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'BF', termine: true } as never);
});
afterEach(() => jest.useRealTimers());

describe.each(['clair', 'sombre'] as const)('Réviser > Parcours (%s)', (reglage) => {
  it('quatre onglets, Parcours avant Cours, et Réviser s’ouvre sur Cours', async () => {
    serveur(PLAN);
    await monter(reglage);
    const onglets = screen.getAllByRole('tab');
    expect(onglets).toHaveLength(4);
    const libelles = [fr.reviser.ongletParcours, fr.annales.ongletCours, fr.entrainement.onglet, fr.annales.onglet];
    libelles.forEach((l, i) => expect(within(onglets[i]).getByText(l)).toBeTruthy());
    // Cours est l'onglet actif à l'ouverture, pas Parcours.
    expect(onglets.map((o) => o.props.accessibilityState.selected)).toEqual([false, true, false, false]);
    // Aucun appel au planning tant que l'onglet Parcours n'est pas affiché.
    expect(mockRpc).not.toHaveBeenCalledWith('my_study_plan', expect.anything());
    expect(screen.queryByText(fr.parcours.commencer.split('{{')[0])).toBeNull();
  });

  it('arrivée depuis l’accueil (onglet=parcours) : timeline numérotée, passé à refaire, étape du jour et bouton', async () => {
    mockParams = { onglet: 'parcours' };
    serveur(PLAN);
    await monter(reglage);
    await screen.findByText('Introduction à la structure atomique');
    // Hier non terminé : à refaire, sans numéro.
    expect(screen.getByText(fr.parcours.aRefaire)).toBeTruthy();
    expect(screen.getByText('Les ions')).toBeTruthy();
    // Aujourd'hui : 1 et 2 ; aperçu de demain : 3.
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Temps et aspects verbaux')).toBeTruthy();
    // Un seul bouton vert, sur l'étape du jour en cours.
    await fireEvent.press(screen.getByRole('button', { name: fr.parcours.commencer.replace('{{titre}}', 'Introduction à la structure atomique') }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/cours/lecon',
      params: expect.objectContaining({ id: '1', cours: '1', provenance: 'planning', planningJour: '2026-11-17' }),
    });
  });

  it('sans programme : invitation à préparer, qui ouvre l’assistant existant', async () => {
    mockParams = { onglet: 'parcours' };
    serveur({ status: 'empty' });
    await monter(reglage);
    await screen.findByText(fr.parcours.titreSansProgramme);
    await fireEvent.press(screen.getByText(fr.parcours.preparer));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning', params: { source: 'accueil' } });
  });

  it('Ajuster rouvre l’assistant avec les réglages actuels ; hors ligne, il est désactivé', async () => {
    mockParams = { onglet: 'parcours' };
    serveur(PLAN);
    await monter(reglage);
    await screen.findByText('Introduction à la structure atomique');
    await fireEvent.press(screen.getByRole('button', { name: fr.parcours.ajuster }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning', params: { source: 'accueil', ajuster: '1' } });
  });

  it('en préparation : message et squelettes, sans timeline', async () => {
    mockParams = { onglet: 'parcours' };
    serveur({ status: 'preparing' });
    await monter(reglage);
    await screen.findByText(fr.parcours.preparation);
  });

  it('erreur du serveur : message et bouton pour réessayer', async () => {
    mockParams = { onglet: 'parcours' };
    mockRpc.mockImplementation(async (nom: string) => (nom === 'my_study_plan' ? { data: null, error: { name: 'PostgrestError', message: 'boom' } } : { data: [], error: null }));
    await monter(reglage);
    await screen.findByText(fr.parcours.erreurTitre);
    serveur(PLAN);
    await fireEvent.press(screen.getByText(fr.parcours.reessayer));
    await waitFor(() => expect(screen.getByText('Introduction à la structure atomique')).toBeTruthy());
  });
});
