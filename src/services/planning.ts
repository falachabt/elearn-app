import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { estErreurReseau, serveurJoignable, signalerEchec, signalerSucces } from './connectivite';
import { ajouterJours, lundiDe } from './maSemaine';

/**
 * Planning d'études (issue #65, étape 4) : l'élève choisit son temps par jour, le serveur calcule un planning jusqu'à la
 * prochaine date de sa classe (fonctions `study_plan_set_time`, `my_study_plan`, `study_plan_mark_done`, migration
 * 20261017120000). L'app ne calcule rien : elle lit, affiche, et coche les séances. Spec : `docs/maquettes/planning-etudes.md`.
 *
 * La copie gardée sur l'appareil n'est pas du contenu de cours (ni leçon ni corrigé) : elle ne passe pas par
 * `lireLocalHorsLigne` et n'expire pas, comme les scores et l'historique.
 */
type Client = Pick<SupabaseClient, 'rpc'>;

export type StatutPlanning = 'empty' | 'preparing' | 'ready' | 'no_target';
export type PhasePlanning = 'learning' | 'past_papers' | 'final_review';
export type TypeContenuPlanning = 'lesson' | 'quiz' | 'exercise' | 'past_papers';

export type ElementSeance =
  | { genre: 'lecon'; matiere: string | null; cours: string; lecon: string; minutes: number; coursId: number; leconId: number }
  | { genre: 'quiz'; matiere: string | null; cours: string; quiz: string; questions: number; minutes: number; coursId: number; quizId: string }
  | { genre: 'exercice'; matiere: string | null; cours: string; exercice: string; minutes: number; coursId: number; exerciceId: string }
  | { genre: 'annales'; dossierId?: string; dossier?: string; minutes?: number }
  | { genre: 'revisionFinale' | 'revisionLibre' };

export type JourPlanning = { jour: string; phase: PhasePlanning; minutes: number; elements: ElementSeance[]; fait: boolean };
export type SemainePlanning = { debut: string; phase: PhasePlanning; jours: JourPlanning[] };
export type CiblePlanning = { type: 'examen' | 'fin_de_cours'; libelle: string; date: string; statut: 'reprise' | 'confirmee' };

export type Planning = {
  statut: StatutPlanning;
  minutesParJour: number | null;
  cible: CiblePlanning | null;
  joursRestants: number | null;
  couverture: { total: number; prevues: number };
  semaines: SemainePlanning[];
  matieres?: string[] | null;
  contenus?: TypeContenuPlanning[];
  joursReposParSemaine?: number;
  heureRappel?: string;
};

