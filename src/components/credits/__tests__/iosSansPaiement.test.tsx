import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { Solde } from '@/services/credits';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { BandeauCadenas, FeuilleCout, FeuilleDetailCredits, FeuilleEpuise } from '..';

// Sur iOS (App Store) : aucune trace de pass à acheter, de prix, de Mobile Money ni de paiement.
const paiementPossibleReel = jest.requireActual('@/services/plateforme').paiementPossible as (os: string) => boolean;
const mockPaiement = jest.requireMock('@/services/plateforme').paiementPossible as jest.Mock;
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true } }));
const mockCredits = jest.fn();
const mockSession = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));

const solde: Solde = {
  total: 0, semaine: 0, recompenses: 0, recharge: 25, prochaineRecharge: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
  rechargeHebdo: true, illimite: false, illimiteJusqua: null, expirationRecompenses: null,
};
const avecTheme = (n: React.ReactNode) => render(<ThemeProvider>{n}</ThemeProvider>);
const INTERDITS = [/pass/i, /FCFA/, /mobile money/i, /payer/i, /paiement/i, /recharger/i];
const aucune = () => INTERDITS.forEach((motif) => expect(screen.queryByText(motif)).toBeNull());

beforeEach(() => {
  jest.clearAllMocks();
  mockPaiement.mockReturnValue(false);
  mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
  mockCredits.mockReturnValue({ solde, couts: { quiz_explanation: 1, document_pdf: 3 }, reglages: { bienvenue: 40, invite: 5, recharge: 25 }, depensesSemaine: 0, depenser: jest.fn(), rafraichir: jest.fn() });
});

describe('iOS : pas de paiement', () => {
  it('seul Android propose le paiement', () => {
    expect(paiementPossibleReel('android')).toBe(true);
    expect(paiementPossibleReel('ios')).toBe(false);
    expect(paiementPossibleReel('web')).toBe(false);
  });

  it('crédits épuisés : on dit seulement que la recharge arrive lundi', async () => {
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    expect(screen.getByText('Crédits épuisés')).toBeTruthy();
    expect(screen.getByText(/Tes crédits reviennent lundi/)).toBeTruthy();
    aucune();
  });

  it('plus de crédits (justification, corrigé) : même chose, sans « Recharger »', async () => {
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} recharge />);
    expect(screen.getByText(/Tes crédits reviennent lundi/)).toBeTruthy();
    aucune();
  });

  it('invité sans crédits : créer un compte, pas de pass', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    await avecTheme(<FeuilleEpuise ouverte onFermer={jest.fn()} />);
    expect(screen.getByText('Créer mon compte')).toBeTruthy();
    aucune();
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
  });

  it('confirmation de dépense : pas de « Voir les pass » ni d’« illimité avec un pass »', async () => {
    await avecTheme(<FeuilleCout ouverte action="exam_correction" cout={5} onValider={jest.fn()} onFermer={jest.fn()} />);
    aucune();
  });

  it('détail des crédits : « Fermer » à la place de « Voir les pass »', async () => {
    mockCredits.mockReturnValue({ ...mockCredits(), solde: { ...solde, total: 12, semaine: 12 } });
    await avecTheme(<FeuilleDetailCredits ouverte onFermer={jest.fn()} />);
    expect(screen.getByText('Fermer')).toBeTruthy();
    aucune();
  });

  it('bandeau cadenas : pas de « Illimité avec le pass »', async () => {
    await avecTheme(<BandeauCadenas action="exam_correction" titre="Correction détaillée" />);
    expect(screen.getByText('Correction détaillée')).toBeTruthy();
    aucune();
  });
});
