import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import EcranCredits from '@/app/credits/index';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

jest.mock('@/services/supabase', () => ({
  getSupabase: jest.fn().mockReturnValue({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSolde = {
  total: 18,
  semaine: 18,
  recompenses: 0,
  recharge: 25,
  prochaineRecharge: '2026-10-05T08:00:00Z',
  rechargeHebdo: true,
  illimite: false,
  illimiteJusqua: null,
  expirationRecompenses: null,
};

const mockCredits = jest.fn();
const mockSession = jest.fn();

jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => mockCredits(),
}));

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => mockSession(),
}));

jest.mock('@/services/actionsCredits', () => ({
  ...jest.requireActual('@/services/actionsCredits'),
  lireEtatActionsQuotidiennes: jest.fn().mockResolvedValue({
    site_web: false,
    facebook: false,
    instagram: false,
    parrainage: false,
  }),
}));

jest.mock('@/services/credits', () => ({
  ...jest.requireActual('@/services/credits'),
  lireHistoriqueCredits: jest.fn().mockResolvedValue([
    { id: 'h1', delta: 25, kind: 'weekly', createdAt: '2026-09-28T08:00:00Z' },
    { id: 'h2', delta: -5, kind: 'spend', createdAt: '2026-09-29T10:00:00Z' },
  ]),
}));

const renderComponent = (node: React.ReactNode) => render(<ThemeProvider>{node}</ThemeProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockCredits.mockReturnValue({
    solde: mockSolde,
    rafraichir: jest.fn(),
  });
  mockSession.mockReturnValue({
    session: { user: { id: 'user-1', is_anonymous: false } },
  });
});

describe('Page /credits (EcranCredits)', () => {
  it('affiche la synthèse du solde et la jauge', async () => {
    renderComponent(<EcranCredits />);
    await waitFor(() => expect(screen.getByText('Crédits & Récompenses')).toBeTruthy());
    expect(screen.getByText('18 crédits')).toBeTruthy();
    expect(screen.getByText('18 / 25')).toBeTruthy();
  });

  it('affiche les cartes des 4 actions quotidiennes', async () => {
    renderComponent(<EcranCredits />);
    await waitFor(() => expect(screen.getByText('Visiter le site web')).toBeTruthy());
    expect(screen.getByText('Facebook')).toBeTruthy();
    expect(screen.getByText('Instagram')).toBeTruthy();
    expect(screen.getByText('Inviter des amis')).toBeTruthy();
  });

  it('affiche l’historique des transactions', async () => {
    renderComponent(<EcranCredits />);
    await waitFor(() => expect(screen.getByText('Recharge hebdomadaire du lundi')).toBeTruthy());
    expect(screen.getByText('+25')).toBeTruthy();
    expect(screen.getByText('-5')).toBeTruthy();
  });

  it('clic sur parrainage redirige vers /parrainage', async () => {
    renderComponent(<EcranCredits />);
    await waitFor(() => expect(screen.getByText('Inviter des amis')).toBeTruthy());
    const parrainageBtn = screen.getByText('Inviter des amis');
    fireEvent.press(parrainageBtn);
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/parrainage');
    });
  });
});
