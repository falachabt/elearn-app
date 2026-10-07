import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_PROPOSITION,
  DELAI_RELANCE_JOURS,
  accepterNotifications,
  doitProposerNotifications,
  noterPropositionPlusTard,
} from '../proposerNotifications';

const mockLire = jest.fn();
const mockDemander = jest.fn();
const mockJeton = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockLire(),
  requestPermissionsAsync: () => mockDemander(),
}));
jest.mock('../push', () => ({ enregistrerJetonPush: (...a: unknown[]) => mockJeton(...a) }));

const client = { rpc: jest.fn() } as never;
const JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = new Date('2026-10-07T09:00:00.000Z');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockLire.mockResolvedValue({ granted: false, canAskAgain: true });
  mockDemander.mockResolvedValue({ granted: true });
  mockJeton.mockResolvedValue(true);
});

describe('doitProposerNotifications', () => {
  it('propose à un élève avec compte dont la permission n’est pas encore donnée', async () => {
    expect(await doitProposerNotifications({ invite: false, maintenant: MAINTENANT })).toBe(true);
  });

  it('jamais pour un invité', async () => {
    expect(await doitProposerNotifications({ invite: true })).toBe(false);
    expect(mockLire).not.toHaveBeenCalled();
  });

  it('pas si la permission est déjà accordée', async () => {
    mockLire.mockResolvedValue({ granted: true, canAskAgain: true });
    expect(await doitProposerNotifications({ invite: false })).toBe(false);
  });

  it('pas si le système a refusé pour de bon', async () => {
    mockLire.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await doitProposerNotifications({ invite: false })).toBe(false);
  });

  it('pas si l’état de la permission est illisible', async () => {
    mockLire.mockRejectedValue(new Error('module absent'));
    expect(await doitProposerNotifications({ invite: false })).toBe(false);
  });

  it('« Plus tard » : pas de relance avant 7 jours, puis de nouveau possible', async () => {
    await noterPropositionPlusTard(MAINTENANT);
    expect(DELAI_RELANCE_JOURS).toBe(7);
    expect(await doitProposerNotifications({ invite: false, maintenant: new Date(MAINTENANT.getTime() + 1 * JOUR) })).toBe(false);
    expect(await doitProposerNotifications({ invite: false, maintenant: new Date(MAINTENANT.getTime() + 6.9 * JOUR) })).toBe(false);
    expect(await doitProposerNotifications({ invite: false, maintenant: new Date(MAINTENANT.getTime() + 7 * JOUR) })).toBe(true);
  });

  it('une fois terminée (acceptée ou refusée au téléphone), plus jamais', async () => {
    await accepterNotifications(client, MAINTENANT);
    mockLire.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await doitProposerNotifications({ invite: false, maintenant: new Date(MAINTENANT.getTime() + 90 * JOUR) })).toBe(false);
  });

  it('un état enregistré illisible compte pour « jamais proposé »', async () => {
    await AsyncStorage.setItem(CLE_PROPOSITION, 'pas du json');
    expect(await doitProposerNotifications({ invite: false })).toBe(true);
    await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ statut: 'autre', le: 'x' }));
    expect(await doitProposerNotifications({ invite: false })).toBe(true);
  });
});

describe('accepterNotifications', () => {
  it('demande la permission au téléphone puis donne le jeton au compte', async () => {
    expect(await accepterNotifications(client, MAINTENANT)).toBe(true);
    expect(mockDemander).toHaveBeenCalledTimes(1);
    expect(mockJeton).toHaveBeenCalledWith(client);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PROPOSITION)) ?? '{}')).toEqual({ statut: 'terminee', le: MAINTENANT.toISOString() });
  });

  it('refusée au téléphone : pas de jeton, proposition terminée quand même', async () => {
    mockDemander.mockResolvedValue({ granted: false });
    expect(await accepterNotifications(client, MAINTENANT)).toBe(false);
    expect(mockJeton).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PROPOSITION)) ?? '{}').statut).toBe('terminee');
  });

  it('une erreur du module natif ne bloque pas : considérée comme refusée', async () => {
    mockDemander.mockRejectedValue(new Error('indisponible'));
    expect(await accepterNotifications(client, MAINTENANT)).toBe(false);
    expect(mockJeton).not.toHaveBeenCalled();
  });
});

describe('« Plus tard »', () => {
  it('garde la date de la réponse', async () => {
    await noterPropositionPlusTard(MAINTENANT);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PROPOSITION)) ?? '{}')).toEqual({ statut: 'plus-tard', le: MAINTENANT.toISOString() });
  });
});
