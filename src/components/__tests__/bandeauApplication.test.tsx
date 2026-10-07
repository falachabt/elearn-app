import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_BANDEAU } from '@/services/bandeauApplication';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { BandeauApplication } from '../BandeauApplication';

const mockChemin = { valeur: '/' };
const mockLiens: { play: string | null; appstore: string | null } = { play: 'https://play.example/app', appstore: null };
jest.mock('expo-router', () => ({ usePathname: () => mockChemin.valeur }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/config/magasins', () => ({
  get LIEN_GOOGLE_PLAY() {
    return mockLiens.play;
  },
  get LIEN_APP_STORE() {
    return mockLiens.appstore;
  },
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><BandeauApplication /></ThemeProvider></SafeAreaProvider>);
const g = globalThis as unknown as { navigator: Record<string, unknown>; matchMedia?: unknown };
const navigateurAvant = g.navigator;
const osAvant = Platform.OS;

const web = (agent: string, extra: Record<string, unknown> = {}) => {
  Platform.OS = 'web';
  g.navigator = { userAgent: agent, maxTouchPoints: 0, ...extra };
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockChemin.valeur = '/';
  mockLiens.play = 'https://play.example/app';
  mockLiens.appstore = null;
  g.matchMedia = undefined;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});
afterEach(() => {
  Platform.OS = osAvant;
  g.navigator = navigateurAvant;
});

const bandeau = () => screen.queryByLabelText(fr.bandeauApp.region);

describe('bandeau application sur le web', () => {
  it('Android : texte, un seul bouton Google Play ; le clic ouvre le magasin sans fermer le bandeau', async () => {
    web('Mozilla/5.0 (Linux; Android 14)');
    await monter();
    expect(await screen.findByText(fr.bandeauApp.texte)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Google Play/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /App Store/ })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: /Google Play/ }));
    expect(Linking.openURL).toHaveBeenCalledWith('https://play.example/app');
    expect(bandeau()).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('web_app_banner_shown', { plateforme: 'android' });
    expect(suivre).toHaveBeenCalledWith('web_app_banner_clicked', { magasin: 'play' });
  });

  it('iPhone sans lien App Store configuré : rien à proposer, pas de bandeau', async () => {
    web('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    await monter();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(bandeau()).toBeNull();
  });

  it('iPhone avec lien App Store : un seul bouton, App Store', async () => {
    mockLiens.appstore = 'https://apps.example/app';
    web('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    await monter();
    expect(await screen.findByRole('link', { name: /App Store/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Google Play/ })).toBeNull();
  });

  it('ordinateur avec les deux liens : les deux boutons', async () => {
    mockLiens.appstore = 'https://apps.example/app';
    web('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await monter();
    expect(await screen.findByRole('link', { name: /Google Play/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /App Store/ })).toBeTruthy();
  });

  it('jamais dans l’application (hors web)', async () => {
    Platform.OS = 'android';
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(bandeau()).toBeNull();
  });

  it('jamais dans la PWA installée', async () => {
    web('Mozilla/5.0 (Linux; Android 14)');
    g.matchMedia = () => ({ matches: true });
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(bandeau()).toBeNull();
  });

  it('jamais sur le paiement ni la photo', async () => {
    web('Mozilla/5.0 (Linux; Android 14)');
    mockChemin.valeur = '/offres/payer';
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(bandeau()).toBeNull();
  });

  it('la croix ferme le bandeau et le mémorise ; il ne revient pas à la visite suivante', async () => {
    web('Mozilla/5.0 (Linux; Android 14)');
    const vue = await monter();
    await fireEvent.press(await screen.findByRole('button', { name: fr.bandeauApp.fermer }));
    expect(bandeau()).toBeNull();
    expect(suivre).toHaveBeenCalledWith('web_app_banner_dismissed', {});
    await waitFor(async () => expect(await AsyncStorage.getItem(CLE_BANDEAU)).toBeTruthy());
    vue.unmount();
    await monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(bandeau()).toBeNull();
  });
});
