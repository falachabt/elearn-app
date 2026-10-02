import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import { suivre } from '../analytics';
import {
  CLE_PREFERENCES,
  chargerPreferences,
  definirPreference,
  jouerMoment,
  lirePreferences,
  precharger,
  reinitialiserRetoursPourTests,
} from '../retours';

const mockJoueur = { seekTo: jest.fn(() => Promise.resolve()), play: jest.fn() };
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(() => mockJoueur), setAudioModeAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('../analytics', () => ({ suivre: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  reinitialiserRetoursPourTests();
  await AsyncStorage.clear();
});

describe('préférences', () => {
  it('sons, vibrations activés et animations complètes par défaut', async () => {
    expect(await chargerPreferences()).toEqual({ sons: true, vibrations: true, animationsReduites: false, volume: 'normal' });
  });

  it('mémorise un réglage et le retrouve après redémarrage, sans compte', async () => {
    await definirPreference('sons', false);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PREFERENCES))!)).toMatchObject({ sons: false, vibrations: true });
    reinitialiserRetoursPourTests();
    expect(lirePreferences().sons).toBe(true);
    await chargerPreferences();
    expect(lirePreferences().sons).toBe(false);
  });

  it('ignore un stockage illisible', async () => {
    await AsyncStorage.setItem(CLE_PREFERENCES, '{pas du json');
    expect((await chargerPreferences()).sons).toBe(true);
  });

  it('envoie feedback_setting_changed avec l’état complet', async () => {
    await definirPreference('vibrations', false);
    expect(suivre).toHaveBeenCalledWith('feedback_setting_changed', { setting: 'haptics', value: false, sound_on: true, haptics_on: false, reduced_motion: false });
  });
});

describe('jouerMoment', () => {
  it('joue son et vibration par défaut : succès', async () => {
    await jouerMoment('success');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(mockJoueur.seekTo).toHaveBeenCalledWith(0);
    expect(mockJoueur.play).toHaveBeenCalledTimes(1);
  });

  it('suit la carte retours : haptique et son de chaque moment', async () => {
    await jouerMoment('error');
    expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('error');
    await jouerMoment('arrive');
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith('light');
    await jouerMoment('confirm');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(mockJoueur.play).toHaveBeenCalledTimes(3);
    const sources = (createAudioPlayer as jest.Mock).mock.calls.length;
    expect(sources).toBe(3); // un lecteur par son utilisé, réutilisé ensuite
  });

  it('sélection : haptique seule par défaut (sonParDefaut faux), son dans l’aperçu', async () => {
    await jouerMoment('select');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(mockJoueur.play).not.toHaveBeenCalled();
    await jouerMoment('select', { apercu: true });
    expect(mockJoueur.play).toHaveBeenCalledTimes(1);
  });

  it('problème : vibration d’avertissement, aucun son', async () => {
    await jouerMoment('problem');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(mockJoueur.play).not.toHaveBeenCalled();
  });

  it('sons coupés : vibration seule', async () => {
    await definirPreference('sons', false);
    await jouerMoment('error');
    expect(mockJoueur.play).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('vibrations coupées : son seul', async () => {
    await definirPreference('vibrations', false);
    await jouerMoment('success');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(mockJoueur.play).toHaveBeenCalledTimes(1);
  });

  it('les deux coupés : rien', async () => {
    await definirPreference('sons', false);
    await definirPreference('vibrations', false);
    await jouerMoment('celebrate');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(mockJoueur.play).not.toHaveBeenCalled();
  });

  it('célébration : événement celebration_seen', async () => {
    await jouerMoment('celebrate');
    expect(suivre).toHaveBeenCalledWith('celebration_seen', { sound_on: true, haptics_on: true, reduced_motion: false });
  });

  it('respecte le silencieux et ne coupe pas la musique (mode audio)', async () => {
    await jouerMoment('success');
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }));
  });

  it('Android sans haptique fin : vibration courte de repli ≤ 30 ms', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('indisponible'));
    const vibrer = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    await jouerMoment('success');
    expect(vibrer).toHaveBeenCalledWith(25);
    Platform.OS = os;
  });

  it('ne lève jamais, même si l’audio échoue', async () => {
    mockJoueur.seekTo.mockRejectedValueOnce(new Error('audio'));
    await expect(jouerMoment('success')).resolves.toBeUndefined();
  });
});

describe('precharger', () => {
  it('crée un lecteur par son (11), une seule fois', async () => {
    await precharger();
    await precharger();
    expect(createAudioPlayer).toHaveBeenCalledTimes(11);
  });
});
