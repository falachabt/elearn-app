import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { LienParent, objectifPour } from '../LienParent';
import { Offres } from '../Offres';

const mockOffres = jest.fn();
const mockAcces = jest.fn();
const mockCreer = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/pass', () => ({
  ...jest.requireActual('@/services/pass'),
  lireOffres: (...a: unknown[]) => mockOffres(...a),
  lireAcces: (...a: unknown[]) => mockAcces(...a),
  creerLienParent: (...a: unknown[]) => mockCreer(...a),
}));

const OFFRES = [
  { code: 'week', montant: 500, devise: 'XAF', recommandee: false, dureeJours: 7, finSaison: null },
  { code: 'month', montant: 2500, devise: 'XAF', recommandee: true, dureeJours: 30, finSaison: null },
  { code: 'contest', montant: 7500, devise: 'XAF', recommandee: false, dureeJours: null, finSaison: '2027-08-31' },
];
const LIEN = { jeton: 'abc', url: 'https://elearnprepa.com/p/abc', montant: 2500, devise: 'XAF', expire: '2026-10-02T10:00:00Z' };

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
  mockOffres.mockResolvedValue(OFFRES);
  mockAcces.mockResolvedValue(null);
});
afterAll(() => changerLangue('fr'));

it('objectif selon la classe', () => {
  expect(objectifPour('3e')).toBe('BEPC');
  expect(objectifPour('1re')).toBe('probatoire');
  expect(objectifPour('Tle')).toBe('bac');
  expect(objectifPour('ens', 'concours')).toBe('concours');
  expect(objectifPour('5e')).toBe('examens');
});

describe.each(['fr', 'en'] as const)('E1 · offres (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('pays du profil, mois conseillé choisi, paiement annoncé bientôt', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CI', termine: true });
    mockParams = { declencheur: 'score' };
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByText(x.offres.conseille)).toBeTruthy());
    expect(mockOffres).toHaveBeenCalledWith({}, 'CI');
    expect(suivre).toHaveBeenCalledWith('paywall_viewed', { declencheur: 'score' });
    expect(screen.getByRole('radio', { name: new RegExp(x.offres.month) }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /2.500/ }));
    expect(screen.getByText(x.offres.bientot)).toBeTruthy();
  });

  it('choisir une offre puis l’envoyer au parent', async () => {
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByRole('radio', { name: new RegExp(x.offres.week) })).toBeTruthy());
    await fireEvent.press(screen.getByRole('radio', { name: new RegExp(x.offres.week) }));
    expect(suivre).toHaveBeenCalledWith('offer_selected', { offre: 'week' });
    await fireEvent.press(screen.getByRole('button', { name: x.offres.parent }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres/parent', params: { offre: 'week' } });
  });

  it('gratuit : continuer sans payer', async () => {
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByRole('radio', { name: new RegExp(x.offres.gratuit) })).toBeTruthy());
    await fireEvent.press(screen.getByRole('radio', { name: new RegExp(x.offres.gratuit) }));
    await fireEvent.press(screen.getByRole('button', { name: x.offres.continuerGratuit }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('pass actif affiché', async () => {
    mockAcces.mockResolvedValue({ offre: 'month', fin: '2026-11-01T12:00:00Z', source: 'order' });
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByText(new RegExp(langue === 'fr' ? 'actif jusqu' : 'active until'))).toBeTruthy());
  });

  it('pays sans prix', async () => {
    mockOffres.mockResolvedValueOnce([]);
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByText(x.offres.indisponible)).toBeTruthy());
  });

  it('erreur réseau puis nouvel essai', async () => {
    mockOffres.mockRejectedValueOnce(new Error('réseau'));
    await monter(<Offres />);
    await waitFor(() => expect(screen.getByText(x.offres.erreur)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.offres.reessayer }));
    await waitFor(() => expect(screen.getByText(x.offres.conseille)).toBeTruthy());
  });
});

describe.each(['fr', 'en'] as const)('E6 · envoyer à mon parent (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('message personnalisé, lien créé une fois, WhatsApp puis copie', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
    mockParams = { offre: 'month' };
    mockCreer.mockResolvedValue(LIEN);
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await monter(<LienParent />);
    await waitFor(() => expect(screen.getByTestId('apercu-message')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText(x.parent.prenom), 'Aïcha');
    expect(screen.getByText(new RegExp(`Aïcha.*${x.parent.objectifs.bac}`))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: x.parent.whatsapp }));
    await waitFor(() => expect(ouvrir).toHaveBeenCalled());
    expect(mockCreer).toHaveBeenCalledWith({}, { offre: 'month', pays: 'CM', prenom: 'Aïcha' });
    expect(decodeURIComponent(ouvrir.mock.calls[0][0])).toContain(LIEN.url);
    expect(suivre).toHaveBeenCalledWith('parent_link_sent', { canal: 'whatsapp' });

    await fireEvent.press(screen.getByRole('button', { name: x.parent.copier }));
    await waitFor(() => expect(screen.getByText(x.parent.copie)).toBeTruthy());
    expect(mockCreer).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining(LIEN.url));
  });

  it('trop de liens aujourd’hui : message dédié', async () => {
    mockCreer.mockRejectedValue({ code: '54000' });
    await monter(<LienParent />);
    await waitFor(() => expect(screen.getByTestId('apercu-message')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.parent.copier }));
    await waitFor(() => expect(screen.getByText(x.parent.trop)).toBeTruthy());
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('offre inconnue : pass mois par défaut ; erreur réseau signalée', async () => {
    mockParams = { offre: 'nimportequoi' };
    mockCreer.mockRejectedValue(new Error('réseau'));
    await monter(<LienParent />);
    await waitFor(() => expect(screen.getByText(new RegExp(x.offres.month))).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.parent.whatsapp }));
    await waitFor(() => expect(screen.getByText(x.parent.erreur)).toBeTruthy());
  });
});
