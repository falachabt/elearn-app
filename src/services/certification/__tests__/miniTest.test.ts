import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import { notionsPerdues } from '../bilanMini';
import { chronometre, minutesSecondes } from '../format';
import {
  abandonnerMini, cloreParTemps, dureeMiniMin, effacerMini, etatDeReprise, lancerMini, lireMini, longueurMiniServie, longueursMiniServies, longueursPossibles, minuteEcoulee,
  repondreMini, tempsRestantMs, terminerMini, type EtatMini,
} from '../miniTest';
import { lireReglages } from '../reglages';
import { derniereEstimation, testsFaits } from '../testsAccueil';
import type { ResultatReponse, TentativeListee } from '../types';
import { creerApiFausse } from './apiFausse';
import { LIGNES_SEED } from './fixtures';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));

const r = lireReglages(LIGNES_SEED);
const T0 = Date.parse('2026-10-16T10:00:00');

const etatDe = (surcharge: Partial<EtatMini> = {}): EtatMini => ({
  clientUuid: 'c', exam: 'toeic', partie: 5, longueur: 10,
  tentative: { attempt_id: 'a', kind: 'mini', part: 5, length: 3, status: 'in_progress', started_at: new Date(T0).toISOString(), credits_spent: 1, questions: [], replay: false },
  debutMs: T0, dureeMin: 10, reponses: [], index: 0, termine: false, fin: null, ...surcharge,
});

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('formules du mini-test', () => {
  it('la durée vient du réglage : 10 minutes pour 10 questions, 20 pour 20', () => {
    expect(dureeMiniMin(10, r)).toBe(r.miniMinutesPour10);
    expect(dureeMiniMin(20, r)).toBe(2 * r.miniMinutesPour10);
  });

  it('la durée est au prorata du nombre de questions : 12 questions, 12/10 du temps de base', () => {
    expect(dureeMiniMin(12, r)).toBeCloseTo(1.2 * r.miniMinutesPour10, 9);
  });

  it('longueur servie par partie : le réglage du serveur fait foi (12 pour les parties 3, 4 et 6)', () => {
    expect(longueurMiniServie(3, r)).toBe(12);
    expect(longueurMiniServie(4, r)).toBe(12);
    expect(longueurMiniServie(6, r)).toBe(12);
    expect(longueurMiniServie(1, r)).toBe(10);
    expect(longueurMiniServie(2, r)).toBe(10);
    expect(longueurMiniServie(5, r)).toBe(10);
    expect(longueurMiniServie(7, r)).toBe(10);
    expect(longueurMiniServie(null, r)).toBe(10);
    expect(longueursMiniServies(r)).toEqual([10, 12]);
  });

  it('sans réglage servi, la longueur retombe à 10 partout — et la lecture tolère la ligne absente ou illisible', () => {
    expect(longueurMiniServie(6, null)).toBe(10);
    expect(longueurMiniServie(6, { miniLongueursParPartie: null })).toBe(10);
    expect(longueursMiniServies(null)).toEqual([10]);
    const sansLigne = LIGNES_SEED.filter((l) => l.key !== 'test_mini_length_by_part');
    expect(lireReglages(sansLigne).miniLongueursParPartie).toBeNull();
    expect(lireReglages([...sansLigne, { key: 'test_mini_length_by_part', value: 'douze' }]).miniLongueursParPartie).toBeNull();
  });

  it('20 questions seulement en mixte ou sur les parties 5 à 7', () => {
    expect(longueursPossibles(null)).toEqual([10, 20]);
    expect(longueursPossibles(5)).toEqual([10, 20]);
    expect(longueursPossibles(7)).toEqual([10, 20]);
    expect(longueursPossibles(1)).toEqual([10]);
    expect(longueursPossibles(4)).toEqual([10]);
  });

  it('le temps restant se calcule sur l’horodatage absolu et ne devient jamais négatif', () => {
    const e = etatDe();
    expect(tempsRestantMs(e, T0)).toBe(10 * 60_000);
    expect(tempsRestantMs(e, T0 + 5 * 60_000 + 50_000)).toBe(4 * 60_000 + 10_000);
    expect(tempsRestantMs(e, T0 + 11 * 60_000)).toBe(0);
  });

  it('formate le temps restant et le chronomètre', () => {
    expect(minutesSecondes(4 * 60_000 + 10_000)).toBe('4 min 10');
    expect(chronometre(4 * 60_000 + 10_000)).toBe('04:10');
    expect(chronometre(-5)).toBe('00:00');
    expect(minuteEcoulee(etatDe(), T0 + 6 * 60_000 + 59_000)).toBe(6);
  });
});