/** Temps proposés à l'élève (le serveur accepte tout multiple de 15 entre 15 et 240 minutes). */
export const TEMPS_PROPOSES = [15, 30, 45, 60, 90] as const;
export const CONTENUS_PROPOSES: readonly TypeContenuPlanning[] = ['lesson', 'quiz', 'exercise', 'past_papers'] as const;
export const REPOS_PROPOSES = [1, 2, 3] as const;
export const HEURES_RAPPEL_PROPOSEES = ['16:30', '17:30', '18:30', '19:30', '20:30'] as const;
export const CLE_COPIE_PLANNING = (idUtilisateur: string) => `planning.copie.${idUtilisateur}`;

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const STATUTS: readonly string[] = ['empty', 'preparing', 'ready', 'no_target'];
const PHASES: readonly string[] = ['learning', 'past_papers', 'final_review'];
const CONTENUS_VALIDES: readonly string[] = ['lesson', 'quiz', 'exercise', 'past_papers'];
const GENRES: Record<string, 'annales' | 'revisionFinale' | 'revisionLibre'> = { past_papers: 'annales', final_review: 'revisionFinale', free_review: 'revisionLibre' };

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function elementDepuis(brut: unknown): ElementSeance | null {
  const e = objet(brut);
  if (!e || typeof e.kind !== 'string') return null;
  if (e.kind === 'lesson') {
    if (typeof e.lesson !== 'string' || typeof e.course !== 'string') return null;
    if (typeof e.lesson_id !== 'number' || typeof e.course_id !== 'number') return null;
    return { genre: 'lecon', matiere: typeof e.subject === 'string' ? e.subject : null, cours: e.course, lecon: e.lesson, minutes: entier(e.minutes), coursId: e.course_id, leconId: e.lesson_id };
  }
  if (e.kind === 'quiz') {
    if (typeof e.quiz_id !== 'string' || typeof e.quiz !== 'string' || typeof e.course !== 'string' || typeof e.course_id !== 'number') return null;
    return {
      genre: 'quiz',
      matiere: typeof e.subject === 'string' ? e.subject : null,
      cours: e.course,
      quiz: e.quiz,
      questions: entier(e.questions),
      minutes: entier(e.minutes),
      coursId: e.course_id,
      quizId: e.quiz_id,
    };
  }
  if (e.kind === 'exercise') {
    if (typeof e.exercise_id !== 'string' || typeof e.exercise !== 'string' || typeof e.course !== 'string' || typeof e.course_id !== 'number') return null;
    return {
      genre: 'exercice',
      matiere: typeof e.subject === 'string' ? e.subject : null,
      cours: e.course,
      exercice: e.exercise,
      minutes: entier(e.minutes),
      coursId: e.course_id,
      exerciceId: e.exercise_id,
    };
  }
  if (e.kind === 'past_papers') {
    if (typeof e.folder_id === 'string' && typeof e.folder === 'string') {
      return { genre: 'annales', dossierId: e.folder_id, dossier: e.folder, minutes: entier(e.minutes) };
    }
    return { genre: 'annales' };
  }
  const genre = GENRES[e.kind];
  return genre ? { genre } : null;
}

function jourDepuis(brut: unknown): JourPlanning | null {
  const j = objet(brut);
  if (!j || typeof j.day !== 'string' || !FORMAT_JOUR.test(j.day) || typeof j.phase !== 'string' || !PHASES.includes(j.phase)) return null;
  const elements = Array.isArray(j.items) ? j.items.map(elementDepuis).filter((e): e is ElementSeance => e !== null) : [];
  return { jour: j.day, phase: j.phase as PhasePlanning, minutes: entier(j.minutes), elements, fait: j.done === true };
}

/** Réponse du serveur → planning de l'app ; null si la réponse n'est pas un planning lisible. */
export function depuisReponse(brut: unknown): Planning | null {
  const r = objet(brut);
  if (!r || typeof r.status !== 'string' || !STATUTS.includes(r.status)) return null;
  const c = objet(r.target);
  const cible: CiblePlanning | null =
    c && (c.type === 'examen' || c.type === 'fin_de_cours') && typeof c.label === 'string' && typeof c.date === 'string' && FORMAT_JOUR.test(c.date)
      ? { type: c.type, libelle: c.label, date: c.date, statut: c.status === 'confirmee' ? 'confirmee' : 'reprise' }
      : null;
  const couv = objet(r.coverage);
  const semaines: SemainePlanning[] = (Array.isArray(r.weeks) ? r.weeks : [])
    .map((brutSemaine): SemainePlanning | null => {
      const s = objet(brutSemaine);
      if (!s || typeof s.start !== 'string' || !FORMAT_JOUR.test(s.start)) return null;
      const jours = (Array.isArray(s.days) ? s.days : []).map(jourDepuis).filter((j): j is JourPlanning => j !== null);
      if (jours.length === 0) return null;
      return { debut: s.start, phase: jours[0].phase, jours };
    })
    .filter((s): s is SemainePlanning => s !== null)
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const matieres = Array.isArray(r.subjects) ? r.subjects.filter((s): s is string => typeof s === 'string') : null;
  const contenus = Array.isArray(r.content_types)
    ? r.content_types.filter((t): t is TypeContenuPlanning => typeof t === 'string' && CONTENUS_VALIDES.includes(t))
    : undefined;
  return {
    statut: r.status as StatutPlanning,
    minutesParJour: typeof r.minutes_per_day === 'number' ? entier(r.minutes_per_day) : null,
    cible,
    joursRestants: typeof r.days_left === 'number' ? entier(r.days_left) : null,
    couverture: { total: entier(couv?.lessons_total), prevues: entier(couv?.lessons_scheduled) },
    semaines,
    ...(matieres !== null ? { matieres } : {}),
    ...(contenus && contenus.length > 0 ? { contenus } : {}),
    ...(typeof r.rest_days_per_week === 'number' ? { joursReposParSemaine: entier(r.rest_days_per_week) } : {}),
    ...(typeof r.reminder_time === 'string' ? { heureRappel: r.reminder_time } : {}),
  };
}

