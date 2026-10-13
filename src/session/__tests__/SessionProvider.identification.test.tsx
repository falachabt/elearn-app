import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { identifier, reinitialiserIdentite } from '@/services/analytics';

import { SessionProvider, useSession } from '../SessionProvider';

const mockAssurer = jest.fn();
const mockGetSupabase = jest.fn();
jest.mock('@/services/session', () => ({ assurerSessionInvite: (...a: unknown[]) => mockAssurer(...a) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => mockGetSupabase() }));
jest.mock('@/services/analytics', () => ({
  identifier: jest.fn(() => Promise.resolve()),
  reinitialiserIdentite: jest.fn(() => Promise.resolve()),
  suivre: jest.fn(),
}));

function Sonde() {
  const { statut, session } = useSession();
  return <Text>{`${statut}:${session?.user.id ?? '-'}`}</Text>;
}

type Rappel = (evenement: string, session: unknown) => void;
let rappel: Rappel | undefined;
const client = {
  auth: {
    onAuthStateChange: jest.fn((f: Rappel) => {
      rappel = f;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  rappel = undefined;
  mockGetSupabase.mockReturnValue(client);
});

describe('SessionProvider : identification de l’analytics', () => {
  it('identifie l’invité au démarrage, sans e-mail', async () => {
    mockAssurer.mockResolvedValue({ user: { id: 'invite-1', is_anonymous: true, email: 'ne-doit-pas-partir@exemple.com' } });
    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(identifier).toHaveBeenCalledWith('invite-1', { invite: true }));
    expect(JSON.stringify((identifier as jest.Mock).mock.calls)).not.toContain('exemple.com');
  });

  it('identifie le compte à la connexion', async () => {
    mockAssurer.mockResolvedValue({ user: { id: 'invite-1', is_anonymous: true } });
    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(rappel).toBeDefined());
    await act(async () => {
      rappel?.('SIGNED_IN', { user: { id: 'compte-2', is_anonymous: false } });
    });
    expect(identifier).toHaveBeenLastCalledWith('compte-2', { invite: false });
  });

  it('à la déconnexion : remet l’identité à zéro avant de créer le nouvel invité', async () => {
    const ordre: string[] = [];
    (reinitialiserIdentite as jest.Mock).mockImplementation(async () => {
      ordre.push('reset');
    });
    mockAssurer.mockImplementation(async () => {
      ordre.push('assurer');
      return { user: { id: 'invite-2', is_anonymous: true } };
    });
    await render(<SessionProvider><Sonde /></SessionProvider>);
    await waitFor(() => expect(rappel).toBeDefined());
    ordre.length = 0;
    await act(async () => {
      rappel?.('SIGNED_OUT', null);
    });
    await waitFor(() => expect(ordre).toEqual(['reset', 'assurer']));
  });
});
