import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_COPIE_PLANNING } from '@/services/planning';
import { CLE_PROFIL } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { CartePlanning } from '../CartePlanning';
import { Planning } from '../Planning';

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

// Mardi 20 octobre 2026 : séance du jour avec deux leçons, mercredi de repos, jeudi une séance d'annales.
const PRET = {
  status: 'ready',
  minutes_per_day: 45,
  target: { type: 'examen', label: 'Baccalauréat', date: '2027-06-23', status: 'reprise' },
  days_left: 246,
  coverage: { lessons_total: 6, lessons_scheduled: 4 },
  weeks: [
    {
      start: '2026-10-19',
      phase: 'learning',
      days: [
        { day: '2026-10-19', phase: 'learning', minutes: 45, items: [{ kind: 'free_review' }], done: false },
        {
          day: '2026-10-20',
          phase: 'learning',
          minutes: 45,
          items: [
            { kind: 'lesson', course_id: 1, course: 'Fractions', subject: 'Mathématique', lesson_id: 2, lesson: 'Définition', minutes: 20 },
            { kind: 'lesson', course_id: 3, course: 'Grammaire', subject: 'Français', lesson_id: 4, lesson: 'Noms', minutes: 20 },
          ],
          done: false,
        },
        { day: '2026-10-22', phase: 'learning', minutes: 45, items: [{ kind: 'past_papers' }], done: false },
      ],
    },
    { start: '2026-10-26', phase: 'past_papers', days: [{ day: '2026-10-26', phase: 'past_papers', minutes: 45, items: [{ kind: 'past_papers' }], done: false }] },
  ],
};

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (ui: React.ReactElement, reglage: 'clair' | 'sombre' = 'clair') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

const erreurReseau = { name: 'TypeError', message: 'Network request failed' };
type Reponses = { plan?: unknown; planErreur?: unknown; calendrier?: unknown[]; definir?: unknown; cocher?: unknown };

function serveur(r: Reponses) {
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'my_study_plan') return r.planErreur ? { data: null, error: r.planErreur } : { data: r.plan, error: null };
    if (nom === 'calendrier_de_ma_classe') return { data: r.calendrier ?? [], error: null };
    if (nom === 'study_plan_set_time') return r.definir ? { data: null, error: r.definir } : { data: { status: 'ready' }, error: null };
    if (nom === 'study_plan_mark_done') return r.cocher ? { data: null, error: r.cocher } : { data: true, error: null };
    return { data: null, error: null };
  });
}

const CALENDRIER = [{ type: 'examen', libelle: 'Baccalauréat', date_cible: '2027-06-23', statut: 'reprise', annee_scolaire: '2026-2027' }];

beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true, now: new Date(2026, 9, 20, 10, 0) });
  mockRpc.mockReset();
  mockParams = {};
  (router.push as jest.Mock).mockClear();
  (suivre as jest.Mock).mockClear();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'eleve', niveau: 'Tle', pays: 'BF', termine: true }));
});
afterEach(() => jest.useRealTimers());