// --- Règles d'affichage -----------------------------------------------------------------------------------------------

const tousLesJours = (p: Planning) => p.semaines.flatMap((s) => s.jours);

/** Séance du jour donné (AAAA-MM-JJ) ; null un jour de repos ou hors du planning. */
export const seanceDuJour = (p: Planning, aujourdhui: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour === aujourdhui) ?? null;

/** Séance du jour, sinon la prochaine (jour de repos : celle de demain ou d'après) ; null quand le planning est fini. */
export const prochaineSeance = (p: Planning, aujourdhui: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour >= aujourdhui) ?? null;

/** Les deux jours qui suivent `aujourdhui` (demain et après-demain), avec leur séance éventuelle. */
export function deuxProchainsJours(p: Planning, aujourdhui: string): { jour: string; seance: JourPlanning | null }[] {
  return [1, 2].map((decalage) => {
    const jour = ajouterJours(aujourdhui, decalage);
    return { jour, seance: seanceDe(p, jour) };
  });
}

/** Semaine qui contient le jour donné, avec son rang parmi les semaines du planning ; null hors du planning. */
export function semaineDuJour(p: Planning, aujourdhui: string): { semaine: SemainePlanning; numero: number; total: number } | null {
  const debut = lundiDe(new Date(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)) - 1, Number(aujourdhui.slice(8, 10)), 12));
  const index = p.semaines.findIndex((s) => s.debut === debut);
  return index < 0 ? null : { semaine: p.semaines[index], numero: index + 1, total: p.semaines.length };
}

/** Le planning commence-t-il dans le futur, ou est-on un jour de repos au milieu ? Vrai si aujourd'hui n'a pas de séance. */
export const estJourDeRepos = (p: Planning, aujourdhui: string): boolean => {
  const jours = tousLesJours(p);
  if (jours.length === 0) return false;
  return !jours.some((j) => j.jour === aujourdhui) && aujourdhui >= jours[0].jour && aujourdhui <= jours[jours.length - 1].jour;
};

/** Les sept jours d'une semaine (lundi à dimanche) : la séance du jour, ou null pour un repos. */
export function septJours(semaine: SemainePlanning): { jour: string; seance: JourPlanning | null }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const jour = ajouterJours(semaine.debut, i);
    return { jour, seance: semaine.jours.find((j) => j.jour === jour) ?? null };
  });
}

export const seancesFaites = (semaine: SemainePlanning) => semaine.jours.filter((j) => j.fait).length;

/** Leçons déjà validées par l'élève : identifiant de leçon → identifiant de cours (`lireLues` de reviser). */
export type LeconsValidees = Readonly<Record<string, number>>;

/** Progression complémentaire de l'élève sur les quiz et exercices d'entraînement. */
export type AcquisesEntrainement = {
  scores?: Readonly<Record<string, number>>;
  exercices?: Readonly<Record<string, boolean>>;
};

