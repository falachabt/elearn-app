import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { BienvenuePass, CLE_ETAT_PASS } from '../BienvenuePass';

const mockCredits = jest.fn();
const mockSession = jest.fn();
const mockAcces = jest.fn();

jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));
jest.mock('@/services/pass', () => {
  const actuel = jest.requireActual('@/services/pass');
  return { ...actuel, lireAcces: (...args: unknown[]) => mockAcces(...args) };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const utilisateur = { id: 'u-pass', is_anonymous: false };

const solde = (illimite: boolean) => ({
  solde: {
    total: 10,
    semaine: 10,
    recompenses: 0,
    recharge: 10,
    prochaineRecharge: null,
    rechargeHebdo: true,
    illimite,
    illimiteJusqua: illimite ? '2026-11-30T00:00:00Z' : null,
    expirationRecompenses: null,
  },
});

const vue = () => (
  <SafeAreaProvider initialMetrics={metriques}>
    <ThemeProvider reglage="clair">
      <BienvenuePass />
    </ThemeProvider>
  </SafeAreaProvider>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue({ session: { user: utilisateur } });
  mockCredits.mockReturnValue(solde(false));
  mockAcces.mockResolvedValue({ offre: 'month', fin: '2026-11-30T00:00:00Z', source: 'order' });
});

describe('récapitulatif d’activation du pass', () => {
  it('ne s’affiche pas quand le compte est déjà actif au premier démarrage', async () => {
    mockCredits.mockReturnValue(solde(true));
    render(vue());

    await waitFor(async () => expect(await AsyncStorage.getItem(`${CLE_ETAT_PASS}.${utilisateur.id}`)).toBe('actif'));
    expect(screen.queryByText(fr.passActivation.titre)).toBeNull();
  });

  it('affiche tous les droits lors du passage sans pass vers pass, puis à la prochaine activation', async () => {
    const { rerender } = await render(vue());
    await waitFor(async () => expect(await AsyncStorage.getItem(`${CLE_ETAT_PASS}.${utilisateur.id}`)).toBe('inactif'));

    mockCredits.mockReturnValue(solde(true));
    rerender(vue());
    expect(await screen.findByText(fr.passActivation.titre)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.ia)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.credits)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.quiz)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.corrections)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.documents)).toBeTruthy();
    expect(screen.getByText(fr.offres.monthAide)).toBeTruthy();
    expect(screen.getByText(fr.passActivation.valable.replace('{{date}}', new Date('2026-11-30T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: fr.passActivation.continuer }));
    mockCredits.mockReturnValue(solde(false));
    rerender(vue());
    await waitFor(async () => expect(await AsyncStorage.getItem(`${CLE_ETAT_PASS}.${utilisateur.id}`)).toBe('inactif'));

    mockCredits.mockReturnValue(solde(true));
    rerender(vue());
    expect(await screen.findByText(fr.passActivation.titre)).toBeTruthy();
  });
});
