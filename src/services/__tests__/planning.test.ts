import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_COPIE_PLANNING,
  avecSeanceFaite,
  cocherSeance,
  definirTemps,
  depuisReponse,
  estJourDeRepos,
  heuresEstimees,
  jourLocalTexte,
  lirePlanning,
  prochaineSeance,
  seanceDuJour,
  seancesFaites,
  semaineDuJour,
  septJours,
} from '../planning';

jest.mock('../connectivite', () => ({
  ...jest.requireActual('../connectivite'),
  signalerEchec: jest.fn(),
  signalerSucces: jest.fn(),
}));

// Lundi 19 octobre 2026 : séances le lundi, mardi et jeudi ; repos mercredi et vendredi à dimanche.
const BRUT = {
  status: 'ready',
  minutes_per_day: 45,
  target: { type: 'examen', label: 'Baccalauréat', date: '2027-06-23', status: 'reprise' },
  days_left: 247,
  coverage: { lessons_total: 4, lessons_scheduled: 3 },
  weeks: [
    {
      start: '2026-10-26',
      phase: 'learning',
      days: [{ day: '2026-10-26', phase: 'learning', minutes: 45, items: [{ kind: 'free_review' }], done: false }],
    },
    {
      start: '2026-10-19',
      phase: 'learning',
      days: [
        { day: '2026-10-19', phase: 'learning', minutes: 45, items: [{ kind: 'lesson', course_id: 1, course: 'Fractions', subject: 'Mathématique', lesson_id: 2, lesson: 'Définition', minutes: 20 }, { kind: 'lesson', course_id: 3, course: 'Grammaire', subject: null, lesson_id: 4, lesson: 'Noms', minutes: 20 }], done: true },
        { day: '2026-10-20', phase: 'learning', minutes: 45, items: [{ kind: 'past_papers' }], done: false },
        { day: '2026-10-22', phase: 'learning', minutes: 45, items: [{ kind: 'inconnu' }, { kind: 'final_review' }], done: false },
      ],
    },
  ],
};

const client = (reponse: { data?: unknown; error?: unknown }) => ({ rpc: jest.fn().mockResolvedValue({ data: null, error: null, ...reponse }) });

beforeEach(() => AsyncStorage.clear());

describe('depuisReponse', () => {
  it('lit un planning prêt : cible, couverture, semaines triées, éléments connus seulement', () => {
    const p = depuisReponse(BRUT);
    expect(p).toMatchObject({ statut: 'ready', minutesParJour: 45, joursRestants: 247, couverture: { total: 4, prevues: 3 } });
    expect(p?.cible).toEqual({ type: 'examen', libelle: 'Baccalauréat', date: '2027-06-23', statut: 'reprise' });
    expect(p?.semaines.map((s) => s.debut)).toEqual(['2026-10-19', '2026-10-26']);
    expect(p?.semaines[0].jours[0].elements).toEqual([
      { genre: 'lecon', matiere: 'Mathématique', cours: 'Fractions', lecon: 'Définition', minutes: 20 },
      { genre: 'lecon', matiere: null, cours: 'Grammaire', lecon: 'Noms', minutes: 20 },
    ]);
    expect(p?.semaines[0].jours[2].elements).toEqual([{ genre: 'revisionFinale' }]);
    expect(p?.semaines[0].jours[0].fait).toBe(true);
  });

  it('un statut sans planning (empty, no_target) reste lisible, sans cible ni semaine', () => {
    expect(depuisReponse({ status: 'empty' })).toMatchObject({ statut: 'empty', cible: null, semaines: [], minutesParJour: null });
    expect(depuisReponse({ status: 'no_target', coverage: {}, weeks: [] })?.statut).toBe('no_target');
  });

  it('refuse une réponse illisible', () => {
    expect(depuisReponse(null)).toBeNull();
    expect(depuisReponse([])).toBeNull();
    expect(depuisReponse({ status: 'autre' })).toBeNull();
    expect(depuisReponse({ status: 'ready', target: { type: 'concours', label: 'x', date: '2027-01-01' } })?.cible).toBeNull();
  });
});