/** Une leçon, un quiz ou un exercice déjà validé dans Réviser compte comme fait. Les autres tâches se cochent avec la séance. */
export const elementFait = (e: ElementSeance, lues: LeconsValidees, acquises?: AcquisesEntrainement): boolean => {
  if (e.genre === 'lecon') return lues[String(e.leconId)] !== undefined;
  if (e.genre === 'quiz') {
    const cle = String(e.quizId);
    return acquises?.scores?.[cle] !== undefined || acquises?.scores?.[cle.toLowerCase()] !== undefined;
  }
  if (e.genre === 'exercice') {
    const cle = String(e.exerciceId);
    return acquises?.exercices?.[cle] === true || acquises?.exercices?.[cle.toLowerCase()] === true;
  }
  return false;
};

/** Séance terminée : cochée par l'élève, ou entièrement composée de tâches déjà validées. */
export const seanceTerminee = (j: JourPlanning, lues: LeconsValidees, acquises?: AcquisesEntrainement): boolean =>
  j.fait || (j.elements.length > 0 && j.elements.every((e) => elementFait(e, lues, acquises)));

/** Tâches faites sur le total d'une séance ; une séance cochée compte toutes ses tâches. */
export function progressionSeance(j: JourPlanning, lues: LeconsValidees, acquises?: AcquisesEntrainement): { faits: number; total: number } {
  const total = j.elements.length;
  return { faits: j.fait ? total : j.elements.filter((e) => elementFait(e, lues, acquises)).length, total };
}

/** Situation d'un jour par rapport au planning : séance prévue, repos au milieu du planning, ou avant son début / après sa fin. */
export type EtatJour = 'seance' | 'repos' | 'horsPlanning';
export function etatJour(p: Planning, jour: string): EtatJour {
  const jours = tousLesJours(p);
  if (jours.some((j) => j.jour === jour)) return 'seance';
  return jours.length > 0 && jour >= jours[0].jour && jour <= jours[jours.length - 1].jour ? 'repos' : 'horsPlanning';
}

/**
 * Jour à annoncer « Jour de repos » : pas de séance ce jour-là et une séance encore à venir. Contrairement à
 * `estJourDeRepos`, compte aussi les jours avant le début du planning (le programme commence demain : aujourd'hui se repose).
 */
export const annonceRepos = (p: Planning, jour: string): boolean => !seanceDe(p, jour) && !!prochaineSeance(p, jour);

/** Séance d'un jour donné, partout dans le planning ; null un jour de repos ou hors planning. */
export const seanceDe = (p: Planning, jour: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour === jour) ?? null;

/**
 * Identifiants des tâches du pack hors ligne qui portent les contenus des séances des jours donnés
 * (issue #74, lot B) : pour une leçon, la leçon et son quiz de validation ; pour un exercice, l'exercice
 * et son corrigé ; pour un quiz libre, le quiz. Les annales et les révisions n'ont pas de contenu propre
 * à télécharger par séance. L'ordre suit les jours donnés puis les éléments dans la séance, sans doublon :
 * le pack s'en sert pour télécharger ces contenus en premier.
 */
export function idsTachesSeances(planning: Planning, jours: readonly string[]): string[] {
  const vus = new Set<string>();
  const ids: string[] = [];
  const ajouter = (id: string) => {
    if (!vus.has(id)) {
      vus.add(id);
      ids.push(id);
    }
  };
  for (const jour of jours) {
    const seance = seanceDe(planning, jour);
    if (!seance) continue;
    for (const element of seance.elements) {
      if (element.genre === 'lecon') {
        ajouter(`lecon-${element.leconId}`);
        ajouter(`validation-${element.leconId}`);
      } else if (element.genre === 'quiz') {
        ajouter(`quiz-${element.quizId}`);
      } else if (element.genre === 'exercice') {
        ajouter(`exercice-${element.exerciceId}`);
        ajouter(`corrige-${element.exerciceId}`);
      }
    }
  }
  return ids;
}

/** Planning avec la séance du jour donné cochée ou décochée (mise à jour locale en attendant la réponse du serveur). */
export const avecSeanceFaite = (p: Planning, jour: string, fait: boolean): Planning => ({
  ...p,
  semaines: p.semaines.map((s) => ({ ...s, jours: s.jours.map((j) => (j.jour === jour ? { ...j, fait } : j)) })),
});

