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
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('../analytics', () => ({ suivre: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  reinitialiserRetoursPourTests();
  await AsyncStorage.clear();
});

describe('préférences', () => {
  it('sons, vibrations activés et animations complètes par défaut', async () => {
    expect(await chargerPreferences()).toEqual({ sons: true, vibrations: true, animationsReduites: false });
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

  it('erreur : haptique d’erreur ; sélection : selectionAsync ; récompense : impact', async () => {
    await jouerMoment('error');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
    await jouerMoment('select');
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    await jouerMoment('reward');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
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
    await jouerMoment('select');
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
  it('crée un lecteur par moment, une seule fois', async () => {
    await precharger();
    await precharger();
    expect(createAudioPlayer).toHaveBeenCalledTimes(5);
  });
});
