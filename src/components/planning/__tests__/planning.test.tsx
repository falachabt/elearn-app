import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_COPIE_PLANNING } from '@/services/planning';
import { CLE_PROFIL } from '@/services/profil';
import { CLE_LUES } from '@/services/reviser';
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

const lecon = (id: number, cours: number, nom: string, matiere: string) => ({ kind: 'lesson', course_id: cours, course: `Cours ${cours}`, subject: matiere, lesson_id: id, lesson: nom, minutes: 20 });

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
        { day: '2026-10-19', phase: 'learning', minutes: 45, items: [{ kind: 'free_review' }], done: true },
        { day: '2026-10-20', phase: 'learning', minutes: 45, items: [lecon(2, 1, 'Définition', 'Mathématique'), lecon(4, 3, 'Noms', 'Français')], done: false },
        { day: '2026-10-22', phase: 'learning', minutes: 45, items: [{ kind: 'past_papers' }], done: false },
      ],
    },
    { start: '2026-10-26', phase: 'past_papers', days: [{ day: '2026-10-26', phase: 'past_papers', minutes: 45, items: [{ kind: 'past_papers' }], done: false }] },
  ],
};

// Le planning commence un jeudi : le lundi, le mardi et le mercredi d'avant ne sont ni des séances ni des jours de repos.
const DEBUT_TARD = {
  ...PRET,
  weeks: [{ start: '2026-10-19', phase: 'learning', days: [{ day: '2026-10-22', phase: 'learning', minutes: 45, items: [lecon(2, 1, 'Définition', 'Mathématique')], done: false }] }],
};

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (ui: React.ReactElement, reglage: 'clair' | 'sombre' = 'clair') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

const erreurReseau = { name: 'TypeError', message: 'Network request failed' };
type Reponses = { plan?: unknown; planErreur?: unknown; calendrier?: unknown[]; definir?: unknown };

