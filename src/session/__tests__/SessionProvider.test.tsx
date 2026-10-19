import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Platform, Text } from 'react-native';

import { SessionProvider, useSession } from '../SessionProvider';

const mockAssurer = jest.fn();
const mockGetSupabase = jest.fn();
jest.mock('@/services/session', () => ({ assurerSessionInvite: (...a: unknown[]) => mockAssurer(...a) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => mockGetSupabase() }));

function Sonde() {
  const { statut, session, erreur } = useSession();
  return <Text>{erreur ? `${statut}:${erreur.message}` : `${statut}:${session?.user.id ?? '-'}`}</Text>;
}

const client = { auth: { onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })) } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSupabase.mockReturnValue(client);
});

describe('SessionProvider', () => {
  it('reste en chargement tant que la session n’est pas prête', async () => {
    mockAssurer.mockReturnValue(new Promise(() => {}));
    await render(<SessionProvider><Sonde /></SessionProvider>);
    expect(screen.getByText('chargement:-')).toBeTruthy();
  });

  it('expose la session invité une fois prête', async () => {
    mockAssurer.mockResolvedValue({ user: { id: 'u1' } });
    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(screen.getByText('pret:u1')).toBeTruthy());
  });

  it('expose l’erreur de configuration sans planter', async () => {
    mockGetSupabase.mockImplementation(() => { throw new Error('Configuration Supabase manquante'); });
    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(screen.getByText(/erreur:Configuration Supabase manquante/)).toBeTruthy());
  });

  it('gère le cycle arrière-plan/premier plan (B10-5)', async () => {
    const mockStart = jest.fn();
    const mockStop = jest.fn();
    const mockGetSession = jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } } });
    mockGetSupabase.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        startAutoRefresh: mockStart,
        stopAutoRefresh: mockStop,
        getSession: mockGetSession,
      },
    });
    mockAssurer.mockResolvedValue({ user: { id: 'u1' } });

    let appStateCallback: ((etat: string) => void) | undefined;
    Platform.OS = 'android';
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, cb: any) => {
      if (event === 'change') appStateCallback = cb;
      return { remove: jest.fn() };
    }) as any);

    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(screen.getByText('pret:u1')).toBeTruthy());

    // Passage en arrière-plan
    appStateCallback?.('background');
    expect(mockStop).toHaveBeenCalled();

    // Retour au premier plan
    await act(async () => {
      appStateCallback?.('active');
    });
    expect(mockStart).toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalled();
  });
});