/** Heures de travail d'ici la date cible, à l'estime (selon le nombre de jours de repos par semaine, 2 par défaut). */
export function heuresEstimees(joursRestants: number, minutesParJour: number, joursRepos?: number): number {
  const ratioEtude = typeof joursRepos === 'number' ? Math.max(1, 7 - joursRepos) / 7 : 5.5 / 7;
  return Math.max(0, Math.round((joursRestants * ratioEtude * minutesParJour) / 60));
}

/** Midi local du jour donné (AAAA-MM-JJ) : aucun décalage de fuseau ni d'heure d'été. */
export const dateDuJour = (jour: string): Date => new Date(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)), 12);
export const localeDe = (langue: string) => (langue === 'en' ? 'en-GB' : 'fr-FR');

/** Date du jour local, AAAA-MM-JJ. */
export function jourLocalTexte(date = new Date()): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

// --- Lecture et écriture ----------------------------------------------------------------------------------------------

export type ResultatPlanning = { planning: Planning; copie: boolean };

async function lireCopie(idUtilisateur: string | undefined): Promise<Planning | null> {
  if (!idUtilisateur) return null;
  try {
    const brut = await AsyncStorage.getItem(CLE_COPIE_PLANNING(idUtilisateur));
    return brut ? depuisReponse(JSON.parse(brut)) : null;
  } catch {
    return null;
  }
}

async function garderCopie(idUtilisateur: string | undefined, brut: unknown): Promise<void> {
  if (!idUtilisateur) return;
  try {
    await AsyncStorage.setItem(CLE_COPIE_PLANNING(idUtilisateur), JSON.stringify(brut));
  } catch {
    // Copie facultative.
  }
}

/**
 * Planning de l'élève. Sans réseau : la copie gardée sur l'appareil (`copie: true`), sinon l'erreur remonte pour l'état
 * « Pas de réseau ». Seul un planning prêt est gardé.
 *
 * Les coches faites hors ligne (file ci-dessous) sont d'abord rejouées vers le serveur : la lecture qui suit voit alors
 * son état à jour. Celles qui n'ont pas pu partir sont reposées sur ce qui s'affiche, copie comme réponse du serveur.
 */
export async function lirePlanning(client: Client, idUtilisateur?: string): Promise<ResultatPlanning> {
  // Coupure déjà connue : le rejeu des coches n'est pas tenté, et si une copie prête existe elle part
  // tout de suite — la lecture serveur attendrait l'échec de la requête (très long sur un Wi-Fi sans
  // internet) avant d'y arriver, et l'écran restait vide pendant ce temps (retour terrain du
  // 23 octobre 2026). Sans copie à servir, le serveur est tenté quand même : l'état connu peut dater
  // et le réseau être revenu, un réessai explicite de l'élève doit pouvoir aboutir.
  const enLigne = serveurJoignable();
  const restantes = idUtilisateur
    ? enLigne
      ? await synchroniserCoches(client, idUtilisateur).catch(() => lireCochesEnAttente(idUtilisateur))
      : await lireCochesEnAttente(idUtilisateur)
    : [];
  try {
    if (!enLigne) {
      const copie = await lireCopie(idUtilisateur);
      if (copie && copie.statut === 'ready') {
        signalerEchec();
        return { planning: restantes.length > 0 ? appliquerCoches(copie, restantes) : copie, copie: true };
      }
    }
    const { data, error } = await client.rpc('my_study_plan');
    if (error) throw error;
    signalerSucces();
    const planning = depuisReponse(data);
    if (!planning) throw new Error('planning_illisible');
    if (planning.statut === 'ready') await garderCopie(idUtilisateur, data);
    return { planning: restantes.length > 0 ? appliquerCoches(planning, restantes) : planning, copie: false };
  } catch (erreur) {
    if (!estErreurReseau(erreur)) throw erreur;
    signalerEchec();
    const copie = await lireCopie(idUtilisateur);
    if (copie && copie.statut === 'ready') {
      return { planning: restantes.length > 0 ? appliquerCoches(copie, restantes) : copie, copie: true };
    }
    throw erreur;
  }
}

