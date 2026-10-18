import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_COPIE_PLANNING } from '@/services/planning';
import { CLE_LUES } from '@/services/reviser';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { PlanningJour } from '../PlanningJour';

const t = fr.planning;
const mockRpc = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));

const lecon = (id: number, cours: number, nom: string, matiere: string) => ({ kind: 'lesson', course_id: cours, course: `Cours ${cours}`, subject: matiere, lesson_id: id, lesson: nom, minutes: 20 });
const plan = (fait20 = false, fait22 = false) => ({
  status: 'ready',
  minutes_per_day: 45,
  target: { type: 'examen', label: 'Baccalauréat', date: '2027-06-23', status: 'reprise' },
  days_left: 246,
  coverage: { lessons_total: 4, lessons_scheduled: 4 },
  weeks: [
    {
      start: '2026-10-19',
      phase: 'learning',
      days: [
        { day: '2026-10-20', phase: 'learning', minutes: 45, items: [lecon(2, 1, 'Définition', 'Mathématique'), lecon(4, 3, 'Noms', 'Français')], done: fait20 },
        { day: '2026-10-22', phase: 'past_papers', minutes: 45, items: [{ kind: 'past_papers' }, { kind: 'final_review' }], done: fait22 },
      ],
    },
  ],
});

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (reglage: 'clair' | 'sombre' = 'clair') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}>
        <PlanningJour />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const erreurReseau = { name: 'TypeError', message: 'Network request failed' };
const serveur = (donnees: unknown, erreur?: unknown) =>
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'my_study_plan') return erreur ? { data: null, error: erreur } : { data: donnees, error: null };
    if (nom === 'study_plan_mark_done') return { data: true, error: null };
    return { data: null, error: null };
  });

beforeEach(async () => {
  mockRpc.mockReset();
  mockParams = { jour: '2026-10-20' };
  (router.push as jest.Mock).mockClear();
  (suivre as jest.Mock).mockClear();
  await AsyncStorage.clear();
});

describe.each(['clair', 'sombre'] as const)('Page d’une séance (%s)', (reglage) => {
  it('titre en toutes lettres, phase et durée, avancement, tâches dans l’ordre et bouton pour terminer', async () => {
    serveur(plan());
    await monter(reglage);
    await screen.findByText('Mardi 20 octobre');
    expect(screen.getByText(/APPRENTISSAGE · 45 MIN/)).toBeTruthy();
    expect(screen.getByText('0 sur 2 faits')).toBeTruthy();
    expect(screen.getByText('Définition')).toBeTruthy();
    expect(screen.getByText('Noms')).toBeTruthy();
    expect(screen.getByText(t.terminer)).toBeTruthy();
  });

  it('toucher une leçon ouvre cette leçon', async () => {
    serveur(plan());
    await monter(reglage);
    await screen.findByText('Définition');
    await fireEvent.press(screen.getByRole('button', { name: /Ouvrir Définition/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cours/lecon', params: { id: '2', cours: '1', matiere: 'Mathématique' } });
    expect(suivre).toHaveBeenCalledWith('planning_task_opened', { genre: 'lecon' });
  });

  it('annales et révision finale ouvrent Réviser', async () => {
    mockParams = { jour: '2026-10-22' };
    serveur(plan());
    await monter(reglage);
    await screen.findByText(t.elements.annales);
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`Ouvrir ${t.elements.revisionFinale}`) }));
    expect(router.push).toHaveBeenCalledWith('/reviser');
  });

  it('terminer la séance : le serveur reçoit le jour, « Bravo » s’affiche, le bouton disparaît', async () => {
    serveur(plan());
    await monter(reglage);
    await screen.findByText(t.terminer);
    await fireEvent.press(screen.getByText(t.terminer));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-20', p_done: true }));
    await screen.findByText(t.terminee);
    expect(screen.queryByText(t.terminer)).toBeNull();
    expect(screen.getByText(t.rouvrir)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('planning_day_checked', { fait: true });
  });

  it('terminer échoue : la séance reste à faire et un message le dit', async () => {
    serveur(plan());
    mockRpc.mockImplementation(async (nom: string) => (nom === 'my_study_plan' ? { data: plan(), error: null } : { data: null, error: { message: 'boom' } }));
    await monter(reglage);
    await fireEvent.press(await screen.findByText(t.terminer));
    await screen.findByText(t.erreurCocher);
    expect(screen.getByText(t.terminer)).toBeTruthy();
  });

  it('une leçon déjà validée dans Réviser compte comme faite', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1 }));
    serveur(plan());
    await monter(reglage);
    await screen.findByText('1 sur 2 faits');
    expect(screen.getByText(/Déjà validée/)).toBeTruthy();
    expect(screen.getByText(t.terminer)).toBeTruthy();
  });

  it('toutes les leçons déjà validées : la séance se coche toute seule', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1, '4': 3 }));
    serveur(plan());
    await monter(reglage);
    await screen.findByText(t.terminee);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-20', p_done: true }));
    expect(screen.queryByText(t.terminer)).toBeNull();
    // Cochée par les leçons seules : pas de « non faite », elle se recocherait aussitôt.
    expect(screen.queryByText(t.rouvrir)).toBeNull();
  });

  it('séance cochée à la main : on peut la marquer comme non faite', async () => {
    mockParams = { jour: '2026-10-22' };
    serveur(plan(false, true));
    await monter(reglage);
    await screen.findByText(t.terminee);
    await fireEvent.press(screen.getByText(t.rouvrir));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-22', p_done: false }));
    await screen.findByText(t.terminer);
  });

  it('un jour absent du planning : message et retour', async () => {
    mockParams = { jour: '2026-10-21' };
    serveur(plan());
    await monter(reglage);
    await screen.findByText(t.jourAbsent);
    await fireEvent.press(screen.getByText(t.retourPlanning));
    expect(router.back).toHaveBeenCalled();
  });

  it('hors ligne avec une copie : la séance se lit, mais ne se termine pas', async () => {
    await AsyncStorage.setItem(CLE_COPIE_PLANNING('u1'), JSON.stringify(plan()));
    serveur(null, erreurReseau);
    await monter(reglage);
    await screen.findByText('Définition');
    expect(screen.getByRole('button', { name: t.terminer }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByText(t.terminer));
    expect(mockRpc).not.toHaveBeenCalledWith('study_plan_mark_done', expect.anything());
  });

  it('hors ligne sans copie : message « pas de réseau » et bouton pour réessayer', async () => {
    serveur(null, erreurReseau);
    await monter(reglage);
    await screen.findByText(t.horsLigneTitre);
    serveur(plan());
    await fireEvent.press(screen.getByText(t.reessayer));
    await screen.findByText('Mardi 20 octobre');
  });

  it('le bouton retour de l’en-tête revient au planning', async () => {
    serveur(plan());
    await monter(reglage);
    await screen.findByText('Définition');
    await fireEvent.press(screen.getByRole('button', { name: t.retour }));
    expect(router.back).toHaveBeenCalled();
  });
});