describe('règles d’affichage', () => {
  const p = depuisReponse(BRUT)!;

  it('séance du jour et séance suivante', () => {
    expect(seanceDuJour(p, '2026-10-20')?.elements).toEqual([{ genre: 'annales' }]);
    expect(seanceDuJour(p, '2026-10-21')).toBeNull();
    expect(prochaineSeance(p, '2026-10-21')?.jour).toBe('2026-10-22');
    expect(prochaineSeance(p, '2026-11-30')).toBeNull();
  });

  it('jour de repos : dans le planning sans séance ; avant ou après le planning, ce n’est pas un repos', () => {
    expect(estJourDeRepos(p, '2026-10-21')).toBe(true);
    expect(estJourDeRepos(p, '2026-10-19')).toBe(false);
    expect(estJourDeRepos(p, '2026-10-01')).toBe(false);
    expect(estJourDeRepos(p, '2026-12-01')).toBe(false);
  });

  it('semaine du jour : rang et total ; null hors planning', () => {
    expect(semaineDuJour(p, '2026-10-21')).toMatchObject({ numero: 1, total: 2, semaine: { debut: '2026-10-19' } });
    expect(semaineDuJour(p, '2026-10-28')).toMatchObject({ numero: 2 });
    expect(semaineDuJour(p, '2026-12-01')).toBeNull();
  });

  it('sept jours de la semaine : séance ou repos, lundi à dimanche', () => {
    const jours = septJours(p.semaines[0]);
    expect(jours.map((j) => j.jour)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(jours.map((j) => j.seance !== null)).toEqual([true, true, false, true, false, false, false]);
    expect(seancesFaites(p.semaines[0])).toBe(1);
  });

  it('cocher met à jour le jour demandé sans toucher aux autres', () => {
    const apres = avecSeanceFaite(p, '2026-10-20', true);
    expect(seancesFaites(apres.semaines[0])).toBe(2);
    expect(seancesFaites(p.semaines[0])).toBe(1);
    expect(seancesFaites(avecSeanceFaite(apres, '2026-10-19', false).semaines[0])).toBe(1);
  });

  it('heures estimées jusqu’à la date : environ 5,5 jours d’étude sur 7', () => {
    expect(heuresEstimees(70, 60)).toBe(55);
    expect(heuresEstimees(0, 60)).toBe(0);
    expect(heuresEstimees(10, 15)).toBe(2);
  });

  it('jour local en AAAA-MM-JJ', () => {
    expect(jourLocalTexte(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

describe('lirePlanning', () => {
  it('lit le planning, et garde une copie du planning prêt pour l’élève', async () => {
    const c = client({ data: BRUT });
    const r = await lirePlanning(c, 'u1');
    expect(r.copie).toBe(false);
    expect(r.planning.statut).toBe('ready');
    expect(c.rpc).toHaveBeenCalledWith('my_study_plan');
    expect(await AsyncStorage.getItem(CLE_COPIE_PLANNING('u1'))).not.toBeNull();
  });

  it('ne garde pas de copie d’un planning vide', async () => {
    await lirePlanning(client({ data: { status: 'empty' } }), 'u1');
    expect(await AsyncStorage.getItem(CLE_COPIE_PLANNING('u1'))).toBeNull();
  });

  it('sans réseau : la copie de cet élève ; jamais celle d’un autre', async () => {
    await lirePlanning(client({ data: BRUT }), 'u1');
    const hors = client({ error: { name: 'TypeError', message: 'Network request failed' } });
    const r = await lirePlanning(hors, 'u1');
    expect(r).toMatchObject({ copie: true, planning: { statut: 'ready' } });
    await expect(lirePlanning(hors, 'u2')).rejects.toMatchObject({ name: 'TypeError' });
  });

  it('une erreur du serveur remonte, sans copie', async () => {
    await lirePlanning(client({ data: BRUT }), 'u1');
    await expect(lirePlanning(client({ error: { name: 'PostgrestError', message: 'boom' } }), 'u1')).rejects.toMatchObject({ message: 'boom' });
  });

  it('une réponse illisible est une erreur', async () => {
    await expect(lirePlanning(client({ data: { n: 1 } }), 'u1')).rejects.toThrow('planning_illisible');
  });
});

describe('écritures', () => {
  it('définir le temps envoie la classe et les minutes', async () => {
    const c = client({ data: { status: 'ready' } });
    await definirTemps(c, '3e', 'CM', 45);
    expect(c.rpc).toHaveBeenCalledWith('study_plan_set_time', { p_level: '3e', p_country: 'CM', p_minutes: 45 });
  });

  it('une erreur à la saisie remonte', async () => {
    await expect(definirTemps(client({ error: { message: 'temps par jour invalide' } }), '3e', 'CM', 20)).rejects.toMatchObject({ message: 'temps par jour invalide' });
  });

  it('cocher une séance : vrai si le jour existe, faux sinon', async () => {
    const c = client({ data: true });
    expect(await cocherSeance(c, '2026-10-19', true)).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-19', p_done: true });
    expect(await cocherSeance(client({ data: false }), '2000-01-01', true)).toBe(false);
  });
});
