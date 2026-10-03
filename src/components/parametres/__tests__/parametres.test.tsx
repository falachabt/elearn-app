import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AccessibilityInfo, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { appliquerTaille, CLE_TAILLE, CLE_THEME, lireAffichage, reinitialiserAffichage } from '@/services/affichage';
import { CLE_WIFI_SEULEMENT } from '@/services/donnees';
import { CLE_RAPPEL } from '@/services/rappels';
import { CLE_RYTHME } from '@/services/rythme';
import { jouerMoment, lirePreferences, reinitialiserRetoursPourTests } from '@/services/retours';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { themes, typo } from '@/theme/theme';

import { Parametres } from '../Parametres';
import { SonsVibrations } from '../SonsVibrations';
import { cranPour } from '../TailleTexte';

const mockSession = jest.fn();
const mockParams = jest.fn(() => ({}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams(),
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
}));
jest.mock('@/services/retours', () => {
  const vrai = jest.requireActual('@/services/retours');
  return { ...vrai, jouerMoment: jest.fn(() => Promise.resolve()) };
});
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  setNotificationChannelAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '3.0.0', nativeBuildVersion: '42' }));
jest.mock('expo-updates', () => ({ channel: 'preview', updateId: 'abcdef1234567890', isEmbeddedLaunch: false, createdAt: new Date('2026-10-01T16:20:00Z') }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const flush = () => act(async () => {});
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false, email: 'amina@exemple.com', user_metadata: {} } } };
const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true, user_metadata: {} } } };
const T = { fr, en };

/** Montre le thème choisi pour vérifier qu'il s'applique à toute l'app. */
function TemoinTheme() {
  const { sombre, reglage } = useTheme();
  return <Text testID="temoin">{`${reglage}:${sombre ? 'sombre' : 'clair'}`}</Text>;
}

const monter = (n: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider>
        {n}
        <TemoinTheme />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

beforeEach(async () => {
  jest.clearAllMocks();
  reinitialiserRetoursPourTests();
  reinitialiserAffichage();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(membre);
  mockParams.mockReturnValue({});
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterAll(async () => {
  reinitialiserAffichage();
  await changerLangue('fr');
});

describe.each(['fr', 'en'] as const)('H2 · Paramètres (%s)', (langue) => {
  const x = T[langue];
  beforeEach(async () => {
    await act(() => changerLangue(langue));
  });

  it('affiche les sections, le compte et la version en bas', async () => {
    await monter(<Parametres />);
    await flush();
    for (const texte of [x.reglages.titre, x.reglages.taille, x.reglages.rappel, x.reglages.wifi, x.reglages.langue, x.reglages.deconnexion, x.reglages.supprimer]) {
      expect(screen.getByText(texte)).toBeTruthy();
    }
    expect(screen.getByTestId('version').props.children).toBe(`${x.reglages.version.replace('{{version}}', '3.0.0')} (42)`);
    expect(screen.getByTestId('version-maj').props.children).toContain('abcdef1');
    expect(screen.getByTestId('version-maj').props.children).toContain('preview');
  });

  it('thème : Sombre puis Système, appliqué tout de suite et gardé', async () => {
    await monter(<Parametres />);
    await fireEvent.press(screen.getByRole('radio', { name: x.reglages.themes.sombre }));
    expect(screen.getByTestId('temoin').props.children).toBe('sombre:sombre');
    expect(screen.getByRole('radio', { name: x.reglages.themes.sombre }).props.accessibilityState).toMatchObject({ checked: true });
    expect(await AsyncStorage.getItem(CLE_THEME)).toBe('sombre');
    await fireEvent.press(screen.getByRole('radio', { name: x.reglages.themes.systeme }));
    expect(screen.getByTestId('temoin').props.children).toMatch(/^systeme:/);
  });

  it('invité : créer un compte à la place de la déconnexion', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<Parametres />);
    expect(screen.queryByText(x.reglages.deconnexion)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `${x.reglages.creer}. ${x.reglages.creerAide}` }));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
  });
});