// --- Coches de séance hors ligne (issue #74, lot A ; spec docs/maquettes/planning-etudes.md, section 8) ---------------

/** Une coche faite sans réseau : le jour, l'état voulu et quand elle a été faite. Rien d'autre ne part dans la file. */
export type CocheEnAttente = { jour: string; fait: boolean; le: string };

export const CLE_COCHES_EN_ATTENTE = (idUtilisateur: string) => `planning.cochesEnAttente.${idUtilisateur}`;

function estCoche(valeur: unknown): valeur is CocheEnAttente {
  if (!valeur || typeof valeur !== 'object') return false;
  const c = valeur as Partial<CocheEnAttente>;
  return typeof c.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.jour) && typeof c.fait === 'boolean' && typeof c.le === 'string';
}

/** File des coches en attente de cet élève ; jamais celle d'un autre. Absente ou illisible : une file vide. */
export async function lireCochesEnAttente(idUtilisateur: string): Promise<CocheEnAttente[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_COCHES_EN_ATTENTE(idUtilisateur));
    if (!brut) return [];
    const lu: unknown = JSON.parse(brut);
    return Array.isArray(lu) ? lu.filter(estCoche) : [];
  } catch {
    return [];
  }
}

async function ecrireCochesEnAttente(idUtilisateur: string, file: CocheEnAttente[]): Promise<void> {
  try {
    if (file.length === 0) await AsyncStorage.removeItem(CLE_COCHES_EN_ATTENTE(idUtilisateur));
    else await AsyncStorage.setItem(CLE_COCHES_EN_ATTENTE(idUtilisateur), JSON.stringify(file));
  } catch {
    // File facultative : au pire, la coche se refera une fois en ligne.
  }
}

/**
 * Garde une coche faite hors ligne. Une seule entrée par jour : cocher puis décocher le même jour ne garde que le
 * dernier état, c'est lui qui sera rejoué.
 */
export async function enregistrerCocheEnAttente(idUtilisateur: string, jour: string, fait: boolean, maintenant = new Date()): Promise<void> {
  const file = (await lireCochesEnAttente(idUtilisateur)).filter((c) => c.jour !== jour);
  file.push({ jour, fait, le: maintenant.toISOString() });
  await ecrireCochesEnAttente(idUtilisateur, file);
}

async function retirerCocheEnAttente(idUtilisateur: string, jour: string): Promise<void> {
  const file = await lireCochesEnAttente(idUtilisateur);
  if (file.some((c) => c.jour === jour)) {
    await ecrireCochesEnAttente(idUtilisateur, file.filter((c) => c.jour !== jour));
  }
}

/** Pose les coches en attente sur un planning lu (copie ou serveur) ; les jours inconnus du planning sont ignorés. */
export function appliquerCoches(planning: Planning, coches: CocheEnAttente[]): Planning {
  return coches.reduce((p, c) => avecSeanceFaite(p, c.jour, c.fait), planning);
}

/**
 * Rejoue la file des coches vers le serveur et renvoie ce qui reste à envoyer. Le RPC `study_plan_mark_done` est
 * idempotent : un rejeu répété ne change rien. Un jour que le serveur ne connaît plus (il répond faux, par exemple
 * après un recalcul du planning) abandonne sa coche : l'état du serveur fait foi. Sans réseau, on s'arrête à la
 * première coche : les suivantes repartiront au prochain essai, rien n'est perdu.
 */
export async function synchroniserCoches(client: Client, idUtilisateur: string): Promise<CocheEnAttente[]> {
  const file = await lireCochesEnAttente(idUtilisateur);
  if (file.length === 0) return [];
  const restantes: CocheEnAttente[] = [];
  let sansReseau = false;
  for (const coche of file) {
    if (sansReseau) {
      restantes.push(coche);
      continue;
    }
    try {
      await cocherSeance(client, coche.jour, coche.fait);
    } catch (erreur) {
      restantes.push(coche);
      if (estErreurReseau(erreur)) sansReseau = true;
    }
  }
  await ecrireCochesEnAttente(idUtilisateur, restantes);
  return restantes;
}

