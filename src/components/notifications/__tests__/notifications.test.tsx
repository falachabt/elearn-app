import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { dimancheDe, jourCourt, semainePrecedente } from '@/services/maSemaine';
import { depuisLigne, type Notification } from '@/services/notifications';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Cloche } from '../Cloche';
import { CentreNotifications, iconeDe } from '../CentreNotifications';
import { ReglagesNotifications } from '../ReglagesNotifications';

const mockSession = jest.fn();
const mockNotifications = jest.fn();
const mockLireReglages = jest.fn();
const mockEcrireReglages = jest.fn();
const mockEnLigne = jest.fn(() => true);
const mockPermission = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/session/NotificationsProvider', () => ({ useNotifications: () => mockNotifications() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/connectivite', () => ({ ...jest.requireActual('@/services/connectivite'), estEnLigne: () => mockEnLigne() }));
jest.mock('@/services/push', () => ({ diagnostiquerEtEnregistrerPush: (...a: unknown[]) => mockPush(...a) }));
jest.mock('@/services/notifications', () => ({
  ...jest.requireActual('@/services/notifications'),
  lireReglagesNotifications: (...a: unknown[]) => mockLireReglages(...a),
  ecrireReglagesNotifications: (...a: unknown[]) => mockEcrireReglages(...a),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider>{n}</ThemeProvider>
    </SafeAreaProvider>,
  );

const membre = { session: { user: { id: 'u1', is_anonymous: false } }, statut: 'pret' };
const invite = { session: { user: { id: 'u1', is_anonymous: true } }, statut: 'pret' };

const il = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const notif = (id: string, extra: Partial<Notification> = {}): Notification =>
  ({ ...depuisLigne({ id, type: 'post_comment', title: `Titre ${id}`, body: `Corps ${id}`, data: {}, read_at: null, created_at: il(10) }), ...extra });

const etat = (extra: Record<string, unknown> = {}) => ({
  nonLues: 0, notifications: [] as Notification[] | null, horsLigne: false, erreur: false,
  rafraichir: jest.fn(async () => {}), marquerLue: jest.fn(async () => {}), toutLire: jest.fn(async () => {}), ...extra,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(membre);
  mockNotifications.mockReturnValue(etat());
  mockEnLigne.mockReturnValue(true);
  mockPermission.mockResolvedValue({ granted: true });
  mockPush.mockResolvedValue({ actif: true, permissionAccordee: true, jeton: 'ExponentPushToken[x]', erreur: null });
  mockLireReglages.mockResolvedValue({ enabled: true, answers: true, polls: true, credits: true, reminders: true, reminderHour: 19, reminderMinute: 0 });
  mockEcrireReglages.mockResolvedValue(undefined);
});

describe('Cloche (N0)', () => {
  it('n’affiche aucune pastille quand tout est lu', async () => {
    await monter(<Cloche />);
    expect(screen.getByLabelText(fr.notifications.clocheAucune)).toBeTruthy();
    expect(screen.queryByTestId('cloche-pastille')).toBeNull();
  });

  it('affiche le nombre de non lues', async () => {
    mockNotifications.mockReturnValue(etat({ nonLues: 3 }));
    await monter(<Cloche />);
    expect(screen.getByLabelText('3 notifications non lues')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('dit « 9+ » à partir de dix', async () => {
    mockNotifications.mockReturnValue(etat({ nonLues: 25 }));
    await monter(<Cloche />);
    expect(screen.getByText('9+')).toBeTruthy();
    expect(screen.getByLabelText('25 notifications non lues')).toBeTruthy();
  });

  it('dit le singulier pour une seule', async () => {
    mockNotifications.mockReturnValue(etat({ nonLues: 1 }));
    await monter(<Cloche />);
    expect(screen.getByLabelText(fr.notifications.clocheUne)).toBeTruthy();
  });

  it('ouvre le centre de notifications', async () => {
    await monter(<Cloche />);
    await fireEvent.press(screen.getByLabelText(fr.notifications.clocheAucune));
    expect(router.push).toHaveBeenCalledWith('/notifications');
  });

  it('est absente pour un invité', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<Cloche />);
    expect(screen.queryByLabelText(fr.notifications.clocheAucune)).toBeNull();
  });

  it('est absente sans session', async () => {
    mockSession.mockReturnValue({ session: null, statut: 'chargement' });
    await monter(<Cloche />);
    expect(screen.queryByLabelText(fr.notifications.clocheAucune)).toBeNull();
  });
});

describe('Centre de notifications (N1)', () => {
  it('montre des squelettes tant que rien n’est chargé', async () => {
    mockNotifications.mockReturnValue(etat({ notifications: null }));
    await monter(<CentreNotifications />);
    expect(screen.getByTestId('squelettes')).toBeTruthy();
  });

  it('montre l’état vide', async () => {
    await monter(<CentreNotifications />);
    expect(screen.getByTestId('notifications-vide')).toBeTruthy();
    expect(screen.getByText(fr.notifications.vide)).toBeTruthy();
  });

  it('montre l’erreur sans copie et relance la lecture', async () => {
    const rafraichir = jest.fn(async () => {});
    mockNotifications.mockReturnValue(etat({ notifications: null, erreur: true, rafraichir }));
    await monter(<CentreNotifications />);
    expect(screen.getByText(fr.notifications.erreurTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(fr.notifications.reessayer));
    await waitFor(() => expect(rafraichir).toHaveBeenCalledTimes(1));
  });

  it('groupe « Aujourd’hui » et « Plus tôt », non lues repérées par un point et un fond', async () => {
    mockNotifications.mockReturnValue(
      etat({
        nonLues: 1,
        notifications: [notif('a'), notif('b', { lue: true, creeLe: new Date(Date.now() - 5 * 86400000).toISOString() })],
      }),
    );
    await monter(<CentreNotifications />);
    expect(screen.getByText(fr.notifications.aujourdhui)).toBeTruthy();
    expect(screen.getByText(fr.notifications.plusTot)).toBeTruthy();
    expect(screen.getAllByTestId('notification-non-lue')).toHaveLength(1);
    expect(screen.getAllByTestId('notification-lue')).toHaveLength(1);
    expect(screen.getAllByTestId('point-non-lue')).toHaveLength(1);
    expect(screen.getByText('Titre a')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText('5 j')).toBeTruthy();
  });

  it('un appui marque lue, compte l’ouverture et ouvre la question concernée', async () => {
    const marquerLue = jest.fn(async () => {});
    mockNotifications.mockReturnValue(
      etat({ nonLues: 1, marquerLue, notifications: [notif('a', { type: 'post_reply', data: { post_id: 'q42' } })] }),
    );
    await monter(<CentreNotifications />);
    await fireEvent.press(screen.getByText('Titre a'));
    expect(marquerLue).toHaveBeenCalledWith('a');
    expect(suivre).toHaveBeenCalledWith('notification_opened', { type: 'post_reply' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/question', params: { id: 'q42' } });
  });

  it('ouvre l’écran de la catégorie quand le serveur ne donne pas de question', async () => {
    mockNotifications.mockReturnValue(etat({ notifications: [notif('c', { type: 'reward', lue: true })] }));
    await monter(<CentreNotifications />);
    await fireEvent.press(screen.getByText('Titre c'));
    expect(router.push).toHaveBeenCalledWith('/credits');
  });

  it.each([
    ['crédits presque épuisés', { type: 'credits_low', data: { screen: '/credits', balance: 4 } }, '/credits'],
    ['correction photo remboursée', { type: 'photo_refunded', data: { screen: '/photo', amount: 5 } }, { pathname: '/photo', params: { historique: '1' } }],
    ['sondage révélé', { type: 'poll_revealed', data: { post_id: 'p7' } }, { pathname: '/question', params: { id: 'p7' } }],
    ['réponse à ta question', { type: 'post_comment', data: { post_id: 'q3' } }, { pathname: '/question', params: { id: 'q3' } }],
    ['bienvenue', { type: 'credits_refilled', data: { reason: 'welcome', amount: 40 } }, '/moi'],
  ])('%s : la ligne s’affiche avec son texte et son appui ouvre le bon écran', async (_nom, extra, attendu) => {
    mockNotifications.mockReturnValue(etat({ notifications: [notif('t', { ...(extra as Partial<Notification>), lue: true })] }));
    await monter(<CentreNotifications />);
    expect(screen.getByText('Titre t')).toBeTruthy();
    expect(screen.getByText('Corps t')).toBeTruthy();
    await fireEvent.press(screen.getByText('Titre t'));
    expect(router.push).toHaveBeenCalledWith(attendu);
  });

  it('résumé du lundi : la ligne dit la semaine et ouvre Ma semaine depuis le centre', async () => {
    const semaine = semainePrecedente();
    const titre = fr.maSemaine.centreTitre.replace('{{debut}}', jourCourt(semaine, 'fr')).replace('{{fin}}', jourCourt(dimancheDe(semaine), 'fr'));
    const marquerLue = jest.fn(async () => {});
    const resume = notif('r', { type: 'weekly_summary', titre: 'Ta semaine est prête', corps: '5 missions faites. Découvre ton récap.', data: { week_start: semaine, screen: '/ma-semaine' } });
    mockNotifications.mockReturnValue(etat({ nonLues: 1, marquerLue, notifications: [resume] }));
    await monter(<CentreNotifications />);
    expect(screen.getByText(titre)).toBeTruthy();
    expect(screen.getByText(fr.maSemaine.centreCorps)).toBeTruthy();
    expect(screen.queryByText('Ta semaine est prête')).toBeNull();
    await fireEvent.press(screen.getByText(titre));
    expect(marquerLue).toHaveBeenCalledWith('r');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ma-semaine', params: { semaine, source: 'inbox' } });
  });

  it('résumé de plus de 8 semaines : la ligne n’est plus proposée', async () => {
    const vieux = notif('v', { type: 'weekly_summary', data: { week_start: '2020-01-06' } });
    const recent = notif('n', { type: 'weekly_summary', data: { week_start: semainePrecedente() } });
    mockNotifications.mockReturnValue(etat({ notifications: [vieux, recent, notif('a')] }));
    await monter(<CentreNotifications />);
    expect(screen.queryByText('Ta semaine du 6 janv. au 12 janv.')).toBeNull();
    expect(screen.getByText('Titre a')).toBeTruthy();
  });

  it('« Tout lire » marque tout quand il y a des non lues', async () => {
    const toutLire = jest.fn(async () => {});
    mockNotifications.mockReturnValue(etat({ nonLues: 2, toutLire, notifications: [notif('a'), notif('b')] }));
    await monter(<CentreNotifications />);
    await fireEvent.press(screen.getByLabelText(fr.notifications.toutLire));
    expect(toutLire).toHaveBeenCalledTimes(1);
  });

  it('« Tout lire » n’apparaît pas quand tout est lu', async () => {
    mockNotifications.mockReturnValue(etat({ nonLues: 0, notifications: [notif('a', { lue: true })] }));
    await monter(<CentreNotifications />);
    expect(screen.queryByLabelText(fr.notifications.toutLire)).toBeNull();
  });

  it('hors ligne : dit que ce sont les dernières notifications connues', async () => {
    mockNotifications.mockReturnValue(etat({ horsLigne: true, notifications: [notif('a')] }));
    await monter(<CentreNotifications />);
    expect(screen.getByText(fr.notifications.horsLigne)).toBeTruthy();
    expect(screen.getByText('Titre a')).toBeTruthy();
  });

  it('le bouton retour revient en arrière', async () => {
    await monter(<CentreNotifications />);
    await fireEvent.press(screen.getByLabelText(fr.notifications.retour));
    expect(router.back).toHaveBeenCalled();
  });

  it('chaque type a une icône', () => {
    for (const t of ['post_comment', 'poll_revealed', 'credits_refilled', 'referral', 'reward', 'study_reminder', 'payment_confirmed', 'admin_message', 'marketing', 'credits_low', 'photo_refunded', 'photo_ready', 'post_reply']) {
      expect(iconeDe(t)).toBeTruthy();
    }
  });
});

describe('Réglages des notifications (N2)', () => {
  const interrupteur = (libelle: string) => screen.getByLabelText(libelle);

  it('charge les réglages du compte et les montre', async () => {
    mockLireReglages.mockResolvedValue({ enabled: true, answers: false, polls: true, credits: true, reminders: true, reminderHour: 20, reminderMinute: 0 });
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(interrupteur(fr.notifications.reglages.reponses).props.accessibilityState.checked).toBe(false));
    expect(interrupteur(fr.notifications.reglages.sondages).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('Chaque jour à 20 h')).toBeTruthy();
  });

  it('un invité est invité à créer son compte, sans réglage', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<ReglagesNotifications />);
    expect(screen.getByText(fr.notifications.reglages.invite)).toBeTruthy();
    expect(screen.queryByLabelText(fr.notifications.reglages.alertes)).toBeNull();
    expect(mockLireReglages).not.toHaveBeenCalled();
  });

  it('enregistre un interrupteur sur le compte, sans toucher aux autres', async () => {
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(mockLireReglages).toHaveBeenCalled());
    await fireEvent.press(interrupteur(fr.notifications.reglages.sondages));
    await waitFor(() => expect(mockEcrireReglages).toHaveBeenCalledWith({}, { polls: false }));
    expect(interrupteur(fr.notifications.reglages.sondages).props.accessibilityState.checked).toBe(false);
    expect(interrupteur(fr.notifications.reglages.reponses).props.accessibilityState.checked).toBe(true);
  });

  it('revient en arrière et le dit quand le serveur refuse', async () => {
    mockEcrireReglages.mockRejectedValue(new Error('refusé'));
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(mockLireReglages).toHaveBeenCalled());
    await fireEvent.press(interrupteur(fr.notifications.reglages.credits));
    await waitFor(() => expect(screen.getByText(fr.notifications.reglages.erreur)).toBeTruthy());
    expect(interrupteur(fr.notifications.reglages.credits).props.accessibilityState.checked).toBe(true);
  });

  it('hors ligne : n’écrit rien et le dit', async () => {
    mockEnLigne.mockReturnValue(false);
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(mockLireReglages).toHaveBeenCalled());
    await fireEvent.press(interrupteur(fr.notifications.reglages.reponses));
    expect(screen.getByText(fr.notifications.reglages.horsLigne)).toBeTruthy();
    expect(mockEcrireReglages).not.toHaveBeenCalled();
    expect(interrupteur(fr.notifications.reglages.reponses).props.accessibilityState.checked).toBe(true);
  });

  it('signale quand les réglages n’ont pas pu être lus', async () => {
    mockLireReglages.mockRejectedValue(new Error('hors ligne'));
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(screen.getByText(fr.notifications.reglages.chargementErreur)).toBeTruthy());
  });

  it('coupe tous les types quand l’interrupteur général est éteint', async () => {
    mockLireReglages.mockResolvedValue({ enabled: false, answers: true, polls: true, credits: true, reminders: true, reminderHour: 19, reminderMinute: 0 });
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(interrupteur(fr.notifications.reglages.alertes).props.accessibilityState.checked).toBe(false));
    for (const l of [fr.notifications.reglages.reponses, fr.notifications.reglages.sondages, fr.notifications.reglages.credits, fr.notifications.reglages.rappel]) {
      expect(interrupteur(l).props.accessibilityState.disabled).toBe(true);
    }
  });

  it('rallumer les alertes redemande la permission au téléphone et reprend le jeton', async () => {
    mockLireReglages.mockResolvedValue({ enabled: false, answers: true, polls: true, credits: true, reminders: true, reminderHour: 19, reminderMinute: 0 });
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(interrupteur(fr.notifications.reglages.alertes).props.accessibilityState.checked).toBe(false));
    await fireEvent.press(interrupteur(fr.notifications.reglages.alertes));
    await waitFor(() => expect(mockEcrireReglages).toHaveBeenCalledWith({}, { enabled: true }));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('bandeau jaune quand le téléphone refuse les alertes', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(screen.getByText(fr.notifications.reglages.alertesCoupees)).toBeTruthy());
    expect(screen.getByText(fr.notifications.reglages.alertesCoupeesAide)).toBeTruthy();
  });

  it('change l’heure du rappel d’étude', async () => {
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(mockLireReglages).toHaveBeenCalled());
    await act(async () => {});
    await fireEvent.press(screen.getByText(fr.notifications.reglages.changerHeure));
    await fireEvent.press(screen.getByText('21 h'));
    await waitFor(() => expect(mockEcrireReglages).toHaveBeenCalledWith({}, { reminderHour: 21, reminderMinute: 0 }));
  });

  it('l’heure n’est pas modifiable quand le rappel est coupé', async () => {
    mockLireReglages.mockResolvedValue({ enabled: true, answers: true, polls: true, credits: true, reminders: false, reminderHour: 19, reminderMinute: 0 });
    await monter(<ReglagesNotifications />);
    await waitFor(() => expect(interrupteur(fr.notifications.reglages.rappel).props.accessibilityState.checked).toBe(false));
    await fireEvent.press(screen.getByText(fr.notifications.reglages.changerHeure));
    expect(screen.queryByText(fr.notifications.reglages.heureTitre)).toBeNull();
  });
});