describe('H2 · réglages', () => {
  beforeEach(async () => {
    await act(() => changerLangue('fr'));
  });

  it('taille du texte : un cran plus grand agrandit les styles partagés et se garde', async () => {
    await monter(<Parametres />);
    await act(() => fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(lireAffichage().taille).toBe(100);
    expect(typo.texte.fontSize).toBe(16);
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(await AsyncStorage.getItem(CLE_TAILLE)).toBe('100');
    appliquerTaille(90);
    expect(typo.texte.fontSize).toBeCloseTo(14.4);
  });

  it('rail : la position touchée donne le cran le plus proche', () => {
    expect(cranPour(0, 200)).toBe(0);
    expect(cranPour(95, 200)).toBe(2);
    expect(cranPour(260, 200)).toBe(5);
    expect(cranPour(-10, 200)).toBe(0);
    expect(cranPour(10, 0)).toBe(0);
  });

  it('les réglages gardés sont relus au démarrage', async () => {
    await AsyncStorage.multiSet([[CLE_THEME, 'sombre'], [CLE_TAILLE, '120']]);
    await monter(<Text>app</Text>);
    await flush();
    expect(screen.getByTestId('temoin').props.children).toBe('sombre:sombre');
    expect(lireAffichage().taille).toBe(120);
  });

  it('ouvre la mission depuis Bien démarrer avec la dernière valeur enregistrée', async () => {
    await AsyncStorage.setItem(CLE_RYTHME, '35');
    mockParams.mockReturnValue({ assistant: 'mission' });

    await monter(<Parametres />);
    await flush();

    expect(screen.getByText('35')).toBeTruthy();
    expect(router.setParams).toHaveBeenCalledWith({ assistant: '' });
  });

  it('rappel de mission : activé avec la permission, coupé ensuite', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await monter(<Parametres />);
    await flush();
    const sw = () => screen.getByRole('switch', { name: fr.reglages.rappel });
    expect(sw().props.accessibilityState).toMatchObject({ checked: false });
    await act(() => fireEvent.press(sw()));
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(sw().props.accessibilityState).toMatchObject({ checked: true });
    await act(() => fireEvent.press(sw()));
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(CLE_RAPPEL))!).statut).toBe('refuse');
  });

  it('rappel refusé par le téléphone : explication, interrupteur reste coupé', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await monter(<Parametres />);
    await act(() => fireEvent.press(screen.getByRole('switch', { name: fr.reglages.rappel })));
    expect(screen.getByText(fr.reglages.rappelRefuse)).toBeTruthy();
    expect(screen.getByRole('switch', { name: fr.reglages.rappel }).props.accessibilityState).toMatchObject({ checked: false });
  });

  it('Wi-Fi seulement : gardé sur le téléphone', async () => {
    await monter(<Parametres />);
    await act(() => fireEvent.press(screen.getByRole('switch', { name: fr.reglages.wifi })));
    expect(await AsyncStorage.getItem(CLE_WIFI_SEULEMENT)).toBe('1');
  });

  it('liens : Sons et vibrations, Mes documents, suppression du compte', async () => {
    await monter(<Parametres />);
    await fireEvent.press(screen.getByRole('button', { name: `${fr.reglages.sons}. ${fr.reglages.sonsDetail}` }));
    expect(router.push).toHaveBeenCalledWith('/parametres/sons');
    await fireEvent.press(screen.getByRole('button', { name: `${fr.reglages.documents}. ${fr.reglages.documentsAide}` }));
    expect(router.push).toHaveBeenCalledWith('/documents');
    await fireEvent.press(screen.getByRole('button', { name: fr.reglages.supprimer }));
    expect(router.push).toHaveBeenCalledWith('/profil/supprimer');
  });

  it('langue : feuille de choix, English appliqué', async () => {
    await monter(<Parametres />);
    await fireEvent.press(screen.getByRole('button', { name: `${fr.reglages.langue}. Français` }));
    await act(() => fireEvent.press(screen.getByText('English')));
    expect(screen.getByText(en.reglages.titre)).toBeTruthy();
    await act(() => changerLangue('fr'));
  });

  it('les couleurs du thème sombre sont celles du design system', () => {
    expect(themes.dark.fond.app).not.toBe(themes.light.fond.app);
  });
});

describe.each(['fr', 'en'] as const)('H2b · Sons et vibrations (%s)', (langue) => {
  const x = T[langue];
  beforeEach(async () => {
    await act(() => changerLangue(langue));
  });

  it('trois interrupteurs pris en compte tout de suite et mémorisés', async () => {
    await monter(<SonsVibrations />);
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    await fireEvent.press(screen.getByRole('switch', { name: x.sonsVibrations.sons }));
    expect(lirePreferences().sons).toBe(false);
    await fireEvent.press(screen.getByRole('switch', { name: x.sonsVibrations.animations }));
    expect(lirePreferences().animationsReduites).toBe(true);
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem('retours.preferences'))!)).toMatchObject({ sons: false, animationsReduites: true });
  });

  it('aperçus et volume', async () => {
    await monter(<SonsVibrations />);
    for (const [libelle, moment] of [[x.sonsVibrations.juste, 'success'], [x.sonsVibrations.faux, 'error'], [x.sonsVibrations.recompense, 'reward'], [x.sonsVibrations.vibrer, 'confirm']] as const) {
      await fireEvent.press(screen.getByRole('button', { name: libelle }));
      expect(jouerMoment).toHaveBeenLastCalledWith(moment, { apercu: true });
    }
    await fireEvent.press(screen.getByRole('radio', { name: x.sonsVibrations.faible }));
    expect(lirePreferences().volume).toBe('faible');
  });
});
