import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastRechargeCredits, CLE_RECHARGE_VUE } from '../ToastRechargeCredits';

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

const compte = { session: { user: { id: 'u1', is_anonymous: false } } };
const monter = () => render(<ThemeProvider reglage="clair"><ToastRechargeCredits /></ThemeProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(compte);
  mockCredits.mockReturnValue({ solde: { total: 25, semaine: 25 } });
  mockLigne.mockReturnValue([{ id: 101, delta: 25 }]);
});

describe('ToastRechargeCredits · Notification in-app recharge hebdo', () => {
  it('s’affiche pour un utilisateur connecté lors d’une recharge récente du lundi', async () => {
    await monter();
    expect(await screen.findByText('Tes 25 crédits de la semaine sont là !')).toBeTruthy();
    expect(screen.getByText('Recharge du lundi appliquée. Bonnes révisions !')).toBeTruthy();
  });

  it('se ferme et mémorise l’affichage au clic sur la croix', async () => {
    await monter();
    expect(await screen.findByText('Tes 25 crédits de la semaine sont là !')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(screen.queryByText('Tes 25 crédits de la semaine sont là !')).toBeNull());
    expect(await AsyncStorage.getItem(`${CLE_RECHARGE_VUE}.u1`)).toBe('101');
  });

  it('ne s’affiche pas pour un invité', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    await monter();
    await waitFor(() => expect(mockLigne).not.toHaveBeenCalled());
    expect(screen.queryByText('Tes 25 crédits de la semaine sont là !')).toBeNull();
  });

  it('ne s’affiche pas si déjà vu', async () => {
    await AsyncStorage.setItem(`${CLE_RECHARGE_VUE}.u1`, '101');
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Tes 25 crédits de la semaine sont là !')).toBeNull();
  });

  it('ne s’affiche pas s’il n’y a pas eu de recharge récente', async () => {
    mockLigne.mockReturnValue([]);
    await monter();
    await waitFor(() => expect(mockLigne).toHaveBeenCalled());
    expect(screen.queryByText('Tes 25 crédits de la semaine sont là !')).toBeNull();
  });
});