/**
 * Coche ou décoche une séance, en ligne comme hors ligne. En ligne, le serveur confirme (`serveur`) et une coche plus
 * ancienne du même jour encore en file est retirée. Sans réseau, la coche part dans la file (`enAttente`) et sera
 * rejouée : l'élève n'a pas à la refaire. Un jour inconnu du serveur reste une erreur (`jour_inconnu`), comme avant :
 * ce n'est pas un problème de réseau, et rien n'est mis en file.
 */
export async function basculerSeance(client: Client, idUtilisateur: string | undefined, jour: string, fait: boolean): Promise<'serveur' | 'enAttente'> {
  try {
    if (!(await cocherSeance(client, jour, fait))) throw new Error('jour_inconnu');
    if (idUtilisateur) await retirerCocheEnAttente(idUtilisateur, jour);
    return 'serveur';
  } catch (erreur) {
    if (idUtilisateur && estErreurReseau(erreur)) {
      await enregistrerCocheEnAttente(idUtilisateur, jour, fait);
      return 'enAttente';
    }
    throw erreur;
  }
}

export type OptionsCreationPlanning = {
  serie?: string | null;
  matieres?: readonly string[] | null;
  contenus?: readonly TypeContenuPlanning[] | null;
  joursRepos?: number | null;
  heureRappel?: string | null;
};

/** Enregistre les préférences du planning (temps par jour, classe, série, matières, types de contenu, repos, rappel). */
export async function definirTemps(
  client: Client,
  niveau: string,
  pays: string,
  minutes: number,
  serieOuOptions?: string | null | OptionsCreationPlanning,
): Promise<void> {
  const opts: OptionsCreationPlanning =
    typeof serieOuOptions === 'string' || serieOuOptions === null || serieOuOptions === undefined
      ? { serie: serieOuOptions }
      : serieOuOptions;
  const { error } = await client.rpc('study_plan_set_time', {
    p_level: niveau,
    p_country: pays,
    p_minutes: minutes,
    ...(opts.serie ? { p_series: opts.serie } : {}),
    ...(opts.matieres && opts.matieres.length > 0 ? { p_subjects: [...opts.matieres] } : {}),
    ...(opts.contenus && opts.contenus.length > 0 ? { p_content_types: [...opts.contenus] } : {}),
    ...(typeof opts.joursRepos === 'number' ? { p_rest_days: opts.joursRepos } : {}),
    ...(opts.heureRappel ? { p_reminder_time: opts.heureRappel } : {}),
  });
  if (error) throw error;
  signalerSucces();
}

/** Si l'élève a déjà un planning, le recalcule pour sa nouvelle classe ou série en gardant son temps par jour. */
export async function actualiserPlanningProfil(client: { rpc?: Client['rpc'] } | null | undefined, niveau: string, pays: string, serie?: string | null): Promise<void> {
  if (!client || typeof client.rpc !== 'function') return;
  try {
    const { data, error } = await client.rpc('my_study_plan');
    if (error) return;
    const p = depuisReponse(data);
    if (p?.minutesParJour) await definirTemps(client as Client, niveau, pays, p.minutesParJour, serie);
  } catch {
    // Recalcul facultatif : hors ligne ou invité, rien à faire.
  }
}

/** Coche ou décoche la séance d'un jour. Faux si le jour n'est pas dans le planning. */
export async function cocherSeance(client: Client, jour: string, fait: boolean): Promise<boolean> {
  const { data, error } = await client.rpc('study_plan_mark_done', { p_day: jour, p_done: fait });
  if (error) throw error;
  signalerSucces();
  return data === true;
}