function serveur(r: Reponses) {
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'my_study_plan') return r.planErreur ? { data: null, error: r.planErreur } : { data: r.plan, error: null };
    if (nom === 'calendrier_de_ma_classe') return { data: r.calendrier ?? [], error: null };
    if (nom === 'study_plan_set_time') return r.definir ? { data: null, error: r.definir } : { data: { status: 'ready' }, error: null };
    if (nom === 'study_plan_mark_done') return { data: true, error: null };
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
  it('en-tête : le titre prend la place restante et la croix reste à droite', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText(t.aujourdhuiTitre.toUpperCase());
    const titre = screen.getByText(t.etiquette.toUpperCase());
    expect(StyleSheet.flatten(titre.props.style).flex).toBe(1);
    expect(screen.getByRole('button', { name: t.fermer })).toBeTruthy();
  });

  it('sans planning : assistant façon onboarding en 5 étapes (matières, contenus, temps, repos, rappel), 45 min pré-sélectionnées à l’étape 3', async () => {
    serveur({ plan: { status: 'empty' }, calendrier: CALENDRIER });
    await monter(<Planning />, reglage);
    await screen.findByText(t.etape1Titre);
    expect(screen.queryByRole('button', { name: t.ajusterLibelle })).toBeNull();

    await fireEvent.press(screen.getByTestId('planning-etape-2'));
    await screen.findByText(t.etape2ContenusTitre);

    await fireEvent.press(screen.getByTestId('planning-etape-3'));
    await screen.findByText(t.titreTemps);
    expect(screen.getByText(/jusqu’au 23 juin 2027 \(Baccalauréat\)/)).toBeTruthy();
    expect(screen.getByText(t.estimee)).toBeTruthy();
    for (const m of [15, 30, 45, 60, 90]) expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', String(m)) })).toBeTruthy();
    expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '45') }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(/Environ \d+ heures de travail/)).toBeTruthy();
  });

  it('parcours 5 étapes complet avec heure personnalisée : le serveur reçoit la classe, le temps et l’heure saisie, puis le planning s’affiche', async () => {
    serveur({ plan: { status: 'empty' }, calendrier: CALENDRIER });
    await monter(<Planning />, reglage);
    await screen.findByText(t.etape1Titre);
    await fireEvent.press(screen.getByText(t.continuer));
    await screen.findByText(t.etape2ContenusTitre);
    await fireEvent.press(screen.getByText(t.continuer));
    await screen.findByText(t.titreTemps);
    await fireEvent.press(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '60') }));
    await fireEvent.press(screen.getByText(t.continuer));
    await screen.findByText(t.etape4ReposTitre);
    expect(screen.getByText(t.reposExplication)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.continuer));
    await screen.findByText(t.etape3Titre);
    await fireEvent.changeText(screen.getByTestId('planning-rappel-personnalise'), '07:15');
    serveur({ plan: PRET });
    await fireEvent.press(screen.getByText(t.creer));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith(
        'study_plan_set_time',
        expect.objectContaining({ p_level: 'Tle', p_country: 'BF', p_minutes: 60, p_reminder_time: '07:15' }),
      ),
    );
    await screen.findByText(t.aujourdhuiTitre.toUpperCase());
    expect(suivre).toHaveBeenCalledWith('planning_time_chosen', { minutes: 60 });
  });

  it('séance du jour : nombre de tâches, tâches, avancement, les 2 prochains jours et bouton qui ouvre la page de la séance', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('2 tâches · 45 min');
    expect(screen.getAllByText('Définition').length).toBeGreaterThan(0);
    expect(screen.getByText('J 22')).toBeTruthy();
    expect(screen.getAllByText('Noms').length).toBeGreaterThan(0);
    expect(screen.getByText('0 sur 2 faits')).toBeTruthy();
    expect(screen.getByText(/Baccalauréat · 23 juin 2027 · estimé/)).toBeTruthy();
    expect(screen.getByTestId('planning-prochains-jours')).toBeTruthy();
    expect(screen.getByTestId('planning-voir-tout')).toBeTruthy();
    await fireEvent.press(screen.getByText(t.ouvrirSeance));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning/jour', params: { jour: '2026-10-20' } });
  });

  it('leçons déjà validées dans Réviser : la séance du jour est faite, sans rien à cocher', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1, '4': 3 }));
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText(t.aujourdhuiFait);
    expect(screen.queryByText(t.ouvrirSeance)).toBeNull();
    expect(screen.getByText(t.voirSeance)).toBeTruthy();
  });

  it('une seule leçon validée : elle est comptée, la séance reste à faire', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1 }));
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText('1 sur 2 faits');
    expect(screen.getByText(t.ouvrirSeance)).toBeTruthy();
  });

  it('semaine complète après « Voir tout le planning » : jours de repos, toucher un jour ouvre sa page', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByTestId('planning-voir-tout');
    await fireEvent.press(screen.getByTestId('planning-voir-tout'));
    await screen.findByText('Semaine 1 sur 2');
    expect(screen.getAllByText(t.repos).length).toBeGreaterThanOrEqual(4);
    await fireEvent.press(screen.getAllByRole('button', { name: /jeu\.? 22/i })[0]);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning/jour', params: { jour: '2026-10-22' } });
  });

  it('le planning commence en milieu de semaine : les jours d’avant ne sont pas des jours de repos', async () => {
    jest.setSystemTime(new Date(2026, 9, 22, 10, 0));
    serveur({ plan: DEBUT_TARD });
    await monter(<Planning />, reglage);
    await screen.findByTestId('planning-voir-tout');
    await fireEvent.press(screen.getByTestId('planning-voir-tout'));
    await screen.findByText('Semaine 1 sur 1');
    // Lundi, mardi, mercredi avant le début, vendredi, samedi, dimanche après la fin.
    expect(screen.getAllByLabelText(t.horsPlanning).length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText(t.repos)).toBeNull();
  });

  it('navigation : semaine suivante, puis retour ; pas de semaine avant la première', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByTestId('planning-voir-tout');
    await fireEvent.press(screen.getByTestId('planning-voir-tout'));
    await screen.findByText('Semaine 1 sur 2');
    expect(screen.getByRole('button', { name: t.semainePrecedente }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: t.semaineSuivante }));
    await screen.findByText('Semaine 2 sur 2');
    expect(screen.getByText(/26 oct\. – 1 nov\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.semaineSuivante }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: t.semainePrecedente }));
    await screen.findByText('Semaine 1 sur 2');
  });

  it('jour de repos : la séance du jour dit quand reprendre, et ouvre la prochaine séance', async () => {
    jest.setSystemTime(new Date(2026, 9, 21, 10, 0));
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText(/Pas de séance aujourd’hui/);
    await fireEvent.press(screen.getByText(t.voirProchaine));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/planning/jour', params: { jour: '2026-10-22' } });
  });

  it('Ajuster est dans l’en-tête, à côté de la croix : le choix s’ouvre avec le temps actuel déjà sélectionné à l’étape 2', async () => {
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText(t.aujourdhuiTitre.toUpperCase());
    await fireEvent.press(screen.getByRole('button', { name: t.ajusterLibelle }));
    await screen.findByText(t.titreTemps);
    expect(screen.getByRole('radio', { name: t.temps.replace('{{n}}', '45') }).props.accessibilityState.selected).toBe(true);
  });

  it('hors ligne avec une copie : dernier planning, ni « Ajuster » ni changement de temps', async () => {
    await AsyncStorage.setItem(CLE_COPIE_PLANNING('u1'), JSON.stringify(PRET));
    serveur({ planErreur: erreurReseau });
    await monter(<Planning />, reglage);
    await screen.findByText(t.horsLigne);
    expect(screen.queryByRole('button', { name: t.ajusterLibelle })).toBeNull();
  });

  it('hors ligne sans copie : message « pas de réseau » et bouton pour réessayer', async () => {
    serveur({ planErreur: erreurReseau });
    await monter(<Planning />, reglage);
    await screen.findByText(t.horsLigneTitre);
    serveur({ plan: PRET });
    await fireEvent.press(screen.getByText(t.reessayer));
    await screen.findByText(t.aujourdhuiTitre.toUpperCase());
  });

  it('erreur du serveur : message d’erreur et bouton pour réessayer', async () => {
    serveur({ planErreur: { name: 'PostgrestError', message: 'boom' } });
    await monter(<Planning />, reglage);
    await screen.findByText(t.erreurTitre);
    expect(screen.getByText(t.erreurTexte)).toBeTruthy();
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

  it('en préparation : message, squelettes et CTA « Aller réviser »', async () => {
    serveur({ plan: { status: 'preparing' } });
    await monter(<Planning />, reglage);
    await screen.findByText(t.preparationTitre);
    expect(screen.getByText(t.preparationTexte)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.allerReviser));
    expect(router.push).toHaveBeenCalledWith('/reviser');
  });

  it('mesure : ouverture avec son origine', async () => {
    mockParams = { source: 'push' };
    serveur({ plan: PRET });
    await monter(<Planning />, reglage);
    await screen.findByText(t.aujourdhuiTitre.toUpperCase());
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

  it('séance du jour : nombre de tâches et durée', async () => {
    serveur({ plan: PRET });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText('Aujourd’hui : 2 tâches · 45 min');
  });

  it('avancement : une leçon validée sur deux montre la barre de progression à 50 %', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1 }));
    serveur({ plan: PRET });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText('Aujourd’hui : 2 tâches · 45 min');
    const barre = await screen.findByTestId('carte-planning-progression');
    expect(barre.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 50 });
  });

  it('séance déjà faite par les leçons validées', async () => {
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ '2': 1, '4': 3 }));
    serveur({ plan: PRET });
    await monter(<CartePlanning idUtilisateur="u1" />);
    await screen.findByText(t.carte.fait);
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
