import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerJetonPush } from '../push';

const mockPermission = jest.fn();
const mockJeton = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: (...a: unknown[]) => mockJeton(...a),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'projet-eas' } } } } }));

// Un même jeton pour un même compte n'est pas renvoyé au serveur à chaque ouverture (issue #14).
describe('push : déduplication de l’enregistrement', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockPermission.mockResolvedValue({ granted: true });
    mockJeton.mockResolvedValue({ data: 'ExponentPushToken[dup]' });
  });

  it('ne relance pas la RPC pour le même jeton et le même compte dans les 24 h', async () => {
    const rpc = jest.fn(async () => ({ data: true, error: null }));
    const client = { rpc } as never;
    expect(await enregistrerJetonPush(client, 'compte-1')).toBe(true);
    expect(await enregistrerJetonPush(client, 'compte-1')).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('réenregistre quand le compte change sur le même téléphone', async () => {
    const rpc = jest.fn(async () => ({ data: true, error: null }));
    const client = { rpc } as never;
    await enregistrerJetonPush(client, 'compte-1');
    await enregistrerJetonPush(client, 'compte-2');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
