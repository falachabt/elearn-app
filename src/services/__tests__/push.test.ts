import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_JETON_PUSH, diagnostiquerEtEnregistrerPush, enregistrerJetonPush, jetonPushActif } from '../push';

const mockPermission = jest.fn();
const mockJeton = jest.fn();
const mockDemander = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  requestPermissionsAsync: () => mockDemander(),
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

  it('au démarrage, même quand le téléphone pourrait la redemander, la permission n’est jamais demandée', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await enregistrerJetonPush(client({ data: true, error: null }))).toBe(false);
    expect(mockDemander).not.toHaveBeenCalled();
    expect(mockJeton).not.toHaveBeenCalled();
  });

  it('depuis les réglages (décision de l’élève), la permission est demandée puis le jeton enregistré', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    mockDemander.mockResolvedValue({ granted: true });
    mockJeton.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    const diag = await diagnostiquerEtEnregistrerPush(client({ data: true, error: null }));
    expect(mockDemander).toHaveBeenCalledTimes(1);
    expect(diag).toMatchObject({ actif: true, permissionAccordee: true });
  });

  it('depuis les réglages, une permission refusée pour de bon n’est pas redemandée', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const diag = await diagnostiquerEtEnregistrerPush(client({ data: true, error: null }));
    expect(mockDemander).not.toHaveBeenCalled();
    expect(diag.permissionAccordee).toBe(false);
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
