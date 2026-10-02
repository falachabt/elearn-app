import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_JETON_PUSH, enregistrerJetonPush, jetonPushActif } from '../push';

const mockPermission = jest.fn();
const mockJeton = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  getExpoPushTokenAsync: (...a: unknown[]) => mockJeton(...a),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'projet-eas' } } } } }));

const client = (reponse: { data: unknown; error: unknown }) => ({ rpc: jest.fn(async () => reponse) }) as never;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('push : jeton de notifications', () => {
  it('enregistre le jeton sur le compte quand la permission est donnée', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    mockJeton.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    const c = client({ data: true, error: null });
    expect(await enregistrerJetonPush(c)).toBe(true);
    expect(mockJeton).toHaveBeenCalledWith({ projectId: 'projet-eas' });
    expect((c as unknown as { rpc: jest.Mock }).rpc).toHaveBeenCalledWith('register_push_token', { p_token: 'ExponentPushToken[abc]' });
    expect(await AsyncStorage.getItem(CLE_JETON_PUSH)).toBe('ExponentPushToken[abc]');
    expect(await jetonPushActif()).toBe(true);
  });

  it('ne demande jamais la permission : sans elle, rien n’est enregistré', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    expect(await enregistrerJetonPush(client({ data: true, error: null }))).toBe(false);
    expect(mockJeton).not.toHaveBeenCalled();
    expect(await jetonPushActif()).toBe(false);
  });

  it('build sans Firebase : le jeton échoue sans bruit et rien n’est retenu', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    mockJeton.mockRejectedValue(new Error('Default FirebaseApp is not initialized'));
    expect(await enregistrerJetonPush(client({ data: true, error: null }))).toBe(false);
    expect(await jetonPushActif()).toBe(false);
  });

  it('compte invité (le serveur répond false) : le jeton n’est pas retenu', async () => {
    mockPermission.mockResolvedValue({ granted: true });
    mockJeton.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    expect(await enregistrerJetonPush(client({ data: false, error: null }))).toBe(false);
    expect(await jetonPushActif()).toBe(false);
  });
});
