import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { BienvenueCredits, CLE_BIENVENUE_VUE } from '../BienvenueCredits';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockSession = jest.fn();
const mockCredits = jest.fn();
const mockLigne = jest.fn();
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => {
    const requete: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gt', 'gte', 'order']) requete[m] = () => requete;
    requete.limit = () => Promise.resolve({ data: mockLigne(), error: null });
    return { from: () => requete };
  },
}));

const compte = { session: { user: { id: 'u1', is_anonymous: false, user_metadata: { full_name: 'Aïcha Nkou' } } } };
const monter = () => render(<ThemeProvider reglage="clair"><BienvenueCredits /></ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(compte);
  mockCredits.mockReturnValue({ solde: { total: 40 }, reglages: { bienvenue: 40, invite: 5, recharge: 25 }, rafraichir: jest.fn(async () => {}) });
  mockLigne.mockReturnValue([{ id: 7, delta: 40 }]);
});

describe('K3c · Tu as gagné N crédits', () => {
  it('s’affiche après la création du compte, avec le montant du serveur, puis ne revient plus', async () => {
    await monter();
    expect(await screen.findByText('Tu as gagné 40 crédits')).toBeTruthy();
    expect(screen.getByText(/Bienvenue Aïcha\./)).toBeTruthy();
    expect(screen.getByText('+25')).toBeTruthy();
    await fireEvent.press(screen.getByText('Récupérer mes crédits'));
    await waitFor(() => expect(screen.queryByText('Tu as gagné 40 crédits')).toBeNull());
    expect(await AsyncStorage.getItem(`${CLE_BIENVENUE_VUE}.u1`)).toBe('7');
  });

  it('rien pour un invité', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    await monter();
    await waitFor(() => expect(mockLigne).not.toHaveBeenCalled());
    expect(screen.queryByText(/crédits$/)).toBeNull();
  });

  it('rien si déjà vu', async () => {
    await AsyncStorage.setItem(`${CLE_BIENVENUE_VUE}.u1`, '7');
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Tu as gagné 40 crédits')).toBeNull();
  });

  it('un nouveau bonus (autre ligne) réaffiche l’écran', async () => {
    await AsyncStorage.setItem(`${CLE_BIENVENUE_VUE}.u1`, '6');
    await monter();
    expect(await screen.findByText('Tu as gagné 40 crédits')).toBeTruthy();
  });

  it('rien sans bonus récent (bonus déjà pris sur ce téléphone)', async () => {
    mockLigne.mockReturnValue([]);
    await monter();
    await waitFor(() => expect(mockLigne).toHaveBeenCalled());
    expect(screen.queryByText(/Tu as gagné/)).toBeNull();
  });
});
