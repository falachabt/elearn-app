import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_REFUS_NOTIFICATION, DELAI_NOTIFICATION_S, annulerCorrectionPrete, notifierCorrectionPrete, programmerCorrectionPrete } from '../photoNotification';

const mockPermission = jest.fn();
const mockDemander = jest.fn();
const mockProgrammer = jest.fn();
const mockAnnuler = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  requestPermissionsAsync: () => mockDemander(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: (...a: unknown[]) => mockProgrammer(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockAnnuler(...a),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const textes = { titre: 'Prête', corps: 'Touche', canal: 'Corrections' };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockProgrammer.mockResolvedValue('id-1');
});

describe('photoNotification', () => {
  it('programme le rappel après le délai habituel de l’IA quand la permission est donnée', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    expect(await programmerCorrectionPrete(textes)).toBe('id-1');
    const demande = mockProgrammer.mock.calls[0][0];
    expect(demande.trigger).toMatchObject({ type: 'timeInterval', seconds: DELAI_NOTIFICATION_S });
    expect(demande.content.data).toEqual({ type: 'photo_ready' });
  });

  it('demande la permission une seule fois : un refus est retenu', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    mockDemander.mockResolvedValue({ granted: false });
    expect(await programmerCorrectionPrete(textes)).toBeNull();
    expect(await AsyncStorage.getItem(CLE_REFUS_NOTIFICATION)).toBe('1');
    expect(await programmerCorrectionPrete(textes)).toBeNull();
    expect(mockDemander).toHaveBeenCalledTimes(1);
    expect(mockProgrammer).not.toHaveBeenCalled();
  });

  it('ne redemande pas quand le système ne le permet plus', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await programmerCorrectionPrete(textes)).toBeNull();
    expect(mockDemander).not.toHaveBeenCalled();
  });

  it('ne bloque jamais l’envoi en cas d’erreur', async () => {
    mockPermission.mockRejectedValue(new Error('indisponible'));
    expect(await programmerCorrectionPrete(textes)).toBeNull();
  });

  it('annule le rappel programmé, sans rien faire pour un identifiant absent', async () => {
    await annulerCorrectionPrete('id-1');
    await annulerCorrectionPrete(null);
    expect(mockAnnuler).toHaveBeenCalledTimes(1);
    expect(mockAnnuler).toHaveBeenCalledWith('id-1');
  });

  it('prévient tout de suite seulement si la permission est déjà donnée', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    await notifierCorrectionPrete(textes);
    expect(mockProgrammer).not.toHaveBeenCalled();
    mockPermission.mockResolvedValue({ granted: true });
    await notifierCorrectionPrete(textes);
    expect(mockProgrammer.mock.calls[0][0].trigger).toBeNull();
  });
});
