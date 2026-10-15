import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import { demarrerOuReprendre, progression, repondre, terminer } from '../diagnostic';
import { CLE_DIAGNOSTIC, lireDiagnostic, lirePlan, ecrirePlan, obtenirExamens, obtenirReglages, CLE_CACHE_EXAMENS } from '../etat';
import { etapeCertification } from '../reprise';
import { creerApiFausse, EXAMEN_TEST } from './apiFausse';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    mockCompteur += 1;
    return `00000000-0000-4000-8000-${String(mockCompteur).padStart(12, '0')}`;
  },
}));

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('diagnostic : reprise et file locale (A6)', () => {
  it('tire une fois et reprend la même tentative après un redémarrage (AC-A6, reprise)', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    const a = await demarrerOuReprendre('toeic');
    expect(a.tentative?.questions).toHaveLength(20);
    const b = await demarrerOuReprendre('toeic');
    expect(b.clientUuid).toBe(a.clientUuid);
    expect(appels.demarrer).toBe(1);
  });

  it('range Listening puis Reading dans l’ordre des parties', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    const e = await demarrerOuReprendre('toeic');
    const parties = e.tentative!.questions.map((q) => q.part);
    expect(parties).toEqual([...parties].sort((x, y) => x - y));
  });

  it('chaque réponse est écrite sur l’appareil avant tout envoi, avec son client_uuid', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    let e = await demarrerOuReprendre('toeic');
    e = await repondre(e, 2, 4321.4);
    const sauve = await lireDiagnostic();
    expect(sauve?.reponses).toHaveLength(1);
    expect(sauve?.reponses[0]).toMatchObject({ chosen: 2, ms: 4321, context: 'diagnostic', attempt_id: e.tentative!.attempt_id });
    expect(sauve?.reponses[0].client_uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(sauve?.index).toBe(1);
  });

  it('« Passer » enregistre une réponse nulle et fait avancer (AC-A6-4)', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    let e = await demarrerOuReprendre('toeic');
    e = await repondre(e, null, 100);
    expect(e.reponses[0].chosen).toBeNull();
    expect(progression(e)).toEqual({ faites: 1, total: 20 });
  });

  it('un double appui n’enregistre pas deux réponses à la même question', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    const e = await demarrerOuReprendre('toeic');
    const [x, y] = await Promise.all([repondre(e, 1, 10), repondre(e, 1, 10)]);
    expect(x.reponses).toHaveLength(1);
    expect(y.reponses).toHaveLength(1);
  });

  it('la 20e réponse marque la fin locale (AC-A6-1, A8)', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    let e = await demarrerOuReprendre('toeic');
    for (let i = 0; i < 20; i++) e = await repondre(e, 0, 50);
    expect(e.termine).toBe(true);
    expect(e.reponses).toHaveLength(20);
    // Aucune réponse de plus après la fin.
    expect((await repondre(e, 0, 50)).reponses).toHaveLength(20);
  });

  it('hors ligne au démarrage : erreur claire, rien de gardé', async () => {
    definirApi(creerApiFausse({ echecDemarrer: true }).api);
    await expect(demarrerOuReprendre('toeic')).rejects.toThrow();
    expect(await AsyncStorage.getItem(CLE_DIAGNOSTIC)).toBeNull();
  });
});

describe('diagnostic : fin et résultat (A8, A7)', () => {
  const finir = async () => {
    let e = await demarrerOuReprendre('toeic');
    for (let i = 0; i < 20; i++) e = await repondre(e, i % 2 === 0 ? 0 : 1, 50);
    return e;
  };

  it('envoi échoué : les réponses restent, le second essai réussit (AC-A6-3, idempotent)', async () => {
    const { api, appels } = creerApiFausse({ echecsTerminer: 1 });
    definirApi(api);
    const e = await finir();
    await expect(terminer(e)).rejects.toThrow();
    expect((await lireDiagnostic())?.reponses).toHaveLength(20);
    const fini = await terminer(e);
    expect(fini.fin?.estimated).toBe(true);
    expect(appels.terminer).toBe(2);
    // Déjà terminé : pas de nouvel envoi.
    await terminer(fini);
    expect(appels.terminer).toBe(2);
  });

  it('le résultat par partie compte 10 bonnes sur 20', async () => {
    definirApi(creerApiFausse().api);
    const fini = await terminer(await finir());
    const total = Object.values(fini.fin!.per_part).reduce((a, p) => ({ answered: a.answered + p.answered, correct: a.correct + p.correct }), { answered: 0, correct: 0 });
    expect(total).toEqual({ answered: 20, correct: 10 });
  });
});

