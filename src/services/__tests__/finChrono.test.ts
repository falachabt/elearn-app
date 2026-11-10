import { Platform } from 'react-native';

import { annulerFinChrono, programmerFinChrono } from '../finChrono';

const mockPermission = jest.fn();
const mockProgrammer = jest.fn();
const mockAnnuler = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: (...a: unknown[]) => mockProgrammer(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockAnnuler(...a),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const textes = { titre: 'Temps écoulé', corps: 'Reviens', canal: 'Chrono' };

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  mockProgrammer.mockResolvedValue('n-1');
});

describe('finChrono', () => {
  it('programme la notification à l’échéance quand la permission est déjà donnée', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    expect(await programmerFinChrono(5400, textes)).toBe('n-1');
    expect(mockProgrammer.mock.calls[0][0].trigger).toMatchObject({ type: 'timeInterval', seconds: 5400 });
    expect(mockProgrammer.mock.calls[0][0].content.data).toEqual({ type: 'annale_chrono_fin' });
  });

  it('sans permission : rien n’est programmé et la permission n’est jamais demandée', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    expect(await programmerFinChrono(5400, textes)).toBeNull();
    expect(mockProgrammer).not.toHaveBeenCalled();
    expect(jest.requireMock('expo-notifications').requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('durée trop courte, web ou erreur : null, jamais bloquant', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    expect(await programmerFinChrono(2, textes)).toBeNull();
    mockProgrammer.mockRejectedValue(new Error('x'));
    expect(await programmerFinChrono(600, textes)).toBeNull();
    Platform.OS = 'web';
    expect(await programmerFinChrono(600, textes)).toBeNull();
  });

  it('annuler ne lève jamais', async () => {
    await annulerFinChrono(null);
    expect(mockAnnuler).not.toHaveBeenCalled();
    mockAnnuler.mockRejectedValue(new Error('x'));
    await expect(annulerFinChrono('n-1')).resolves.toBeUndefined();
  });
});
