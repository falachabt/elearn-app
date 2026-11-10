import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirConnectivitePourTest } from '../connectivite';
import {
  appliquerCoches,
  basculerSeance,
  CLE_COCHES_EN_ATTENTE,
  CLE_COPIE_PLANNING,
  avecSeanceFaite,
  cocherSeance,
  definirTemps,
  depuisReponse,
  deuxProchainsJours,
  elementFait,
  annonceRepos,
  enregistrerCocheEnAttente,
  estJourDeRepos,
  etatJour,
  heuresEstimees,
  idsTachesSeances,
  jourLocalTexte,
  lireCochesEnAttente,
  lirePlanning,
  prochaineSeance,
  progressionSeance,
  seanceDe,
  seanceDuJour,
  seanceTerminee,
  seancesFaites,
  semaineDuJour,
  septJours,
  synchroniserCoches,
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
  rest_days_per_week: 2,
  reminder_time: '18:30',
  subjects: ['Mathématique', 'Français'],
  content_types: ['lesson', 'quiz', 'exercise', 'past_papers'],
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
    expect(p).toMatchObject({
      statut: 'ready',
      minutesParJour: 45,
      joursReposParSemaine: 2,
      heureRappel: '18:30',
      matieres: ['Mathématique', 'Français'],
      contenus: ['lesson', 'quiz', 'exercise', 'past_papers'],
      joursRestants: 247,
      couverture: { total: 4, prevues: 3 },
    });
    expect(p?.cible).toEqual({ type: 'examen', libelle: 'Baccalauréat', date: '2027-06-23', statut: 'reprise' });
    expect(p?.semaines.map((s) => s.debut)).toEqual(['2026-10-19', '2026-10-26']);
    expect(p?.semaines[0].jours[0].elements).toEqual([
      { genre: 'lecon', matiere: 'Mathématique', cours: 'Fractions', lecon: 'Définition', minutes: 20, coursId: 1, leconId: 2 },
      { genre: 'lecon', matiere: null, cours: 'Grammaire', lecon: 'Noms', minutes: 20, coursId: 3, leconId: 4 },
    ]);
    expect(p?.semaines[0].jours[2].elements).toEqual([{ genre: 'revisionFinale' }]);
    expect(p?.semaines[0].jours[0].fait).toBe(true);
  });

  it('lit les quiz, exercices et annales enrichies', () => {
    const p = depuisReponse({
      status: 'ready',
      weeks: [
        {
          start: '2026-10-19',
          days: [
            {
              day: '2026-10-19',
              phase: 'learning',
              minutes: 45,
              items: [
                { kind: 'quiz', course_id: 1, course: 'Fractions', subject: 'Mathématique', quiz_id: 'q1', quiz: 'Quiz Fractions', questions: 5, minutes: 10 },
                { kind: 'exercise', course_id: 1, course: 'Fractions', subject: 'Mathématique', exercise_id: 'ex1', exercise: 'Exo 1', minutes: 15 },
                { kind: 'past_papers', subject: 'Mathématique', folder_id: 'd1', folder: 'Bac 2024', minutes: 20 },
              ],
              done: false,
            },
          ],
        },
      ],
    });
    expect(p?.semaines[0].jours[0].elements).toEqual([
      { genre: 'quiz', matiere: 'Mathématique', cours: 'Fractions', quiz: 'Quiz Fractions', questions: 5, minutes: 10, coursId: 1, quizId: 'q1' },
      { genre: 'exercice', matiere: 'Mathématique', cours: 'Fractions', exercice: 'Exo 1', minutes: 15, coursId: 1, exerciceId: 'ex1' },
      { genre: 'annales', dossierId: 'd1', dossier: 'Bac 2024', minutes: 20 },
    ]);
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

  it('séance du jour, séance suivante et deux prochains jours', () => {
    expect(seanceDuJour(p, '2026-10-20')?.elements).toEqual([{ genre: 'annales' }]);
    expect(seanceDuJour(p, '2026-10-21')).toBeNull();
    expect(prochaineSeance(p, '2026-10-21')?.jour).toBe('2026-10-22');
    expect(prochaineSeance(p, '2026-11-30')).toBeNull();
    expect(deuxProchainsJours(p, '2026-10-20')).toEqual([
      { jour: '2026-10-21', seance: null },
      { jour: '2026-10-22', seance: p.semaines[0].jours[2] },
    ]);
  });

  it('jour de repos : dans le planning sans séance ; avant ou après le planning, ce n’est pas un repos', () => {
    expect(estJourDeRepos(p, '2026-10-21')).toBe(true);
    expect(estJourDeRepos(p, '2026-10-19')).toBe(false);
    expect(estJourDeRepos(p, '2026-10-01')).toBe(false);
    expect(estJourDeRepos(p, '2026-12-01')).toBe(false);
  });

  it('jour annoncé « repos » : sans séance avec une séance à venir, y compris avant le début du planning', () => {
    expect(annonceRepos(p, '2026-10-21')).toBe(true);
    expect(annonceRepos(p, '2026-10-01')).toBe(true);
    expect(annonceRepos(p, '2026-10-22')).toBe(false);
    expect(annonceRepos(p, '2026-12-01')).toBe(false);
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

  it('une leçon sans identifiant est ignorée (pas de tâche impossible à ouvrir)', () => {
    const p = depuisReponse({ status: 'ready', weeks: [{ start: '2026-10-19', days: [{ day: '2026-10-19', phase: 'learning', minutes: 30, items: [{ kind: 'lesson', course: 'C', lesson: 'L' }, { kind: 'past_papers' }], done: false }] }] });
    expect(p?.semaines[0].jours[0].elements).toEqual([{ genre: 'annales' }]);
  });

  it('leçons, quiz et exercices déjà validés : tâche faite et séance terminée si toutes les tâches sont validées', () => {
    const j = { ...p.semaines[0].jours[0], fait: false };
    expect(j.elements.map((e) => elementFait(e, { '2': 1 }))).toEqual([true, false]);
    expect(progressionSeance(j, { '2': 1 })).toEqual({ faits: 1, total: 2 });
    expect(seanceTerminee({ ...j, fait: false }, { '2': 1 })).toBe(false);
    expect(seanceTerminee({ ...j, fait: false }, { '2': 1, '4': 3 })).toBe(true);
    expect(progressionSeance({ ...j, fait: true }, {})).toEqual({ faits: 2, total: 2 });
    const annales = p.semaines[0].jours[1];
    expect(seanceTerminee({ ...annales, fait: false }, { '2': 1, '4': 3 })).toBe(false);
    expect(seanceTerminee({ ...annales, fait: true }, {})).toBe(true);

    const quizEl = { genre: 'quiz' as const, matiere: 'Math', cours: 'C', quiz: 'Q', questions: 5, minutes: 10, coursId: 1, quizId: 'q1' };
    const exEl = { genre: 'exercice' as const, matiere: 'Math', cours: 'C', exercice: 'E', minutes: 15, coursId: 1, exerciceId: 'ex1' };
    expect(elementFait(quizEl, {}, { scores: { q1: 8 } })).toBe(true);
    expect(elementFait(exEl, {}, { exercices: { ex1: true } })).toBe(true);
  });

  it('situation d’un jour : séance, repos au milieu du planning, ou hors planning', () => {
    expect(etatJour(p, '2026-10-19')).toBe('seance');
    expect(etatJour(p, '2026-10-21')).toBe('repos');
    expect(etatJour(p, '2026-10-12')).toBe('horsPlanning');
    expect(etatJour(p, '2026-11-30')).toBe('horsPlanning');
    expect(seanceDe(p, '2026-10-26')?.elements).toEqual([{ genre: 'revisionLibre' }]);
    expect(seanceDe(p, '2026-10-21')).toBeNull();
  });

  it('jour local en AAAA-MM-JJ', () => {
    expect(jourLocalTexte(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

// Issue #74, lot B : le pack hors ligne télécharge d'abord les contenus des séances des trois prochains
// jours. Ces identifiants sont ceux des tâches du pack (services/horsLigne) : leçon + quiz de validation,
// quiz libre, exercice + corrigé.
describe('idsTachesSeances', () => {
  const planning: Parameters<typeof idsTachesSeances>[0] = {
    statut: 'ready',
    minutesParJour: 45,
    cible: null,
    joursRestants: 10,
    couverture: { total: 4, prevues: 3 },
    semaines: [
      {
        debut: '2026-10-19',
        phase: 'learning',
        jours: [
          {
            jour: '2026-10-19', phase: 'learning', minutes: 45, fait: false,
            elements: [
              { genre: 'lecon', matiere: 'Mathématique', cours: 'Fractions', lecon: 'Définition', minutes: 20, coursId: 1, leconId: 2 },
              { genre: 'quiz', matiere: 'Mathématique', cours: 'Fractions', quiz: 'Quiz 1', questions: 5, minutes: 10, coursId: 1, quizId: 'q1' },
              { genre: 'exercice', matiere: 'Mathématique', cours: 'Fractions', exercice: 'Exo 1', minutes: 15, coursId: 1, exerciceId: 'e1' },
              { genre: 'revisionLibre' },
            ],
          },
          {
            jour: '2026-10-20', phase: 'learning', minutes: 45, fait: false,
            elements: [
              { genre: 'lecon', matiere: null, cours: 'Grammaire', lecon: 'Noms', minutes: 20, coursId: 3, leconId: 4 },
              { genre: 'lecon', matiere: 'Mathématique', cours: 'Fractions', lecon: 'Définition', minutes: 20, coursId: 1, leconId: 2 },
            ],
          },
        ],
      },
    ],
  };

  it('les contenus d’une séance : leçon et validation, quiz, exercice et corrigé', () => {
    expect(idsTachesSeances(planning, ['2026-10-19'])).toEqual(['lecon-2', 'validation-2', 'quiz-q1', 'exercice-e1', 'corrige-e1']);
  });

  it('suit l’ordre des jours demandés et ne répète pas un contenu déjà vu', () => {
    expect(idsTachesSeances(planning, ['2026-10-20', '2026-10-19'])).toEqual([
      'lecon-4', 'validation-4', 'lecon-2', 'validation-2', 'quiz-q1', 'exercice-e1', 'corrige-e1',
    ]);
  });

  it('un jour sans séance (ou inconnu) ne donne rien', () => {
    expect(idsTachesSeances(planning, ['2026-10-21'])).toEqual([]);
    expect(idsTachesSeances(planning, [])).toEqual([]);
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

  // Retour terrain du 23 octobre 2026 : hors ligne, le planning « ne s'affiche pas » ou met très longtemps —
  // la lecture tentait le serveur d'abord et attendait l'échec de la requête (très long sur un Wi-Fi sans
  // internet) avant de servir la copie. Quand la coupure est déjà connue, la copie part tout de suite.
  it('hors ligne déjà connu : la copie est servie sans même tenter le serveur', async () => {
    await lirePlanning(client({ data: BRUT }), 'u1');
    definirConnectivitePourTest({ backend: false });
    try {
      const c = client({ data: BRUT });
      const r = await lirePlanning(c, 'u1');
      expect(r).toMatchObject({ copie: true, planning: { statut: 'ready' } });
      expect(c.rpc).not.toHaveBeenCalled();
    } finally {
      definirConnectivitePourTest({ backend: null });
    }
  });

  it('une réponse illisible est une erreur', async () => {
    await expect(lirePlanning(client({ data: { n: 1 } }), 'u1')).rejects.toThrow('planning_illisible');
  });
});

describe('écritures', () => {
  it('définir le temps envoie la classe, les minutes et les options si fournies', async () => {
    const c = client({ data: { status: 'ready' } });
    await definirTemps(c, '3e', 'CM', 45);
    expect(c.rpc).toHaveBeenCalledWith('study_plan_set_time', { p_level: '3e', p_country: 'CM', p_minutes: 45 });

    await definirTemps(c, 'Tle', 'BF', 60, {
      serie: 'D',
      matieres: ['Mathématique'],
      contenus: ['lesson', 'quiz'],
      joursRepos: 2,
      heureRappel: '18:30',
    });
    expect(c.rpc).toHaveBeenCalledWith('study_plan_set_time', {
      p_level: 'Tle',
      p_country: 'BF',
      p_minutes: 60,
      p_series: 'D',
      p_subjects: ['Mathématique'],
      p_content_types: ['lesson', 'quiz'],
      p_rest_days: 2,
      p_reminder_time: '18:30',
    });
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

// Issue #74, lot A (spec planning-etudes.md, section 8) : la coche de séance hors ligne part dans une file
// par utilisateur, s'applique à ce qui est affiché, et se rejoue au retour du réseau.
describe('coches hors ligne : file et rejeu', () => {
  const RESEAU = { name: 'TypeError', message: 'Network request failed' };

  it('la file garde une entrée par jour : le dernier état gagne, avec sa date', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    await enregistrerCocheEnAttente('u1', '2026-10-20', false, new Date('2026-10-20T09:30:00.000Z'));
    await enregistrerCocheEnAttente('u1', '2026-10-22', true, new Date('2026-10-22T07:00:00.000Z'));
    expect(await lireCochesEnAttente('u1')).toEqual([
      { jour: '2026-10-20', fait: false, le: '2026-10-20T09:30:00.000Z' },
      { jour: '2026-10-22', fait: true, le: '2026-10-22T07:00:00.000Z' },
    ]);
    // Jamais la file d'un autre élève.
    expect(await lireCochesEnAttente('u2')).toEqual([]);
  });

  it('une file absente ou illisible vaut une file vide', async () => {
    expect(await lireCochesEnAttente('u1')).toEqual([]);
    await AsyncStorage.setItem(CLE_COCHES_EN_ATTENTE('u1'), '{"pas":"un tableau"}');
    expect(await lireCochesEnAttente('u1')).toEqual([]);
    await AsyncStorage.setItem(CLE_COCHES_EN_ATTENTE('u1'), JSON.stringify([{ jour: '20 octobre', fait: 'oui' }, { jour: '2026-10-20', fait: true, le: '2026-10-20T08:00:00.000Z' }]));
    expect(await lireCochesEnAttente('u1')).toEqual([{ jour: '2026-10-20', fait: true, le: '2026-10-20T08:00:00.000Z' }]);
  });

  it('basculer en ligne : le serveur confirme et la file reste vide', async () => {
    const c = client({ data: true });
    expect(await basculerSeance(c, 'u1', '2026-10-20', true)).toBe('serveur');
    expect(c.rpc).toHaveBeenCalledWith('study_plan_mark_done', { p_day: '2026-10-20', p_done: true });
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('basculer en ligne retire une coche plus ancienne du même jour restée en file', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    expect(await basculerSeance(client({ data: true }), 'u1', '2026-10-20', false)).toBe('serveur');
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('basculer hors ligne : la coche part dans la file, rien ne remonte comme erreur', async () => {
    expect(await basculerSeance(client({ error: RESEAU }), 'u1', '2026-10-20', true)).toBe('enAttente');
    expect(await lireCochesEnAttente('u1')).toEqual([{ jour: '2026-10-20', fait: true, le: expect.any(String) }]);
  });

  it('basculer sur un jour inconnu du serveur : l’erreur remonte, rien n’est mis en file', async () => {
    await expect(basculerSeance(client({ data: false }), 'u1', '2000-01-01', true)).rejects.toThrow('jour_inconnu');
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('basculer sur une erreur du serveur : elle remonte, rien n’est mis en file', async () => {
    await expect(basculerSeance(client({ error: { message: 'boom' } }), 'u1', '2026-10-20', true)).rejects.toMatchObject({ message: 'boom' });
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('synchroniserCoches rejoue chaque coche dans l’ordre et vide la file', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    await enregistrerCocheEnAttente('u1', '2026-10-22', false, new Date('2026-10-22T07:00:00.000Z'));
    const c = client({ data: true });
    expect(await synchroniserCoches(c, 'u1')).toEqual([]);
    expect(c.rpc.mock.calls).toEqual([
      ['study_plan_mark_done', { p_day: '2026-10-20', p_done: true }],
      ['study_plan_mark_done', { p_day: '2026-10-22', p_done: false }],
    ]);
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('synchroniserCoches : un jour disparu côté serveur abandonne sa coche, les autres passent', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-19', true, new Date('2026-10-19T08:00:00.000Z'));
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    const c = {
      rpc: jest.fn(async (_nom: string, args: { p_day: string }) => ({ data: args.p_day !== '2026-10-19', error: null })),
    } as never;
    expect(await synchroniserCoches(c, 'u1')).toEqual([]);
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });

  it('synchroniserCoches sans réseau : tout reste dans la file, rien n’est perdu', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    await enregistrerCocheEnAttente('u1', '2026-10-22', true, new Date('2026-10-22T07:00:00.000Z'));
    const c = client({ error: RESEAU });
    const restantes = await synchroniserCoches(c, 'u1');
    expect(restantes).toHaveLength(2);
    expect(await lireCochesEnAttente('u1')).toHaveLength(2);
    // Sans réseau, inutile d’essayer la deuxième coche : un seul appel parti.
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });

  it('appliquerCoches pose l’état des coches sur le planning, jours inconnus ignorés', () => {
    const p = depuisReponse(BRUT);
    expect(p).not.toBeNull();
    const avec = appliquerCoches(p!, [
      { jour: '2026-10-20', fait: true, le: '2026-10-20T08:00:00.000Z' },
      { jour: '2026-10-19', fait: false, le: '2026-10-20T08:05:00.000Z' },
      { jour: '2030-01-01', fait: true, le: '2026-10-20T08:10:00.000Z' },
    ]);
    expect(seanceDe(avec, '2026-10-20')?.fait).toBe(true);
    expect(seanceDe(avec, '2026-10-19')?.fait).toBe(false);
  });

  it('lirePlanning hors ligne : la copie affichée porte les coches en attente', async () => {
    await lirePlanning(client({ data: BRUT }), 'u1');
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    const r = await lirePlanning(client({ error: RESEAU }), 'u1');
    expect(r.copie).toBe(true);
    expect(seanceDe(r.planning, '2026-10-20')?.fait).toBe(true);
    // La copie gardée, elle, reste celle du serveur : le recouvrement se refait à chaque lecture.
    expect(await lireCochesEnAttente('u1')).toHaveLength(1);
  });

  it('lirePlanning en ligne : la file est rejouée avant la lecture du planning', async () => {
    await enregistrerCocheEnAttente('u1', '2026-10-20', true, new Date('2026-10-20T08:00:00.000Z'));
    const ordre: string[] = [];
    const c = {
      rpc: jest.fn(async (nom: string) => {
        ordre.push(nom);
        return nom === 'study_plan_mark_done' ? { data: true, error: null } : { data: BRUT, error: null };
      }),
    } as never;
    const r = await lirePlanning(c, 'u1');
    expect(r.copie).toBe(false);
    expect(ordre).toEqual(['study_plan_mark_done', 'my_study_plan']);
    expect(await lireCochesEnAttente('u1')).toEqual([]);
  });
});