describe('reprise du parcours (AC-A8-2)', () => {
  const profil = { type: 'certification' as const, exam: 'toeic', termine: false };
  it('profil absent, terminé ou d’une autre sorte : aucune reprise', async () => {
    expect(await etapeCertification(null)).toBeNull();
    expect(await etapeCertification({ ...profil, termine: true })).toBeNull();
    expect(await etapeCertification({ type: 'eleve', termine: false })).toBeNull();
  });
  it('de l’examen choisi jusqu’au résultat, jamais en arrière', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    expect(await etapeCertification({ type: 'certification', termine: false })).toBe('/certification');
    expect(await etapeCertification(profil)).toBe('/certification/objectif');
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    expect(await etapeCertification(profil)).toBe('/certification/objectif');
    await ecrirePlan({ exam: 'toeic', minutes: 20 });
    expect(await etapeCertification(profil)).toBe('/certification/arrivee');
    let e = await demarrerOuReprendre('toeic');
    expect(await etapeCertification(profil)).toBe('/certification/arrivee');
    e = await repondre(e, 0, 10);
    expect(await etapeCertification(profil)).toBe('/certification/diagnostic');
    for (let i = 1; i < 20; i++) e = await repondre(e, 0, 10);
    expect(await etapeCertification(profil)).toBe('/certification/fin');
    await terminer(e);
    expect(await etapeCertification(profil)).toBe('/certification/resultat');
  });
});

describe('plan et listes en cache', () => {
  it('le plan est gardé sur l’appareil et envoyé au serveur sans bloquer (AC-A3, A4)', async () => {
    const { api, appels } = creerApiFausse();
    definirApi(api);
    await ecrirePlan({ exam: 'toeic', objectif: 820, dateTest: '2027-01-20' });
    await ecrirePlan({ exam: 'toeic', minutes: 30 });
    const plan = await lirePlan();
    expect(plan).toMatchObject({ exam: 'toeic', objectif: 820, dateTest: '2027-01-20', minutes: 30 });
    expect(appels.plans).toHaveLength(2);
  });
  it('effacer la date la retire du plan', async () => {
    definirApi(creerApiFausse().api);
    await ecrirePlan({ exam: 'toeic', objectif: 800, dateTest: '2027-01-20' });
    await ecrirePlan({ exam: 'toeic' }, { effacerDate: true });
    expect((await lirePlan())?.dateTest).toBeNull();
  });
  it('un échec du serveur n’empêche pas l’enregistrement local', async () => {
    const { api } = creerApiFausse();
    definirApi({ ...api, enregistrerPlan: () => Promise.reject(new Error('réseau')) });
    await expect(ecrirePlan({ exam: 'toeic', objectif: 700 })).resolves.toMatchObject({ objectif: 700 });
  });
  it('la liste des examens est reprise du cache hors ligne (A2)', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    expect((await obtenirExamens()).depuisCache).toBe(false);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_CACHE_EXAMENS))!)).toEqual([EXAMEN_TEST]);
    definirApi({ ...api, listerExamens: () => Promise.reject(new Error('hors ligne')) });
    const r = await obtenirExamens();
    expect(r).toEqual({ examens: [EXAMEN_TEST], depuisCache: true });
  });
  it('sans cache ni réseau, l’erreur remonte (état d’erreur de A2)', async () => {
    definirApi({ ...creerApiFausse().api, listerExamens: () => Promise.reject(new Error('hors ligne')) });
    await expect(obtenirExamens()).rejects.toThrow('hors ligne');
  });
  it('les réglages viennent du serveur puis du cache, jamais du code', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    expect((await obtenirReglages()).objectifDefaut).toBe(800);
    definirApi({ ...api, lireReglages: () => Promise.reject(new Error('hors ligne')) });
    expect((await obtenirReglages()).scoreMinReponses).toBe(20);
  });
});
