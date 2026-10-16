import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import { lireReglages } from '../reglages';
import { carteCourante, choisirCartes, demarrerSeanceMots, lireSeanceMots, noterCarte, reprendreSeanceMots, resumerSeanceMots, retournerCarte, envoyerNotesEnAttente } from '../seanceMots';
import { creerApiFausse } from './apiFausse';
import { LIGNES_SEED } from './fixtures';
import { JOUR, MOTS_TEST } from './fixturesRevision';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));

const reglages = lireReglages(LIGNES_SEED);
const options = { taille: 10, origine: 'carnet' as const };

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('F5 · choix des cartes', () => {
  it('prend les mots échus, boîte croissante puis échéance la plus ancienne', () => {
    expect(choisirCartes(MOTS_TEST, JOUR, 10).map((m) => m.mot)).toEqual(['postpone', 'deadline']);
  });
  it('limite à la taille de la séance', () => {
    expect(choisirCartes(MOTS_TEST, JOUR, 1).map((m) => m.mot)).toEqual(['postpone']);
  });
  it('sans mot échu, la séance n’est pas proposée', async () => {
    expect(await demarrerSeanceMots('toeic', MOTS_TEST, options, '2026-01-01')).toBeNull();
  });
});

describe('C8 · séance de mots', () => {
  it('AC-C8-4 : on ne note qu’après avoir retourné la carte', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    const e = (await demarrerSeanceMots('toeic', MOTS_TEST, options, JOUR))!;
    const sansRetour = await noterCarte(e, true);
    expect(sansRetour.resultats).toHaveLength(0);
    expect(appels.resultatsMots).toHaveLength(0);
    const retournee = await retournerCarte(e);
    expect(retournee.retourne).toBe(true);
    const note = await noterCarte(retournee, true);
    expect(note.resultats).toHaveLength(1);
    expect(note.index).toBe(1);
    expect(note.retourne).toBe(false);
    expect(appels.resultatsMots[0][0]).toMatchObject({ wordId: 'w-postpone', connu: true, jour: JOUR });
  });

  it('AC-C8-3 : la progression avance après chaque note et la séance se clôt à la dernière', async () => {
    definirApi(creerApiFausse().api);
    let e = (await demarrerSeanceMots('toeic', MOTS_TEST, options, JOUR))!;
    expect(carteCourante(e)?.mot).toBe('postpone');
    e = await noterCarte(await retournerCarte(e), false);
    expect(carteCourante(e)?.mot).toBe('deadline');
    expect(e.termine).toBe(false);
    e = await noterCarte(await retournerCarte(e), true);
    expect(e.termine).toBe(true);
    expect(carteCourante(e)).toBeNull();
  });

  it('hors ligne : les notes restent en file puis repartent telles quelles (idempotent)', async () => {
    const { api, appels } = creerApiFausse({ echecsMots: 1 });
    definirApi(api);
    let e = (await demarrerSeanceMots('toeic', MOTS_TEST, options, JOUR))!;
    e = await noterCarte(await retournerCarte(e), true);
    expect(e.enAttente).toHaveLength(1);
    const uuid = e.enAttente[0].clientUuid;
    expect((await lireSeanceMots())!.enAttente).toHaveLength(1);
    e = await envoyerNotesEnAttente(e);
    expect(e.enAttente).toHaveLength(0);
    expect(appels.resultatsMots[0][0].clientUuid).toBe(uuid);
  });

  it('reprend la séance en cours de même origine, pas une autre', async () => {
    definirApi(creerApiFausse().api);
    await demarrerSeanceMots('toeic', MOTS_TEST, options, JOUR);
    expect(await reprendreSeanceMots('toeic', 'carnet')).not.toBeNull();
    expect(await reprendreSeanceMots('toeic', 'seance')).toBeNull();
  });
});

describe('C9 · fin de séance', () => {
  it('AC-C9-1 et AC-C9-2 : la somme des boîtes égale la séance, les échecs reviennent demain', async () => {
    definirApi(creerApiFausse().api);
    let e = (await demarrerSeanceMots('toeic', MOTS_TEST, options, JOUR))!;
    e = await noterCarte(await retournerCarte(e), false); // postpone : reste en boîte 1
    e = await noterCarte(await retournerCarte(e), true); // deadline : boîte 2 -> 3
    const r = resumerSeanceMots(e, reglages);
    expect(r).toMatchObject({ total: 2, sus: 1, aRevoir: 1, boites: { 1: 1, 2: 0, 3: 1, 4: 0 } });
    expect(r.boites[1] + r.boites[2] + r.boites[3] + r.boites[4]).toBe(r.total);
    expect(r.delaiAvant).toBe(reglages.delaisBoitesJours[0]);
  });

  it('AC-C8-1 : « Je savais » monte d’une boîte, plafonnée à 4', async () => {
    definirApi(creerApiFausse().api);
    const e0 = (await demarrerSeanceMots('toeic', [{ ...MOTS_TEST[3], prochaineRevue: JOUR }], options, JOUR))!;
    const e = await noterCarte(await retournerCarte(e0), true);
    expect(resumerSeanceMots(e, reglages).boites[4]).toBe(1);
    const e1 = (await demarrerSeanceMots('toeic', [{ ...MOTS_TEST[2], prochaineRevue: JOUR, boite: 3 }], options, JOUR))!;
    const fin = await noterCarte(await retournerCarte(e1), true);
    expect(resumerSeanceMots(fin, reglages).boites[4]).toBe(1);
  });
});
