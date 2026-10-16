import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import {
  avancement,
  blocTermine,
  changerDuree,
  chargerSeanceJour,
  commencer,
  indexBlocSuivant,
  indexDuBloc,
  lireSeanceJour,
  pourquoiDeLaSeance,
  terminerBloc,
  terminerBlocSuivant,
} from '../seanceJour';
import { creerApiFausse } from './apiFausse';
import { JOUR, SEANCE_TEST } from './fixturesRevision';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('D2 · séance du jour', () => {
  it('compose la séance selon la durée choisie et la garde sur l’appareil', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    const e = await chargerSeanceJour('toeic', JOUR, 20);
    expect(appels.compositions).toEqual([{ minutes: 20, eviter: null }]);
    expect(e.seance.blocs).toHaveLength(4);
    expect(await lireSeanceJour()).toMatchObject({ jour: JOUR, termines: [] });
  });

  it('AC-D2-2 : un bloc terminé le reste après relance, sans recomposer', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    let e = await chargerSeanceJour('toeic', JOUR, 20);
    e = await terminerBloc(e, 0);
    const relance = await chargerSeanceJour('toeic', JOUR, 20);
    expect(appels.compositions).toHaveLength(1);
    expect(blocTermine(relance, 0)).toBe(true);
    expect(indexBlocSuivant(relance)).toBe(1);
    expect(avancement(relance)).toEqual({ faits: 1, total: 4 });
  });

  it('AC-D2-4 : changer la durée recompose une séance pas commencée', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    const e = await chargerSeanceJour('toeic', JOUR, 20);
    const dix = await changerDuree(e, 10);
    expect(dix.seance.minutes).toBe(10);
    expect(appels.compositions.map((c) => c.minutes)).toEqual([20, 10]);
    expect(dix.clientUuid).toBe(e.clientUuid);
  });

  it('une séance commencée n’est plus recomposée', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    let e = await chargerSeanceJour('toeic', JOUR, 20);
    e = await terminerBloc(e, 0);
    expect((await changerDuree(e, 30)).seance.minutes).toBe(20);
    expect((await chargerSeanceJour('toeic', JOUR, 30)).seance.minutes).toBe(20);
    expect(appels.compositions).toHaveLength(1);
  });

  it('AC-D2-3 : la séance est enregistrée à la fin du dernier bloc avec sa composition', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    let e = await commencer(await chargerSeanceJour('toeic', JOUR, 20), 1_000);
    for (const i of [0, 1, 2]) e = await terminerBloc(e, i, 2_000);
    expect(appels.seances).toHaveLength(0);
    e = await terminerBloc(e, 3, 1_000 + 12 * 60_000);
    expect(e.finie).toBe(true);
    expect(e.enregistree).toBe(true);
    expect(appels.seances).toHaveLength(1);
    expect(appels.seances[0]).toMatchObject({ clientUuid: e.clientUuid, composition: { minutes: 20, termines: [0, 1, 2, 3] } });
    expect(indexBlocSuivant(e)).toBeNull();
  });

  it('un bloc ne compte qu’une fois et un indice inconnu est ignoré', async () => {
    definirApi(creerApiFausse({ seance: SEANCE_TEST }).api);
    let e = await chargerSeanceJour('toeic', JOUR, 20);
    e = await terminerBloc(e, 1);
    e = await terminerBloc(e, 1);
    e = await terminerBloc(e, 9);
    expect(e.termines).toEqual([1]);
  });

  it('retrouve le bloc d’un type', async () => {
    definirApi(creerApiFausse({ seance: SEANCE_TEST }).api);
    const e = await chargerSeanceJour('toeic', JOUR, 20);
    expect(indexDuBloc(e, 'mots')).toBe(1);
    expect(indexDuBloc(e, 'serie')).toBe(3);
  });

  it('le lendemain, une nouvelle séance évite la partie de la série de la veille', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    await chargerSeanceJour('toeic', JOUR, 20);
    await chargerSeanceJour('toeic', '2026-10-17', 20);
    expect(appels.compositions.at(-1)).toEqual({ minutes: 20, eviter: 5 });
  });

  it('un échec du serveur remonte pour que l’écran propose de réessayer', async () => {
    definirApi(creerApiFausse({ seance: 'echec' }).api);
    await expect(chargerSeanceJour('toeic', JOUR, 20)).rejects.toThrow('réseau');
  });
});

describe('terminerBlocSuivant et pourquoiDeLaSeance', () => {
  it('clôt toujours le premier bloc pas terminé, jusqu’à la fin, puis ne fait plus rien', async () => {
    const { api, appels } = creerApiFausse({ seance: SEANCE_TEST });
    definirApi(api);
    await chargerSeanceJour('toeic', JOUR, 20);
    expect(await terminerBlocSuivant()).toMatchObject({ termines: [0] });
    expect(await terminerBlocSuivant()).toMatchObject({ termines: [0, 1] });
    await terminerBlocSuivant();
    const fin = await terminerBlocSuivant();
    expect(fin).toMatchObject({ termines: [0, 1, 2, 3], finie: true, enregistree: true });
    expect(await terminerBlocSuivant()).toMatchObject({ termines: [0, 1, 2, 3] });
    expect(appels.seances).toHaveLength(1);
    expect(jest.requireMock('@/services/analytics').suivre).toHaveBeenCalledWith('cert_session_completed', { composition: 'cours,mots,rejeu,serie' });
  });

  it('sans séance gardée, ne fait rien', async () => {
    expect(await terminerBlocSuivant()).toBeNull();
  });

  it('choisit la raison la plus forte sans inventer de chiffre', () => {
    expect(pourquoiDeLaSeance({ erreurs: 4, notion: 'Prépositions', motsEchus: 2 })).toEqual({ cle: 'pourquoiMots', params: { n: 4, notion: 'Prépositions', m: 2 } });
    expect(pourquoiDeLaSeance({ erreurs: 1, notion: 'Prépositions', motsEchus: 2 }).cle).toBe('pourquoiMotsUne');
    expect(pourquoiDeLaSeance({ erreurs: 4, notion: 'Prépositions', motsEchus: 0 }).cle).toBe('pourquoi');
    expect(pourquoiDeLaSeance({ erreurs: 1, notion: 'Prépositions', motsEchus: 0 }).cle).toBe('pourquoiUne');
    expect(pourquoiDeLaSeance({ erreurs: 0, notion: null, motsEchus: 1 }).cle).toBe('pourquoiMotUn');
    expect(pourquoiDeLaSeance({ erreurs: 0, notion: null, motsEchus: 5 })).toEqual({ cle: 'pourquoiMotsSeuls', params: { m: 5 } });
    expect(pourquoiDeLaSeance({ erreurs: 0, notion: null, motsEchus: 0 }).cle).toBe('pourquoiPlan');
  });
});
