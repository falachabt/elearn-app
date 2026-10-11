import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { enregistrerProfil, lireProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AncienCompte } from '../AncienCompte';

const mockRetrouver = jest.fn();
const mockGoogle = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/authNatif', () => ({ appleAffiche: false, facebookAffiche: true, depsOAuth: () => ({}), depsApple: () => ({}) }));
jest.mock('@/services/ancienCompte', () => ({
  ...jest.requireActual('@/services/ancienCompte'),
  retrouverAncienCompte: (...a: unknown[]) => mockRetrouver(...a),
}));
jest.mock('@/services/compte', () => ({
  ...jest.requireActual('@/services/compte'),
  connecterGoogle: (...a: unknown[]) => mockGoogle(...a),
  connecterFacebook: jest.fn(),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><AncienCompte /></ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('A7 · ancien compte (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('champs vides : erreurs sous les champs, aucun appel', async () => {
    await monter();
    await fireEvent.press(screen.getByRole('button', { name: x.ancien.retrouver }));
    expect(screen.getByText(x.ancien.erreurs.telephoneVide)).toBeTruthy();
    expect(screen.getByText(x.ancien.erreurs.motDePasseVide)).toBeTruthy();
    expect(mockRetrouver).not.toHaveBeenCalled();
  });

  it('indicatif du pays du profil, compte retrouvé, puis rattachement Google', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CI', termine: false });
    mockRetrouver.mockResolvedValue({ user: { id: 'ancien' } });
    mockGoogle.mockResolvedValue(undefined);
    await monter();
    await waitFor(() => expect(screen.getByText('+225')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText(x.ancien.telephone), '07 08 09 10 11');
    await fireEvent.changeText(screen.getByLabelText(x.ancien.motDePasse), 'secret12');
    await fireEvent.press(screen.getByRole('button', { name: x.ancien.retrouver }));
    await waitFor(() => expect(screen.getByText(x.ancien.retrouveTitre)).toBeTruthy());
    expect(mockRetrouver).toHaveBeenCalledWith({}, { telephone: '07 08 09 10 11', motDePasse: 'secret12', indicatif: '225' });
    expect((await lireProfil())?.termine).toBe(true);
    // Rattachement : le mode « rattacher » est transmis.
    await fireEvent.press(screen.getByRole('button', { name: x.compte.google }));
    await waitFor(() => expect(screen.getByText(x.ancien.rattache)).toBeTruthy());
    expect(mockGoogle).toHaveBeenCalledWith({}, {}, undefined, { rattacher: true });
    await fireEvent.press(screen.getByRole('button', { name: x.ancien.continuer }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('identifiants faux : message lisible ; mot de passe oublié ouvre WhatsApp', async () => {
    const { ErreurCompte } = jest.requireActual('@/services/compte');
    mockRetrouver.mockRejectedValue(new ErreurCompte('ancien.erreurs.identifiants'));
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await monter();
    await fireEvent.changeText(screen.getByLabelText(x.ancien.telephone), '677123456');
    await fireEvent.changeText(screen.getByLabelText(x.ancien.motDePasse), 'faux');
    await fireEvent.press(screen.getByRole('button', { name: x.ancien.retrouver }));
    await waitFor(() => expect(screen.getByText(x.ancien.erreurs.identifiants)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.ancien.support }));
    expect(ouvrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/12015348324\?text=.*677123456/));
  });
});