describe('reprise d’un test interrompu (T3)', () => {
  const tol = r.repriseToleranceMin;
  it('en cours tant que du temps reste', () => {
    expect(etatDeReprise(etatDe(), r, T0 + 60_000)).toBe('en_cours');
  });
  it('à rendre quand le temps est écoulé mais la tolérance court encore', () => {
    expect(etatDeReprise(etatDe(), r, T0 + 10 * 60_000 + 1)).toBe('a_rendre');
    expect(etatDeReprise(etatDe(), r, T0 + (10 + tol) * 60_000)).toBe('a_rendre');
  });
  it('périmé au-delà de la durée plus la tolérance', () => {
    expect(etatDeReprise(etatDe(), r, T0 + (10 + tol) * 60_000 + 1)).toBe('perime');
  });
  it('terminé quand le bilan est calculé, à rendre quand toutes les questions sont vues', () => {
    expect(etatDeReprise(etatDe({ termine: true }), r, T0 + 60_000)).toBe('a_rendre');
    expect(etatDeReprise(etatDe({ fin: { status: 'finished', attempt_id: 'a', kind: 'mini', estimated: false, score: null, score_min: null, score_max: null, per_part: {}, results: [], replay: false } }), r, T0)).toBe('termine');
  });
});

describe('déroulé d’un mini-test', () => {
  it('lance, garde l’état sur l’appareil, et le départ est idempotent côté serveur par client_uuid', async () => {
    const f = creerApiFausse();
    definirApi(f.api);
    const res = await lancerMini('toeic', 5, 10, r);
    expect(res.statut).toBe('demarre');
    expect(f.appels.minis).toEqual([{ partie: 5, longueur: 10 }]);
    const lu = await lireMini();
    // La fausse banque sert 3 questions de partie 5 (plan du diagnostic) : la durée suit le nombre servi, pas le palier demandé.
    expect(lu?.tentative.questions).toHaveLength(3);
    expect(lu?.dureeMin).toBe(dureeMiniMin(3, r));
    expect(lu?.tentative.kind).toBe('mini');
    expect(lu?.reponses).toEqual([]);
  });

  it('le minuteur suit le nombre servi : 12 questions servies au palier de 10 en partie 6, durée au prorata', async () => {
    const f = creerApiFausse();
    // Le serveur sert 12 questions pour la partie 6 au palier de base (groupes entiers), quel que soit le palier demandé.
    definirApi({
      ...f.api,
      demarrerMini: async (clientUuid, exam, partie, longueur, jour) => {
        const rep = await f.api.demarrerMini(clientUuid, exam, partie, longueur, jour);
        if (!rep.tentative) return rep;
        const questions = Array.from({ length: 12 }, (_, i) => ({
          id: `p6-${i + 1}`, part: 6, type: 'qcm', number: i + 1, stem: `Question ${i + 1}`, options: ['a', 'b', 'c', 'd'], group: null,
        }));
        return { ...rep, tentative: { ...rep.tentative, length: 12, questions } };
      },
    });
    const res = await lancerMini('toeic', 6, 10, r);
    expect(res.statut).toBe('demarre');
    if (res.statut !== 'demarre') return;
    expect(res.etat.tentative.questions).toHaveLength(12);
    expect(res.etat.dureeMin).toBeCloseTo(1.2 * r.miniMinutesPour10, 9);
    expect((await lireMini())?.dureeMin).toBeCloseTo(1.2 * r.miniMinutesPour10, 9);
  });

  it('solde insuffisant : aucune tentative n’est gardée', async () => {
    definirApi(creerApiFausse({ mini: 'insufficient' }).api);
    const res = await lancerMini('toeic', null, 20, r);
    expect(res).toEqual({ statut: 'insuffisant', cout: 2, solde: 0 });
    expect(await lireMini()).toBeNull();
  });

  it('invité : le serveur demande un compte', async () => {
    definirApi(creerApiFausse({ mini: 'account_required' }).api);
    expect((await lancerMini('toeic', null, 10, r)).statut).toBe('compte_requis');
    expect(await lireMini()).toBeNull();
  });

  it('répond une seule fois par question, sans correction, contexte « test »', async () => {
    const f = creerApiFausse();
    definirApi(f.api);
    const lance = await lancerMini('toeic', 5, 10, r);
    if (lance.statut !== 'demarre') throw new Error('départ attendu');
    const un = await repondreMini(lance.etat, 0, 1234);
    expect(un.index).toBe(1);
    expect(un.reponses[0]).toMatchObject({ chosen: 0, ms: 1234, context: 'test', attempt_id: lance.etat.tentative.attempt_id });
    // La même question ne reçoit pas une seconde réponse.
    const rejoue = await repondreMini({ ...un, index: 0 }, 1, 10);
    expect(rejoue.reponses).toHaveLength(1);
    let courant = un;
    while (!courant.termine) courant = await repondreMini(courant, null, 5);
    expect(courant.reponses.every((x) => x.context === 'test')).toBe(true);
    expect(courant.reponses.at(-1)?.chosen).toBeNull();
  });

  it('le temps écoulé clôt le test avec les réponses données', async () => {
    const f = creerApiFausse();
    definirApi(f.api);
    const lance = await lancerMini('toeic', 5, 10, r);
    if (lance.statut !== 'demarre') throw new Error('départ attendu');
    const un = await repondreMini(lance.etat, 0, 10);
    const clos = await cloreParTemps(un);
    expect(clos.termine).toBe(true);
    expect((await lireMini())?.termine).toBe(true);
    const fin = await terminerMini(clos);
    expect(fin.fin?.kind).toBe('mini');
    expect(f.appels.terminer).toBe(1);
    // Rejouer le bilan n’appelle pas le serveur une seconde fois.
    await terminerMini(fin);
    expect(f.appels.terminer).toBe(1);
  });

  it('mini-test par partie : pas de fourchette de score ; mixte : une fourchette', async () => {
    const f = creerApiFausse();
    definirApi(f.api);
    const partie = await lancerMini('toeic', 5, 10, r);
    if (partie.statut !== 'demarre') throw new Error('départ attendu');
    const finPartie = await terminerMini(await cloreParTemps(await repondreMini(partie.etat, 0, 1)));
    expect(finPartie.fin).toMatchObject({ estimated: false, score: null, score_min: null, score_max: null });
    const mixte = await lancerMini('toeic', null, 10, r);
    if (mixte.statut !== 'demarre') throw new Error('départ attendu');
    const finMixte = await terminerMini(await cloreParTemps(await repondreMini(mixte.etat, 0, 1)));
    expect(finMixte.fin).toMatchObject({ estimated: true, score_min: 650, score_max: 730 });
  });

  it('un échec réseau garde les réponses : le bilan se rejoue', async () => {
    const f = creerApiFausse({ echecsTerminer: 1 });
    definirApi(f.api);
    const lance = await lancerMini('toeic', 5, 10, r);
    if (lance.statut !== 'demarre') throw new Error('départ attendu');
    const clos = await cloreParTemps(await repondreMini(lance.etat, 0, 1));
    await expect(terminerMini(clos)).rejects.toThrow();
    expect((await lireMini())?.fin).toBeNull();
    expect((await terminerMini((await lireMini())!)).fin).not.toBeNull();
  });

  it('abandon : demande au serveur puis efface l’état local', async () => {
    const f = creerApiFausse({ abandon: { rembourse: true } });
    definirApi(f.api);
    const lance = await lancerMini('toeic', 5, 10, r);
    if (lance.statut !== 'demarre') throw new Error('départ attendu');
    expect(await abandonnerMini(lance.etat, 'user')).toEqual({ rembourse: true });
    expect(f.appels.abandons).toEqual([{ id: lance.etat.tentative.attempt_id, raison: 'user' }]);
    expect(await lireMini()).toBeNull();
    await effacerMini();
  });

  it('abandon sans réseau : l’état local est conservé', async () => {
    const f = creerApiFausse();
    f.api.abandonnerTentative = async () => {
      throw new Error('réseau');
    };
    definirApi(f.api);
    const lance = await lancerMini('toeic', 5, 10, r);
    if (lance.statut !== 'demarre') throw new Error('départ attendu');
    await expect(abandonnerMini(lance.etat, 'user')).rejects.toThrow();
    expect(await lireMini()).not.toBeNull();
  });
});