export type BilanPhase = {
  phase: PhasePlanning;
  totalSeances: number;
  seancesFaites: number;
  totalMinutes: number;
  leconsFaites: number;
  quizFaits: number;
  exercicesFaits: number;
  annalesFaites: number;
  revisionsFaites: number;
};

export type BilanPlanning = {
  termine: boolean;
  cible: CiblePlanning | null;
  totalSeances: number;
  seancesFaites: number;
  tauxReussite: number;
  totalMinutes: number;
  apprentissage: BilanPhase;
  annales: BilanPhase;
  revisionFinale: BilanPhase;
};

export function planningEstTermine(p: Planning, aujourdhui = jourLocalTexte()): boolean {
  if (p.statut !== 'ready') return false;
  const jours = tousLesJours(p);
  if (jours.length === 0) return false;
  const dernierJour = jours[jours.length - 1].jour;
  const dateDepassee = aujourdhui > dernierJour;
  const cibleAtteinte = p.joursRestants !== null && p.joursRestants <= 0;
  const toutFait = jours.every((j) => j.fait);
  return dateDepassee || cibleAtteinte || toutFait;
}

export const CLE_PLANNING_TERMINE_VU = (idUtilisateur: string) => `planning.termine.vu.${idUtilisateur}`;

export async function lirePlanningTermineVu(idUtilisateur?: string): Promise<boolean> {
  if (!idUtilisateur) return false;
  try {
    return (await AsyncStorage.getItem(CLE_PLANNING_TERMINE_VU(idUtilisateur))) === '1';
  } catch {
    return false;
  }
}

export async function noterPlanningTermineVu(idUtilisateur?: string): Promise<void> {
  if (!idUtilisateur) return;
  try {
    await AsyncStorage.setItem(CLE_PLANNING_TERMINE_VU(idUtilisateur), '1');
  } catch {}
}

export function calculerBilanPlanning(
  p: Planning,
  lues: LeconsValidees = {},
  acquises: AcquisesEntrainement = {},
): BilanPlanning {
  const jours = tousLesJours(p);
  const creerPhase = (phase: PhasePlanning): BilanPhase => ({
    phase,
    totalSeances: 0,
    seancesFaites: 0,
    totalMinutes: 0,
    leconsFaites: 0,
    quizFaits: 0,
    exercicesFaits: 0,
    annalesFaites: 0,
    revisionsFaites: 0,
  });

  const apprentissage = creerPhase('learning');
  const annales = creerPhase('past_papers');
  const revisionFinale = creerPhase('final_review');

  let totalMinutes = 0;
  let seancesFaites = 0;

  for (const j of jours) {
    const terminee = seanceTerminee(j, lues, acquises);
    if (terminee) seancesFaites++;
    totalMinutes += j.minutes;

    const phase =
      j.phase === 'past_papers'
        ? annales
        : j.phase === 'final_review'
          ? revisionFinale
          : apprentissage;

    phase.totalSeances++;
    if (terminee) phase.seancesFaites++;
    phase.totalMinutes += j.minutes;

    for (const elem of j.elements) {
      const fait = elementFait(elem, lues, acquises) || j.fait;
      if (elem.genre === 'lecon' && fait) phase.leconsFaites++;
      else if (elem.genre === 'quiz' && fait) phase.quizFaits++;
      else if (elem.genre === 'exercice' && fait) phase.exercicesFaits++;
      else if (elem.genre === 'annales' && (fait || terminee)) phase.annalesFaites++;
      else if ((elem.genre === 'revisionFinale' || elem.genre === 'revisionLibre') && (fait || terminee)) phase.revisionsFaites++;
    }
  }

  const totalSeances = jours.length;
  const tauxReussite = totalSeances > 0 ? Math.round((seancesFaites / totalSeances) * 100) : 0;

  return {
    termine: planningEstTermine(p),
    cible: p.cible,
    totalSeances,
    seancesFaites,
    tauxReussite,
    totalMinutes,
    apprentissage,
    annales,
    revisionFinale,
  };
}
