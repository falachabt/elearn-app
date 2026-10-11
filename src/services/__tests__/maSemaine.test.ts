import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_COPIE_RECAP,
  CLE_DERNIERE_SEMAINE_VUE,
  aDeLActivite,
  ajouterJours,
  cartesDe,
  depuisReponse,
  derniereSemaineVue,
  dimancheDe,
  doitTenterOuvertureAuto,
  jourCourt,
  joursFaits,
  lireRecap,
  lundiDe,
  marquerSemaineVue,
  recapExpire,
  semainePrecedente,
  titreMissions,
  type Recap,
} from '../maSemaine';

jest.mock('../connectivite', () => ({
  ...jest.requireActual('../connectivite'),
  signalerEchec: jest.fn(),
  signalerSucces: jest.fn(),
}));

const BRUT = {
  semaine: '2026-09-28',
  missions: 5,
  missions_par_jour: [1, 1, 0, 1, 1, 1, 0],
  lecons_validees: 14,
  quiz_termines: 6,
  exercices_faits: 9,
  questions_ratees: 12,
  credits_utilises: 38,
  pass_actif: false,
  solde: 27,
  recharge_lundi: 25,
};

const recap = (extra: Partial<Recap> = {}): Recap => ({ ...(depuisReponse(BRUT) as Recap), ...extra });
const client = (reponse: unknown) => {
  const rpc = jest.fn(async (..._args: unknown[]) => reponse);
  return Object.assign({ rpc } as unknown as Parameters<typeof lireRecap>[0], { espion: rpc });
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('lecture de la réponse du serveur', () => {
  it('convertit tous les champs', () => {
    expect(depuisReponse(BRUT)).toEqual({
      semaine: '2026-09-28',
      missions: 5,
      missionsParJour: [true, true, false, true, true, true, false],
      leconsValidees: 14,
      quizTermines: 6,
      exercicesFaits: 9,
      questionsRatees: 12,
      creditsUtilises: 38,
      passActif: false,
      solde: 27,
      rechargeLundi: 25,
    });
  });

  it('refuse ce qui n’est pas un récap', () => {
    for (const mauvais of [null, undefined, 'x', 3, [], {}, { semaine: '28/09' }, { semaine: 12 }]) expect(depuisReponse(mauvais)).toBeNull();
  });

  it('remplace les valeurs illisibles par 0 et masque la grille si elle manque ou est mal formée', () => {
    const r = depuisReponse({ semaine: '2026-09-28', missions: -3, lecons_validees: 'beaucoup', quiz_termines: null, missions_par_jour: [1, 0] });
    expect(r).toMatchObject({ missions: 0, leconsValidees: 0, quizTermines: 0, exercicesFaits: 0, creditsUtilises: 0, missionsParJour: null, passActif: false });
    expect(depuisReponse({ semaine: '2026-09-28' })?.missionsParJour).toBeNull();
  });

  it('compte les jours faits', () => {
    expect(joursFaits(recap())).toBe(5);
    expect(joursFaits(recap({ missionsParJour: null }))).toBe(0);
  });
});

describe('semaines (lundi à dimanche, heure locale)', () => {
  it('trouve le lundi de n’importe quel jour de la semaine', () => {
    // 2026-10-05 est un lundi, 2026-10-11 un dimanche.
    expect(lundiDe(new Date(2026, 9, 5, 0, 5))).toBe('2026-10-05');
    expect(lundiDe(new Date(2026, 9, 8, 14))).toBe('2026-10-05');
    expect(lundiDe(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-05');
    expect(lundiDe(new Date(2026, 9, 12, 0, 0))).toBe('2026-10-12');
  });

  it('la semaine résumée est la précédente', () => {
    expect(semainePrecedente(new Date(2026, 9, 5, 8))).toBe('2026-09-28');
    expect(semainePrecedente(new Date(2026, 9, 11, 22))).toBe('2026-09-28');
    expect(semainePrecedente(new Date(2026, 0, 1))).toBe('2025-12-22');
  });

  it('ajoute des jours à travers les fins de mois et d’année', () => {
    expect(ajouterJours('2026-09-28', 6)).toBe('2026-10-04');
    expect(ajouterJours('2025-12-29', 7)).toBe('2026-01-05');
    expect(dimancheDe('2026-09-28')).toBe('2026-10-04');
  });

  it('formate les jours courts dans la langue', () => {
    expect(jourCourt('2026-09-28', 'fr')).toMatch(/^28 sept\.?$/);
    expect(jourCourt('2026-10-04', 'fr')).toMatch(/^4 oct\.?$/);
    expect(jourCourt('2026-09-28', 'en')).toMatch(/28 Sep/);
  });

  it('une semaine de plus de 8 semaines est expirée', () => {
    const maintenant = new Date(2026, 9, 12, 9); // lundi 12 octobre
    expect(recapExpire('2026-10-05', maintenant)).toBe(false);
    expect(recapExpire('2026-08-17', maintenant)).toBe(false); // 8 semaines pile
    expect(recapExpire('2026-08-10', maintenant)).toBe(true);
  });
});

describe('cartes affichées', () => {
  it('quatre cartes quand tout est non nul', () => {
    expect(cartesDe(recap())).toEqual(['missions', 'appris', 'ratees', 'credits']);
  });

  it('saute les cartes à zéro et garde toujours la première', () => {
    expect(cartesDe(recap({ questionsRatees: 0 }))).toEqual(['missions', 'appris', 'credits']);
    expect(cartesDe(recap({ creditsUtilises: 0 }))).toEqual(['missions', 'appris', 'ratees']);
    expect(cartesDe(recap({ leconsValidees: 0, quizTermines: 0, exercicesFaits: 0 }))).toEqual(['missions', 'ratees', 'credits']);
    expect(cartesDe(recap({ questionsRatees: 0, creditsUtilises: 0 }))).toEqual(['missions', 'appris']);
    expect(cartesDe(recap({ leconsValidees: 0, quizTermines: 0, exercicesFaits: 0, questionsRatees: 0, creditsUtilises: 0 }))).toEqual(['missions']);
  });

  it('un seul des trois éléments de la carte 2 suffit à l’afficher', () => {
    const base = { leconsValidees: 0, quizTermines: 0, exercicesFaits: 0, questionsRatees: 0, creditsUtilises: 0 };
    expect(cartesDe(recap({ ...base, exercicesFaits: 1 }))).toEqual(['missions', 'appris']);
    expect(cartesDe(recap({ ...base, quizTermines: 1 }))).toEqual(['missions', 'appris']);
  });

  it('la carte des crédits reste avec un Pass actif, même sans crédit dépensé', () => {
    expect(cartesDe(recap({ passActif: true, creditsUtilises: 0, questionsRatees: 0 }))).toEqual(['missions', 'appris', 'credits']);
  });

  it('l’activité compte missions, leçons, quiz et exercices, jamais les crédits seuls', () => {
    const rien = { missions: 0, leconsValidees: 0, quizTermines: 0, exercicesFaits: 0 };
    expect(aDeLActivite(recap({ ...rien, creditsUtilises: 40 }))).toBe(false);
    expect(aDeLActivite(recap({ ...rien, missions: 1 }))).toBe(true);
    expect(aDeLActivite(recap({ ...rien, leconsValidees: 1 }))).toBe(true);
    expect(aDeLActivite(recap({ ...rien, quizTermines: 1 }))).toBe(true);
    expect(aDeLActivite(recap({ ...rien, exercicesFaits: 1 }))).toBe(true);
  });

  it('titre de la carte 1 selon les missions', () => {
    expect([0, 1, 3, 4, 6, 7].map(titreMissions)).toEqual(['avance', 'debut', 'debut', 'regularite', 'regularite', 'pleine']);
  });
});

describe('semaine déjà vue', () => {
  it('ne recule jamais', async () => {
    expect(await derniereSemaineVue()).toBeNull();
    await marquerSemaineVue('2026-09-28');
    await marquerSemaineVue('2026-09-14');
    expect(await derniereSemaineVue()).toBe('2026-09-28');
    await marquerSemaineVue('2026-10-05');
    expect(await derniereSemaineVue()).toBe('2026-10-05');
  });

  it('ignore une valeur illisible', async () => {
    await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, 'demain');
    expect(await derniereSemaineVue()).toBeNull();
  });

  it('ouverture automatique : seulement si la semaine précédente n’a pas été vue, jamais pour l’invité', () => {
    const maintenant = new Date(2026, 9, 6, 9); // mardi 6 octobre : récap de la semaine du 28 septembre
    expect(doitTenterOuvertureAuto({ invite: false, derniereVue: null, maintenant })).toBe(true);
    expect(doitTenterOuvertureAuto({ invite: false, derniereVue: '2026-09-21', maintenant })).toBe(true);
    expect(doitTenterOuvertureAuto({ invite: false, derniereVue: '2026-09-28', maintenant })).toBe(false);
    expect(doitTenterOuvertureAuto({ invite: false, derniereVue: '2026-10-05', maintenant })).toBe(false);
    expect(doitTenterOuvertureAuto({ invite: true, derniereVue: null, maintenant })).toBe(false);
  });

  it('la semaine suivante, le récap redevient à voir', () => {
    expect(doitTenterOuvertureAuto({ invite: false, derniereVue: '2026-09-28', maintenant: new Date(2026, 9, 13, 9) })).toBe(true);
  });
});

describe('lireRecap', () => {
  it('lit la semaine demandée et garde une copie sur l’appareil', async () => {
    const c = client({ data: BRUT, error: null });
    const r = await lireRecap(c, '2026-09-28');
    expect(c.espion).toHaveBeenCalledWith('my_week_recap', { p_semaine: '2026-09-28' });
    expect(r.copie).toBe(false);
    expect(r.recap?.missions).toBe(5);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_COPIE_RECAP('2026-09-28'))) ?? '{}').missions).toBe(5);
  });

  it('sans semaine, demande la précédente', async () => {
    const c = client({ data: BRUT, error: null });
    await lireRecap(c, null, new Date(2026, 9, 6, 9));
    expect(c.espion).toHaveBeenCalledWith('my_week_recap', { p_semaine: '2026-09-28' });
  });

  it('une semaine mal formée est remplacée par la précédente', async () => {
    const c = client({ data: BRUT, error: null });
    await lireRecap(c, 'hier', new Date(2026, 9, 6, 9));
    expect(c.espion).toHaveBeenCalledWith('my_week_recap', { p_semaine: '2026-09-28' });
  });

  it('pas de récap : réponse nulle, invalide ou sans activité', async () => {
    expect((await lireRecap(client({ data: null, error: null }), '2026-09-28')).recap).toBeNull();
    expect((await lireRecap(client({ data: { nimporte: 1 }, error: null }), '2026-09-28')).recap).toBeNull();
    const vide = { ...BRUT, missions: 0, lecons_validees: 0, quiz_termines: 0, exercices_faits: 0 };
    expect((await lireRecap(client({ data: vide, error: null }), '2026-09-28')).recap).toBeNull();
    expect(await AsyncStorage.getItem(CLE_COPIE_RECAP('2026-09-28'))).toBeNull();
  });

  it('hors ligne : renvoie la copie gardée', async () => {
    await lireRecap(client({ data: BRUT, error: null }), '2026-09-28');
    const r = await lireRecap(client({ data: null, error: { name: 'TypeError', message: 'Network request failed' } }), '2026-09-28');
    expect(r.copie).toBe(true);
    expect(r.recap?.leconsValidees).toBe(14);
  });

  it('hors ligne sans copie : l’erreur remonte', async () => {
    await expect(lireRecap(client({ data: null, error: { name: 'TypeError', message: 'Network request failed' } }), '2026-09-28')).rejects.toMatchObject({ name: 'TypeError' });
  });

  it('une erreur du serveur n’est pas masquée par une copie', async () => {
    await lireRecap(client({ data: BRUT, error: null }), '2026-09-28');
    await expect(lireRecap(client({ data: null, error: { name: 'PostgrestError', message: 'permission denied' } }), '2026-09-28')).rejects.toMatchObject({ message: 'permission denied' });
  });
});