describe('bilan et historique', () => {
  const res = (id: string, notion: string | null, correct: boolean): ResultatReponse => ({
    question_id: id, client_uuid: id, correct, skipped: false, correct_index: 0, trap: null,
    notion: notion ? { id: notion, code: notion, title: `Notion ${notion}`, family: 'grammaire' } : null, notions: [], transcript: null, replay: false,
  });

  it('les notions qui coûtent le plus : fausses ou passées, regroupées, trois au plus', () => {
    const liste = [res('1', 'a', false), res('2', 'a', false), res('3', 'b', false), res('4', 'c', false), res('5', 'c', false), res('6', 'c', false), res('7', 'd', false), res('8', 'a', true), res('9', null, false)];
    expect(notionsPerdues(liste).map((n) => [n.id, n.manquees])).toEqual([['c', 3], ['a', 2], ['b', 1]]);
    expect(notionsPerdues([res('1', 'a', true)])).toEqual([]);
  });

  const ligne = (surcharge: Partial<TentativeListee>): TentativeListee => ({
    id: 'x', kind: 'mini', part: 5, length: 10, status: 'finished', scoreMin: null, scoreMax: null, startedAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T10:08:00Z',
    perPart: null, timePerPart: null, creditsSpent: 1, refunded: false, questions: [], ...surcharge,
  });

  it('tests faits : l’abandonné compte, le diagnostic et le test en cours non', () => {
    const liste = [ligne({ id: '1' }), ligne({ id: '2', status: 'abandoned' }), ligne({ id: '3', kind: 'diagnostic' }), ligne({ id: '4', status: 'in_progress' })];
    expect(testsFaits(liste)).toBe(2);
  });

  it('dernière estimation : la plus récente tentative terminée qui en porte une', () => {
    const liste = [ligne({ id: '1', scoreMin: null }), ligne({ id: '2', scoreMin: 650, scoreMax: 730 }), ligne({ id: '3', scoreMin: 500, scoreMax: 600 })];
    expect(derniereEstimation(liste)).toEqual({ min: 650, max: 730 });
    expect(derniereEstimation([ligne({})])).toBeNull();
    expect(derniereEstimation([ligne({ status: 'abandoned', scoreMin: 1, scoreMax: 2 })])).toBeNull();
  });
});
