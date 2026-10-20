import { render, waitFor } from '@testing-library/react-native';
import RetourAuth from '../callback';

let mockParams: Record<string, string | undefined> = {};
let mockSession: { user: { is_anonymous: boolean } } | null = null;
const mockExchange = jest.fn();
const mockSetSession = jest.fn();
const mockGetSession = jest.fn();

jest.mock('expo-router', () => {
  const R = jest.requireActual('react');
  const RN = jest.requireActual('react-native');
  return {
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => R.createElement(RN.Text, { testID: 'redirect' }, href),
  };
});

jest.mock('@/components/liste/Squelettes', () => ({
  Squelettes: () => null,
}));

jest.mock('@/components/Logo', () => ({
  Logo: () => null,
}));

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      fond: { app: '#fff', surface: '#fff' },
      texte: { principal: '#000', secondaire: '#666' },
      primaire: { defaut: '#000' },
      bord: { doux: '#eee' },
    },
  }),
}));

jest.mock('@/i18n/useTraduction', () => ({
  useTraduction: () => ({ t: (k: string) => k }),
}));

jest.mock('@/services/compte', () => ({
  echangerCodeOAuthUneFois: (...args: unknown[]) => mockExchange(...args),
  lireRetourOAuth: jest.fn(() => ({})),
}));

jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSession = null;
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockExchange.mockResolvedValue({ error: null });
  mockSetSession.mockResolvedValue({ error: null });
});

describe('RetourAuth (/auth/callback)', () => {
  it('redirige vers /moi si session active non anonyme', async () => {
    mockSession = { user: { is_anonymous: false } };
    const { getByText } = await render(<RetourAuth />);
    expect(getByText('/moi')).toBeTruthy();
  });

  it('échange le code PKCE et redirige vers /moi', async () => {
    mockParams = { code: 'pkce-123' };
    const { getByText } = await render(<RetourAuth />);
    await waitFor(() => expect(mockExchange).toHaveBeenCalledWith(expect.anything(), 'pkce-123'));
    await waitFor(() => expect(getByText('/moi')).toBeTruthy());
  });

  it('redirige vers /compte/connexion en cas d’erreur dans l’URL', async () => {
    mockParams = { error: 'access_denied' };
    const { getByText } = await render(<RetourAuth />);
    await waitFor(() => expect(getByText('/compte/connexion')).toBeTruthy());
  });
});
