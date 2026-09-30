import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SessionProvider, useSession } from './SessionProvider';

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
});
