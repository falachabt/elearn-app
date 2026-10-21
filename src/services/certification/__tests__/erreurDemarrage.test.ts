import { suivre } from '@/services/analytics';

import { definirApi } from '../api';
import { ErreurDemarrage, etapeDemarrage, signalerErreurDemarrage } from '../erreurDemarrage';
import { lancerMini } from '../miniTest';
import { lireReglages } from '../reglages';
import { creerApiFausse } from './apiFausse';
import { LIGNES_SEED } from './fixtures';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-test' }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const r = lireReglages(LIGNES_SEED);

beforeEach(() => jest.clearAllMocks());
afterEach(() => definirApi(null));

describe('erreur de démarrage : étape, code court et évènement', () => {
  it('garde l\'étape de l\'erreur et ne la redéclare pas à une étape suivante', async () => {
    const erreur = await etapeDemarrage('appel', () => Promise.reject(new Error('authentification requise'))).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurDemarrage);
    const relancee = await etapeDemarrage('stockage', () => Promise.reject(erreur)).catch((e: unknown) => e);
    expect((relancee as ErreurDemarrage).etape).toBe('appel');
  });

  it('le code est stable pour un même échec et signale l\'évènement sans donnée personnelle', () => {
    const erreur = new ErreurDemarrage('appel', new Error('authentification requise'));
    const premier = signalerErreurDemarrage('mini', 'MIN', erreur);
    const second = signalerErreurDemarrage('mini', 'MIN', erreur);
    expect(premier).toBe(second);
    expect(premier).toMatch(/^MIN-[0-9A-Z]{4}$/);
    expect(suivre).toHaveBeenCalledWith('cert_start_error', { ecran: 'mini', etape: 'appel', motif: 'authentification requise', code: premier });
  });

  it('une erreur sans étape connue est marquée « inconnue »', () => {
    signalerErreurDemarrage('diagnostic', 'DIA', new Error('réseau'));
    expect(suivre).toHaveBeenCalledWith('cert_start_error', expect.objectContaining({ etape: 'inconnue', ecran: 'diagnostic' }));
  });
});

describe('lancement du mini-test : un seul appel à la fois', () => {
  it('deux lancements simultanés n\'envoient qu\'un appel au serveur', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    const [a, b] = await Promise.all([lancerMini('toeic', null, 10, r), lancerMini('toeic', null, 10, r)]);
    expect(appels.minis).toHaveLength(1);
    expect(a).toBe(b);
    expect(a.statut).toBe('demarre');
  });

  it('un échec serveur remonte avec l\'étape « appel »', async () => {
    const { api } = creerApiFausse({ mini: 'echec' });
    definirApi(api);
    const erreur = await lancerMini('toeic', null, 10, r).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurDemarrage);
    expect((erreur as ErreurDemarrage).etape).toBe('appel');
  });
});