describe.each(['clair', 'sombre'] as const)('Planning (%s)', (reglage) => {
  it('sans planning : propose le temps par jour, 45 minutes choisies d’office, la date estimée et les heures de travail', async () => {
    serveur({ plan: { status: 'empty' }, calendrier: CALENDRIER });
    await monter(<Planning />, reglage);
    await screen.findByText(t.titreTemps);
    expect(screen.getByText(/jusqu’au 23 juin 2027 \(Baccalauréat\)/)).toBeTruthy();
    expect(screen.getByText(t.estimee)).toBeTruthy();
    for (const m of [15, 30, 45, 60, 90]) expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', String(m)) })).toBeTruthy();
    expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '45') }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(/Environ \d+ heures de travail/)).toBeTruthy();
  });

  it('choisir 60 minutes puis créer : le serveur reçoit la classe et le temps, puis le planning s’affiche', async () => {
    serveur({ plan: { status: 'empty' }, calendrier: CALENDRIER });
    await monter(<Planning />, reglage);
    await screen.findByText(t.titreTemps);
    await fireEvent.press(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '60') }));
    serveur({ plan: PRET });
    await fireEvent.press(screen.getByText(t.creer));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('study_plan_set_time', { p_level: 'Tle', p_country: 'BF', p_minutes: 60 }));
    await screen.findByText('Semaine 1 sur 2');
    expect(suivre).toHaveBeenCalledWith('planning_time_chosen', { minutes: 60 });
  });

  it('planning prêt : semaine, phase, séance du jour, leçons, repos et bouton pour commencer', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('Semaine 1 sur 2');
    expect(screen.getByText(t.phases.learning.toUpperCase())).toBeTruthy();
    expect(screen.getByText('45 min aujourd’hui')).toBeTruthy();
    expect(screen.getAllByText('Définition').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Noms').length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.repos).length).toBe(4);
    expect(screen.getByText(/Baccalauréat · 23 juin 2027 · estimé/)).toBeTruthy();
    expect(screen.getByText(/4 leçons sur 6/)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.commencer));
    expect(router.push).toHaveBeenCalledWith('/reviser');
  });

  it('cocher la séance du jour : le serveur reçoit le jour, la carte passe à « faite » et le bouton disparaît', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('Semaine 1 sur 2');
    const cases = screen.getAllByRole('checkbox');
    await fireEvent.press(cases[1]);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-20', p_done: true }));
    await waitFor(() => expect(screen.getByText(t.aujourdhuiFait)).toBeTruthy());
    expect(screen.queryByText(t.commencer)).toBeNull();
    expect(suivre).toHaveBeenCalledWith('planning_day_checked', { fait: true });
  });

  it('cocher échoue : la case revient en arrière et un message le dit', async () => {
    serveur({ plan: PRET, cocher: { message: 'boom' } });
    await monter(<Planning />, reglage);
    await screen.findByText('Semaine 1 sur 2');
    await fireEvent.press(screen.getAllByRole('checkbox')[1]);
    await screen.findByText(t.erreurCocher);
    expect(screen.getByText('45 min aujourd’hui')).toBeTruthy();
  });

  it('hors ligne avec une copie : dernier planning, cases et changement de temps bloqués', async () => {
    await AsyncStorage.setItem(CLE_COPIE_PLANNING('u1'), JSON.stringify(PRET));
    serveur({ planErreur: erreurReseau });
    await monter(<Planning />, reglage);
    await screen.findByText(t.horsLigne);
    expect(screen.getAllByRole('checkbox')[0].props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getAllByRole('checkbox')[1]);
    expect(mockRpc).not.toHaveBeenCalledWith('study_plan_mark_done', expect.anything());
  });

  it('hors ligne sans copie : message « pas de réseau » et bouton pour réessayer', async () => {
    serveur({ planErreur: erreurReseau });
    await monter(<Planning />, reglage);
    await screen.findByText(t.horsLigneTitre);
    serveur({ plan: PRET });
    await fireEvent.press(screen.getByText(t.reessayer));
    await screen.findByText('Semaine 1 sur 2');
  });

  it('erreur du serveur : message d’erreur et bouton pour réessayer', async () => {
    serveur({ planErreur: { name: 'PostgrestError', message: 'boom' } });
    await monter(<Planning />, reglage);
    await screen.findByText(t.erreurTitre);
    expect(screen.getByText(t.reessayer)).toBeTruthy();
  });

  it('sans date à venir pour la classe : message, pas de choix du temps', async () => {
    serveur({ plan: { status: 'empty' }, calendrier: [] });
    await monter(<Planning />, reglage);
    await screen.findByText(t.sansEcheanceTitre);
    expect(screen.queryByText(t.creer)).toBeNull();
  });

  it('planning sans cible côté serveur : même message', async () => {
    serveur({ plan: { status: 'no_target' } });
    await monter(<Planning />, reglage);
    await screen.findByText(t.sansEcheanceTitre);
  });

  it('en préparation : message et squelettes, pas de planning', async () => {
    serveur({ plan: { status: 'preparing' } });
    await monter(<Planning />, reglage);
    await screen.findByText(t.preparationTitre);
    expect(screen.getByText(t.preparationTexte)).toBeTruthy();
  });

  it('changer le temps : le choix s’ouvre avec le temps actuel déjà sélectionné', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('Semaine 1 sur 2');
    await fireEvent.press(screen.getByText(t.changer));
    await screen.findByText(t.titreTemps);
    expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '45') }).props.accessibilityState.selected).toBe(true);
  });

  it('mesure : ouverture avec son origine', async () => {
    mockParams = { source: 'push' };
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('Semaine 1 sur 2');
    expect(suivre).toHaveBeenCalledWith('planning_opened', { source: 'push' });
  });
});

describe('CartePlanning', () => {
  it('sans planning : invite à choisir son temps par jour, et ouvre le planning depuis l’accueil', async () => {
    serveur({ plan: { status: 'empty' } });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText(t.carte.choisir);
    await fireEvent.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning', params: { source: 'accueil' } });
  });

  it('séance du jour : la matière du jour', async () => {
    serveur({ plan: PRET });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText('Aujourd’hui : Mathématique');
  });

  it('jour de repos', async () => {
    jest.setSystemTime(new Date(2026, 9, 21, 10, 0));
    serveur({ plan: PRET });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText(t.carte.repos);
  });

  it('sans cible, ou en cas d’erreur : la carte ne s’affiche pas', async () => {
    serveur({ plan: { status: 'no_target' } });
    const a = await monter(<CartePlanning idUtilisateur="u1" />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(screen.queryByText(t.carte.titre)).toBeNull();
    a.unmount();
    serveur({ planErreur: { name: 'PostgrestError', message: 'boom' } });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(t.carte.titre)).toBeNull();
  });
});
