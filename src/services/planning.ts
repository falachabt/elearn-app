import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { estErreurReseau, signalerEchec, signalerSucces } from './connectivite';
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

export type ElementSeance =
  | { genre: 'lecon'; matiere: string | null; cours: string; lecon: string; minutes: number; coursId: number; leconId: number }
  | { genre: 'annales' | 'revisionFinale' | 'revisionLibre' };

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
};

/** Temps proposés à l'élève (le serveur accepte tout multiple de 15 entre 15 et 240 minutes). */
export const TEMPS_PROPOSES = [15, 30, 45, 60, 90] as const;
export const CLE_COPIE_PLANNING = (idUtilisateur: string) => `planning.copie.${idUtilisateur}`;

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const STATUTS: readonly string[] = ['empty', 'preparing', 'ready', 'no_target'];
const PHASES: readonly string[] = ['learning', 'past_papers', 'final_review'];
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
  return {
    statut: r.status as StatutPlanning,
    minutesParJour: typeof r.minutes_per_day === 'number' ? entier(r.minutes_per_day) : null,
    cible,
    joursRestants: typeof r.days_left === 'number' ? entier(r.days_left) : null,
    couverture: { total: entier(couv?.lessons_total), prevues: entier(couv?.lessons_scheduled) },
    semaines,
  };
}

// --- Règles d'affichage -----------------------------------------------------------------------------------------------

const tousLesJours = (p: Planning) => p.semaines.flatMap((s) => s.jours);

/** Séance du jour donné (AAAA-MM-JJ) ; null un jour de repos ou hors du planning. */
export const seanceDuJour = (p: Planning, aujourdhui: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour === aujourdhui) ?? null;

/** Séance du jour, sinon la prochaine (jour de repos : celle de demain ou d'après) ; null quand le planning est fini. */
export const prochaineSeance = (p: Planning, aujourdhui: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour >= aujourdhui) ?? null;

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

/** Une leçon du planning déjà validée (par le planning ou à la main dans Réviser) compte comme faite. Les autres tâches se cochent avec la séance. */
export const elementFait = (e: ElementSeance, lues: LeconsValidees): boolean => e.genre === 'lecon' && lues[String(e.leconId)] !== undefined;

/** Séance terminée : cochée par l'élève, ou entièrement composée de leçons déjà validées. */
export const seanceTerminee = (j: JourPlanning, lues: LeconsValidees): boolean => j.fait || (j.elements.length > 0 && j.elements.every((e) => elementFait(e, lues)));

/** Tâches faites sur le total d'une séance ; une séance cochée compte toutes ses tâches. */
export function progressionSeance(j: JourPlanning, lues: LeconsValidees): { faits: number; total: number } {
  const total = j.elements.length;
  return { faits: j.fait ? total : j.elements.filter((e) => elementFait(e, lues)).length, total };
}

/** Situation d'un jour par rapport au planning : séance prévue, repos au milieu du planning, ou avant son début / après sa fin. */
export type EtatJour = 'seance' | 'repos' | 'horsPlanning';
export function etatJour(p: Planning, jour: string): EtatJour {
  const jours = tousLesJours(p);
  if (jours.some((j) => j.jour === jour)) return 'seance';
  return jours.length > 0 && jour >= jours[0].jour && jour <= jours[jours.length - 1].jour ? 'repos' : 'horsPlanning';
}

/** Séance d'un jour donné, partout dans le planning ; null un jour de repos ou hors planning. */
export const seanceDe = (p: Planning, jour: string): JourPlanning | null => tousLesJours(p).find((j) => j.jour === jour) ?? null;

/** Planning avec la séance du jour donné cochée ou décochée (mise à jour locale en attendant la réponse du serveur). */
export const avecSeanceFaite = (p: Planning, jour: string, fait: boolean): Planning => ({
  ...p,
  semaines: p.semaines.map((s) => ({ ...s, jours: s.jours.map((j) => (j.jour === jour ? { ...j, fait } : j)) })),
});

/** Heures de travail d'ici la date cible, à l'estime (environ 5,5 jours d'étude sur 7), pour la ligne d'aide du choix du temps. */
export function heuresEstimees(joursRestants: number, minutesParJour: number): number {
  return Math.max(0, Math.round((joursRestants * (5.5 / 7) * minutesParJour) / 60));
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
 */
export async function lirePlanning(client: Client, idUtilisateur?: string): Promise<ResultatPlanning> {
  try {
    const { data, error } = await client.rpc('my_study_plan');
    if (error) throw error;
    signalerSucces();
    const planning = depuisReponse(data);
    if (!planning) throw new Error('planning_illisible');
    if (planning.statut === 'ready') await garderCopie(idUtilisateur, data);
    return { planning, copie: false };
  } catch (erreur) {
    if (!estErreurReseau(erreur)) throw erreur;
    signalerEchec();
    const copie = await lireCopie(idUtilisateur);
    if (copie && copie.statut === 'ready') return { planning: copie, copie: true };
    throw erreur;
  }
}

/** Enregistre le temps par jour (et la classe et la série) ; le serveur calcule le planning tout de suite. */
export async function definirTemps(client: Client, niveau: string, pays: string, minutes: number, serie?: string | null): Promise<void> {
  const { error } = await client.rpc('study_plan_set_time', {
    p_level: niveau,
    p_country: pays,
    p_minutes: minutes,
    ...(serie ? { p_series: serie } : {}),
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
