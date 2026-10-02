import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { DetailPaiement, Paiements } from '../Paiements';

const mockSession = jest.fn();
const mockListe = jest.fn();
const mockDetail = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        order: (...args: unknown[]) => mockListe(...args),
        eq: () => ({ maybeSingle: () => mockDetail() }),
      }),
    }),
  }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const membre = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: false, email: 'eleve@exemple.com' } }, erreur: null };
const paiementReussi = {
  id: 'commande-1',
  product_code: 'month',
  country: 'CM',
  currency: 'XAF',
  amount: 2500,
  status: 'succeeded',
  channel: 'app',
  provider: 'MTN_MOMO_CMR',
  provider_ref: 'commande-1',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:02:00Z',
  failure_code: null,
  expires_at: '2026-10-01T10:10:00Z',
  msisdn_masked: '6******789',
  sandbox: false,
  receipt_no: 'EP-ABCD-1234',
  paid_at: '2026-10-01T10:02:00Z',
  refunded_at: null,
  refund_reason: null,
};
const paiementEchoue = { ...paiementReussi, id: 'commande-2', status: 'failed', receipt_no: null, paid_at: null, failure_code: 'INSUFFICIENT_BALANCE' };

const monter = (element: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{element}</ThemeProvider></SafeAreaProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  mockSession.mockReturnValue(membre);
  mockListe.mockResolvedValue({ data: [paiementEchoue], error: null });
  mockDetail.mockResolvedValue({ data: paiementReussi, error: null });
  await act(() => changerLangue('fr'));
});

afterAll(() => changerLangue('fr'));

describe('page Mes paiements', () => {
  it('affiche un paiement, son statut, son motif et ouvre son détail', async () => {
    monter(<Paiements />);

    await waitFor(() => expect(screen.getByText(fr.offres.month)).toBeTruthy());
    expect(screen.getByText(fr.paiementHistorique.statuts.failed)).toBeTruthy();
    expect(screen.getByText(fr.paiementHistorique.motifs.solde)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: new RegExp(fr.offres.month) }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/paiements/[id]', params: { id: 'commande-2' } });
  });

  it('affiche l’état vide quand aucun paiement n’existe', async () => {
    mockListe.mockResolvedValue({ data: [], error: null });
    monter(<Paiements />);

    await waitFor(() => expect(screen.getByText(fr.paiementHistorique.videTitre)).toBeTruthy());
    expect(screen.getByText(fr.paiementHistorique.videTexte)).toBeTruthy();
  });
});

describe('détail d’un paiement', () => {
  it('affiche le reçu, le montant, le moyen et le motif', async () => {
    mockParams = { id: 'commande-1' };
    monter(<DetailPaiement />);

    await waitFor(() => expect(screen.getByText(fr.paiementHistorique.statuts.succeeded)).toBeTruthy());
    expect(screen.getByText('EP-ABCD-1234')).toBeTruthy();
    expect(screen.getByText('2 500 FCFA')).toBeTruthy();
    expect(screen.getByText(fr.paiementHistorique.motifs.succes.replace('{{offre}}', fr.offres.month))).toBeTruthy();
  });
});
