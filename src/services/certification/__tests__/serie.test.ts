import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import { lireReglages } from '../reglages';
import { LIGNES_SEED } from './fixtures';
import {
  ajouterMotCarnet,
  avancer,
  demarrerSerie,
  lireSerieEnCours,
  questionRepondue,
  repondreSerie,
  reprendreOuDemarrer,
  resultatCourant,
  resumerSerie,
} from '../serie';
import { creerApiFausse } from './apiFausse';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));

const reglages = lireReglages(LIGNES_SEED);

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('série d’entraînement', () => {
  it('tire une série dans le périmètre demandé et la garde sur l’appareil', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    const e = await demarrerSerie('toeic', { part: 5 }, 3);
    expect(appels.series).toEqual([{ part: 5 }]);
    expect(e.questions).toHaveLength(3);
    expect(e.questions.every((q) => q.part === 5)).toBe(true);
    expect(await lireSerieEnCours()).toMatchObject({ index: 0, termine: false });
  });

  it('serveur injoignable : erreur et aucune série enregistrée', async () => {
    definirApi(creerApiFausse({ echecSerie: true }).api);
    await expect(demarrerSerie('toeic', { part: 5 })).rejects.toThrow();
    expect(await lireSerieEnCours()).toBeNull();
  });

  it('reprend la série en cours de même périmètre, en tire une autre sinon', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    const a = await reprendreOuDemarrer('toeic', { part: 5 });
    const b = await reprendreOuDemarrer('toeic', { part: 5 });
    expect(b.clientUuid).toBe(a.clientUuid);
    expect(appels.series).toHaveLength(1);
    const c = await reprendreOuDemarrer('toeic', { part: 6 });
    expect(c.clientUuid).not.toBe(a.clientUuid);
  });

  it('une réponse reçoit son corrigé sans faire avancer l’index (B9)', async () => {
    definirApi(creerApiFausse().api);
    let e = await demarrerSerie('toeic', { part: 5 }, 3);
    expect(questionRepondue(e)).toBe(false);
    e = await repondreSerie(e, 1, 4200);
    expect(e.index).toBe(0);
    expect(questionRepondue(e)).toBe(true);
    expect(resultatCourant(e)).toMatchObject({ correct: false, correct_index: 0 });
    expect(e.reponses[0]).toMatchObject({ chosen: 1, ms: 4200, context: 'series' });
    expect(e.enAttente).toEqual([]);
  });

  it('une même question ne reçoit qu’une réponse (double toucher)', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    let e = await demarrerSerie('toeic', { part: 5 }, 3);
    e = await repondreSerie(e, 0, 1000);
    e = await repondreSerie(e, 1, 1000);
    expect(e.reponses).toHaveLength(1);
    expect(appels.envois).toBe(1);
  });

  it('hors ligne : la réponse reste en file, la série avance, le corrigé arrive au retour du réseau', async () => {
    const { api } = creerApiFausse({ echecsEnvoi: 1 });
    definirApi(api);
    let e = await demarrerSerie('toeic', { part: 5 }, 3);
    e = await repondreSerie(e, 0, 1000);
    expect(e.enAttente).toHaveLength(1);
    expect(resultatCourant(e)).toBeNull();
    expect(questionRepondue(e)).toBe(true);
    e = await avancer(e);
    expect(e.index).toBe(1);
    expect(e.enAttente).toEqual([]);
    expect(Object.keys(e.resultats)).toHaveLength(1);
    expect((await lireSerieEnCours())?.enAttente).toEqual([]);
  });

  it('la dernière réponse clôt la série', async () => {
    definirApi(creerApiFausse().api);
    let e = await demarrerSerie('toeic', { part: 5 }, 2);
    for (let i = 0; i < 2; i++) {
      e = await repondreSerie(e, 0, 1000);
      e = await avancer(e);
    }
    expect(e.termine).toBe(true);
    expect((await reprendreOuDemarrer('toeic', { part: 5 })).termine).toBe(false);
  });

  it('une question passée est une réponse vide, jamais comptée réussie', async () => {
    definirApi(creerApiFausse().api);
    let e = await demarrerSerie('toeic', { part: 5 }, 2);
    e = await repondreSerie(e, null, 500);
    e = await avancer(e);
    e = await repondreSerie(e, 0, 500);
    const r = resumerSerie(e, reglages);
    expect(r).toMatchObject({ total: 2, repondues: 1, bonnes: 1, ratees: 1 });
  });

  it('ajoute un mot clé au carnet une seule fois', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    let e = await demarrerSerie('toeic', { part: 5 }, 2);
    e = await ajouterMotCarnet(e, { id: 'w-1', word: 'word1' });
    e = await ajouterMotCarnet(e, { id: 'w-1', word: 'word1' });
    expect(appels.mots).toEqual(['w-1']);
    expect(e.motsAjoutes).toHaveLength(1);
  });

  it('B11 : ratées, notions touchées, mots ajoutés et délais de rejeu lus en configuration', async () => {
    definirApi(creerApiFausse().api);
    let e = await demarrerSerie('toeic', { part: 5 }, 3);
    e = await repondreSerie(e, 1, 100);
    e = await avancer(e);
    e = await repondreSerie(e, 0, 100);
    e = await avancer(e);
    e = await repondreSerie(e, 2, 100);
    e = await avancer(e);
    e = await ajouterMotCarnet(e, { id: 'w-extra', word: 'extra' });
    const r = resumerSerie(e, reglages);
    expect(r.ratees).toBe(2);
    expect(r.bonnes).toBe(1);
    expect(r.notions.map((n) => n.title)).toEqual(['Notion 5']);
    expect(r.mots).toHaveLength(3);
    expect(r.mots.some((m) => m.word === 'extra')).toBe(true);
    expect(r.delaisRejeu).toEqual(reglages.delaisRejeuJours.slice(0, 2));
  });
});
