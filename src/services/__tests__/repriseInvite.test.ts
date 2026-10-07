import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  effacerRepriseInvite,
  lireRepriseInvite,
  preparerRepriseInvite,
  reprendreApresRedemarrage,
  repriseInviteEnCours,
  progressionInviteeLocalePresente,
  terminerOAuthRepriseInvite,
  transfererProgressionInvitee,
  verifierRepriseInvitee,
} from '../repriseInvite';

const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (cle: string, valeur: string) => mockSecureStore.set(cle, valeur)),
  getItemAsync: jest.fn(async (cle: string) => mockSecureStore.get(cle) ?? null),
  deleteItemAsync: jest.fn(async (cle: string) => void mockSecureStore.delete(cle)),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSecureStore.clear();
  await effacerRepriseInvite();
});

it('garde la session source et restaure la page de reprise après redémarrage', async () => {
  await preparerRepriseInvite('invite-1', 'refresh-1');
  expect(await terminerOAuthRepriseInvite('invite-1', 'compte-2')).toBe(true);
  expect(await reprendreApresRedemarrage('compte-2')).toBe(true);
  expect(repriseInviteEnCours()).toBe(true);
  expect(await lireRepriseInvite()).toMatchObject({ inviteId: 'invite-1', compteId: 'compte-2', etat: 'a-confirmer' });
});

it('sauvegarde le nouveau jeton invité renvoyé par le transfert serveur', async () => {
  await preparerRepriseInvite('invite-1', 'refresh-1');
  await terminerOAuthRepriseInvite('invite-1', 'compte-2');
  const invoke = jest.fn().mockResolvedValue({
    data: { ok: true, guest_refresh_token: 'refresh-2' },
    error: null,
  });
  await transfererProgressionInvitee({ functions: { invoke } } as never, true);
  expect(invoke).toHaveBeenCalledWith('transfer-guest-progress', {
    body: { action: 'garder', guest_refresh_token: 'refresh-1' },
  });
  expect((await lireRepriseInvite())?.jetonRafraichissementInvite).toBe('refresh-2');
});

it('vérifie la progression serveur et conserve le jeton invité renouvelé', async () => {
  await preparerRepriseInvite('invite-1', 'refresh-1');
  await terminerOAuthRepriseInvite('invite-1', 'compte-2');
  const invoke = jest.fn().mockResolvedValue({
    data: { ok: true, has_progress: false, guest_refresh_token: 'refresh-2' },
    error: null,
  });
  await expect(verifierRepriseInvitee({ functions: { invoke } } as never, false)).resolves.toBe(false);
  expect(invoke).toHaveBeenCalledWith('transfer-guest-progress', {
    body: { action: 'verifier', guest_refresh_token: 'refresh-1', progression_locale: false },
  });
  expect((await lireRepriseInvite())?.jetonRafraichissementInvite).toBe('refresh-2');
});

it('efface un marqueur illisible au redémarrage plutôt que de bloquer les synchronisations', async () => {
  await AsyncStorage.setItem('compte.repriseInvite', '{');
  expect(await reprendreApresRedemarrage('compte-2')).toBe(false);
  expect(repriseInviteEnCours()).toBe(false);
  expect(await AsyncStorage.getItem('compte.repriseInvite')).toBeNull();
});

it('ignore les réglages système par défaut et détecte les vraies avancées d’apprentissage', async () => {
  await AsyncStorage.setItem('affichage.theme', 'sombre');
  await AsyncStorage.setItem('retours.preferences', '{}');
  await AsyncStorage.setItem('reglages.maj', '2026-10-04T00:00:00Z');
  expect(await progressionInviteeLocalePresente()).toBe(false);

  await AsyncStorage.setItem('mission.historique', '[]');
  expect(await progressionInviteeLocalePresente()).toBe(true);
});

describe('web : connexion Google d’un invité', () => {
  it('SecureStore absent sur le web : le jeton passe par le stockage du navigateur, sans erreur', async () => {
    const { Platform } = jest.requireActual('react-native');
    const avant = Platform.OS;
    Platform.OS = 'web';
    const natif = jest.requireMock('expo-secure-store');
    natif.setItemAsync.mockImplementation(async () => {
      throw new Error('not available');
    });
    natif.getItemAsync.mockImplementation(async () => {
      throw new Error('not available');
    });
    try {
      await preparerRepriseInvite('invite-1', 'refresh-web');
      await terminerOAuthRepriseInvite('invite-1', 'compte-2');
      expect(await lireRepriseInvite()).toMatchObject({ jetonRafraichissementInvite: 'refresh-web' });
    } finally {
      Platform.OS = avant;
      natif.setItemAsync.mockImplementation(async (cle: string, valeur: string) => mockSecureStore.set(cle, valeur));
      natif.getItemAsync.mockImplementation(async (cle: string) => mockSecureStore.get(cle) ?? null);
    }
  });
});
