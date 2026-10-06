import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { depuisLigne, garderNotifications, type EvenementNotification } from '@/services/notifications';

import { NotificationsProvider, useNotifications } from '../NotificationsProvider';

const mockSession = jest.fn();
const mockLire = jest.fn();
const mockCompter = jest.fn();
const mockMarquer = jest.fn();
const mockToutLire = jest.fn();
let mockTempsReel: ((e: EvenementNotification) => void) | null = null;
const mockArreter = jest.fn();

jest.mock('../SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/notifications', () => ({
  ...jest.requireActual('@/services/notifications'),
  lireNotifications: (...a: unknown[]) => mockLire(...a),
  compterNonLues: (...a: unknown[]) => mockCompter(...a),
  marquerLue: (...a: unknown[]) => mockMarquer(...a),
  toutMarquerLu: (...a: unknown[]) => mockToutLire(...a),
  suivreNotifications: (_c: unknown, _u: string, rappel: (e: EvenementNotification) => void) => {
    mockTempsReel = rappel;
    return mockArreter;
  },
}));

const ligne = (id: string, lue = false) => ({ id, type: 'post_comment', title: `Titre ${id}`, body: '', data: {}, read_at: lue ? '2026-10-06T11:00:00Z' : null, created_at: '2026-10-06T10:00:00Z' });
const notifs = (...l: ReturnType<typeof ligne>[]) => l.map(depuisLigne);

function Sonde() {
  const { nonLues, notifications, horsLigne, erreur, marquerLue, toutLire } = useNotifications();
  return (
    <>
      <Text>{`non lues ${nonLues}`}</Text>
      <Text>{`liste ${notifications === null ? 'vide-inconnue' : notifications.map((n) => `${n.id}${n.lue ? '*' : ''}`).join(',')}`}</Text>
      <Text>{`hors ligne ${horsLigne}`}</Text>
      <Text>{`erreur ${erreur}`}</Text>
      <Pressable onPress={() => marquerLue('a')}><Text>lire a</Text></Pressable>
      <Pressable onPress={() => toutLire()}><Text>tout lire</Text></Pressable>
    </>
  );
}
const monter = () => render(<NotificationsProvider><Sonde /></NotificationsProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockTempsReel = null;
  mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
  mockLire.mockResolvedValue(notifs(ligne('a'), ligne('b', true)));
  mockCompter.mockResolvedValue(1);
  mockMarquer.mockResolvedValue(undefined);
  mockToutLire.mockResolvedValue(1);
});

describe('NotificationsProvider', () => {
  it('charge la liste et le nombre de non lues', async () => {
    await monter();
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    expect(screen.getByText('liste a,b*')).toBeTruthy();
    expect(screen.getByText('hors ligne false')).toBeTruthy();
  });

  it('ne lit ni n’écoute rien pour un invité', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    await monter();
    await act(async () => {});
    expect(mockLire).not.toHaveBeenCalled();
    expect(mockTempsReel).toBeNull();
    expect(screen.getByText('non lues 0')).toBeTruthy();
  });

  it('ne lit ni n’écoute rien sans session', async () => {
    mockSession.mockReturnValue({ session: null });
    await monter();
    await act(async () => {});
    expect(mockLire).not.toHaveBeenCalled();
    expect(mockTempsReel).toBeNull();
  });

  it('une nouvelle notification arrive en tête et la pastille est relue au serveur', async () => {
    await monter();
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    mockCompter.mockResolvedValue(2);
    await act(async () => mockTempsReel?.({ type: 'INSERT', ligne: ligne('c'), ancienId: null }));
    await waitFor(() => expect(screen.getByText('non lues 2')).toBeTruthy());
    expect(screen.getByText('liste c,a,b*')).toBeTruthy();
  });

  it('marque lue aussitôt, écrit au serveur et ne compte pas deux fois', async () => {
    await monter();
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    await fireEvent.press(screen.getByText('lire a'));
    await waitFor(() => expect(screen.getByText('non lues 0')).toBeTruthy());
    expect(screen.getByText('liste a*,b*')).toBeTruthy();
    expect(mockMarquer).toHaveBeenCalledWith({}, 'a');
    await fireEvent.press(screen.getByText('lire a'));
    await act(async () => {});
    expect(mockMarquer).toHaveBeenCalledTimes(1);
  });

  it('revient à l’état du serveur quand le marquage échoue', async () => {
    await monter();
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    mockMarquer.mockRejectedValueOnce(new Error('réseau'));
    await fireEvent.press(screen.getByText('lire a'));
    await waitFor(() => expect(mockLire).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    expect(screen.getByText('liste a,b*')).toBeTruthy();
  });

  it('« tout lire » vide la pastille et marque tout au serveur', async () => {
    await monter();
    await waitFor(() => expect(screen.getByText('non lues 1')).toBeTruthy());
    await fireEvent.press(screen.getByText('tout lire'));
    await waitFor(() => expect(screen.getByText('non lues 0')).toBeTruthy());
    expect(mockToutLire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('liste a*,b*')).toBeTruthy();
  });

  it('hors ligne : montre les dernières notifications connues de cet élève', async () => {
    await garderNotifications('u1', notifs(ligne('z'), ligne('y', true)));
    mockLire.mockRejectedValue(new Error('hors ligne'));
    mockCompter.mockRejectedValue(new Error('hors ligne'));
    await monter();
    await waitFor(() => expect(screen.getByText('hors ligne true')).toBeTruthy());
    expect(screen.getByText('liste z,y*')).toBeTruthy();
    expect(screen.getByText('non lues 1')).toBeTruthy();
    expect(screen.getByText('erreur false')).toBeTruthy();
  });

  it('hors ligne sans copie : erreur, jamais la liste d’un autre compte', async () => {
    await garderNotifications('autre', notifs(ligne('z')));
    mockLire.mockRejectedValue(new Error('hors ligne'));
    mockCompter.mockRejectedValue(new Error('hors ligne'));
    await monter();
    await waitFor(() => expect(screen.getByText('erreur true')).toBeTruthy());
    expect(screen.getByText('liste vide-inconnue')).toBeTruthy();
  });

  it('se désabonne en quittant', async () => {
    const { unmount } = await monter();
    await waitFor(() => expect(mockTempsReel).not.toBeNull());
    await unmount();
    expect(mockArreter).toHaveBeenCalled();
  });
});
