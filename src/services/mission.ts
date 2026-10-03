import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import { calculerResultat, melanger, tirerMiniTest, type QuestionTiree, type ResultatMiniTest } from './miniTest';
import { enregistrerCorrection } from './correction';
import { TAILLE_DEFAUT } from './rythme';

type Client = Pick<SupabaseClient, 'from' | 'rpc'>;

/** Ligne renvoyée par daily_mission_lessons (M4-01) ; course_* absents avec l'ancienne daily_mission. */
export type LigneMission = {
  question_id: number;
  quiz_id: string;
  chapter: string | null;
  subject: string | null;
  kind: 'select' | 'qcm' | 'vof' | 'boolean';
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[];
  explanation: string | null;
  course_id?: number | null;
  course_name?: string | null;
};

export type Mission = { jour: string; source: 'serveur' | 'locale'; questions: QuestionTiree[] };
/** Cours dont au moins une question a été ratée, à revoir après la mission. */
export type CoursRate = { id: number; nom: string; erreurs: number };
export type ResultatMission = ResultatMiniTest & { jour: string; serie: number; graceUtilisee: boolean; coursRates?: CoursRate[]; erreurs?: number };

/** 5 chapitres de 2 ou 3 questions (10 à 15). */
export const LECONS_MISSION = 5;
/** Ancienne fonction serveur, gardée tant que daily_mission_lessons n'est pas en production. */
export const TAILLE_MISSION = 5;
export const CLE_MISSION = 'mission.jour';
export const CLE_HISTORIQUE = 'mission.historique';
export const CLE_DERNIER = 'mission.dernier';
export const CLE_ERREURS = 'mission.erreurs';
const cleMissionHorsLigne = (p: { niveau: string; pays: string; concours?: string | null; taille?: number }, jour: string) =>
  `mission.horsLigne.${p.niveau}.${p.pays}.${p.concours ?? 'classe'}.${p.taille ?? TAILLE_DEFAUT}.${jour}`;

/** Jour local au format AAAA-MM-JJ : la mission change à minuit, heure du téléphone. */
export function jourLocal(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const j = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${j}`;
}

function veille(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return jourLocal(new Date(a, m - 1, j - 1));
}

/**
 * Convertit une question du serveur pour le lecteur : vrai/faux dans l'ordre Vrai puis Faux (libellés traduits),
 * autres choix mélangés. Renvoie null si la bonne réponse ne figure pas dans les choix.
 */
export function convertir(l: LigneMission, vraiFaux: { vrai: string; faux: string }, aleatoire: () => number = Math.random): QuestionTiree | null {
  const vof = l.kind === 'vof' || l.kind === 'boolean';
  const options = vof
    ? [...l.options].sort((a, b) => (a.id === 'T' ? -1 : b.id === 'T' ? 1 : 0)).map((o) => ({ ...o, text: o.id === 'T' ? vraiFaux.vrai : o.id === 'F' ? vraiFaux.faux : o.text }))
    : melanger(l.options, aleatoire);
  const bonne = options.findIndex((o) => o.id === l.correct[0]);
  if (bonne < 0 || options.some((o) => !o.text?.trim())) return null;
  return {
    id: String(l.question_id),
    matiere: 'logique',
    libelleMatiere: l.subject,
    chapitre: l.chapter?.trim() || l.subject || '',
    cours: l.course_id ? { id: l.course_id, nom: l.course_name?.trim() || l.chapter?.trim() || '' } : null,
    enonce: l.prompt.trim(),
    choix: options.map((o) => o.text.trim()),
    bonne,
    explication: l.explanation?.trim() ?? '',
  };
}

/**
 * Mission du jour (M4-01) : tirée par le serveur pour la classe et le pays, gardée pour la journée (elle se rejoue sans
 * réseau). Sans réseau ou sans contenu pour la classe, questions embarquées de la classe.
 */
export async function chargerMission(
  client: Client,
  p: { niveau: string; pays: string; vraiFaux: { vrai: string; faux: string }; jour?: string; taille?: number; concours?: string | null },
): Promise<Mission> {
  const jour = p.jour ?? jourLocal();
  const taille = p.taille ?? TAILLE_DEFAUT;
  const missionHorsLigne = await AsyncStorage.getItem(cleMissionHorsLigne({ ...p, taille }, jour));
  if (missionHorsLigne) return JSON.parse(missionHorsLigne) as Mission;
  const brut = await AsyncStorage.getItem(CLE_MISSION);
  const garde = brut ? (JSON.parse(brut) as Mission & { niveau?: string; taille?: number; concours?: string | null }) : null;
  if (garde?.jour === jour && garde.niveau === p.niveau && (garde.taille ?? taille) === taille && (garde.concours ?? null) === (p.concours ?? null)) return garde;

  let mission: Mission;
  try {
    // Candidat : les quiz des cours de son concours. Élève : du plus récent au plus ancien, la fonction peut ne pas
    // encore être déployée en production.
    let { data, error } = p.concours
      ? await client.rpc('daily_mission_contest', { p_contest: p.concours, p_day: jour, p_questions: taille })
      : await client.rpc('daily_mission_sized', { p_level: p.niveau, p_country: p.pays, p_day: jour, p_questions: taille });
    if (error) ({ data, error } = await client.rpc('daily_mission_lessons', { p_level: p.niveau, p_country: p.pays, p_day: jour, p_lessons: LECONS_MISSION }));
    if (error) ({ data, error } = await client.rpc('daily_mission', { p_level: p.niveau, p_country: p.pays, p_day: jour, p_size: TAILLE_MISSION }));
    if (error) throw error;
    const questions = ((data ?? []) as LigneMission[]).map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => !!q);
    if (questions.length < 3) throw new Error('mission trop courte');
    mission = { jour, source: 'serveur', questions };
  } catch {
    // Pas gardée : au prochain affichage, on retente le serveur.
    return { jour, source: 'locale', questions: tirerMiniTest(p.niveau) };
  }
  await AsyncStorage.setItem(CLE_MISSION, JSON.stringify({ ...mission, niveau: p.niveau, taille, concours: p.concours ?? null }));
  return mission;
}

/** Prépare une journée future sans écraser la mission courante ni la progression de l'élève. */
export async function prechargerMission(
  client: Client,
  p: { niveau: string; pays: string; vraiFaux: { vrai: string; faux: string }; jour: string; taille?: number; concours?: string | null },
): Promise<Mission> {
  const taille = p.taille ?? TAILLE_DEFAUT;
  const cle = cleMissionHorsLigne({ ...p, taille }, p.jour);
  const garde = await AsyncStorage.getItem(cle);
  if (garde) return JSON.parse(garde) as Mission;

  let resultat = p.concours
    ? await client.rpc('daily_mission_contest', { p_contest: p.concours, p_day: p.jour, p_questions: taille })
    : await client.rpc('daily_mission_sized', { p_level: p.niveau, p_country: p.pays, p_day: p.jour, p_questions: taille });
  if (resultat.error) resultat = await client.rpc('daily_mission_lessons', { p_level: p.niveau, p_country: p.pays, p_day: p.jour, p_lessons: LECONS_MISSION });
  if (resultat.error) resultat = await client.rpc('daily_mission', { p_level: p.niveau, p_country: p.pays, p_day: p.jour, p_size: TAILLE_MISSION });
  if (resultat.error) throw resultat.error;
  const questions = ((resultat.data ?? []) as LigneMission[]).map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => !!q);
  if (questions.length < 3) throw new Error('mission trop courte');
  const mission: Mission = { jour: p.jour, source: 'serveur', questions };
  await AsyncStorage.setItem(cle, JSON.stringify(mission));
  return mission;
}

/**
 * Série de jours (M4-02) avec un jour de grâce par semaine : un seul jour manqué entre deux jours joués ne casse pas
 * la série, au plus une fois tous les 7 jours. La mission du jour pas encore faite ne casse rien.
 */
export function calculerSerie(jours: readonly string[], aujourdhui: string = jourLocal()): { serie: number; graceUtilisee: boolean; faiteAujourdhui: boolean } {
  const joues = new Set(jours);
  const faiteAujourdhui = joues.has(aujourdhui);
  let jour = faiteAujourdhui ? aujourdhui : veille(aujourdhui);
  let serie = 0;
  let pas = 0;
  let derniereGrace = -Infinity;
  for (;;) {
    if (joues.has(jour)) {
      serie++;
    } else if (joues.has(veille(jour)) && pas - derniereGrace >= 7) {
      derniereGrace = pas;
    } else {
      break;
    }
    jour = veille(jour);
    pas++;
  }
  return { serie, graceUtilisee: derniereGrace >= 0 && derniereGrace < 7 && serie > 0, faiteAujourdhui };
}

export async function lireHistorique(): Promise<string[]> {
  const brut = await AsyncStorage.getItem(CLE_HISTORIQUE);
  return brut ? (JSON.parse(brut) as string[]) : [];
}

export async function lireDernierResultat(): Promise<ResultatMission | null> {
  const brut = await AsyncStorage.getItem(CLE_DERNIER);
  return brut ? (JSON.parse(brut) as ResultatMission) : null;
}

/**
 * Fin de mission (M4-03) : résultat et série calculés sur le téléphone (visibles sans réseau), puis envoyés au serveur
 * sans bloquer. Une deuxième mission le même jour ne change pas la série.
 */
export async function terminerMission(
  client: Client,
  p: { questions: readonly QuestionTiree[]; reponses: readonly number[]; niveau: string; dureeS: number; jour?: string },
): Promise<ResultatMission> {
  const jour = p.jour ?? jourLocal();
  const base = calculerResultat(p.questions, p.reponses, { niveau: p.niveau, dureeS: p.dureeS });
  const historique = [...new Set([...(await lireHistorique()), jour])].sort().slice(-400);
  const { serie, graceUtilisee } = calculerSerie(historique, jour);
  const ratees = p.questions.filter((q, i) => p.reponses[i] !== q.bonne);
  const resultat: ResultatMission = { ...base, jour, serie, graceUtilisee, coursRates: coursRates(ratees), erreurs: ratees.length };
  await AsyncStorage.multiSet([
    [CLE_HISTORIQUE, JSON.stringify(historique)],
    [CLE_DERNIER, JSON.stringify(resultat)],
    [CLE_ERREURS, JSON.stringify(ratees)],
  ]);
  await enregistrerCorrection({ source: 'mission', questions: [...p.questions], reponses: [...p.reponses], contexte: { type: 'mission' } });
  suivre('mission_completed', { score: resultat.score, total: resultat.total, duree_s: resultat.dureeS, serie });
  void client
    .from('mission_runs')
    .insert({ day: jour, level: p.niveau, score: resultat.score, total: resultat.total, duration_s: resultat.dureeS, details: { chapitres: resultat.chapitres } })
    .then(() => undefined, () => undefined);
  return resultat;
}

/** Cours des questions ratées, du plus d'erreurs au moins, sans doublon. */
export function coursRates(ratees: readonly QuestionTiree[]): CoursRate[] {
  const parCours = new Map<number, CoursRate>();
  for (const q of ratees) {
    if (!q.cours) continue;
    const c = parCours.get(q.cours.id) ?? { id: q.cours.id, nom: q.cours.nom, erreurs: 0 };
    c.erreurs++;
    parCours.set(q.cours.id, c);
  }
  return [...parCours.values()].sort((a, b) => b.erreurs - a.erreurs);
}

/** Questions ratées à la dernière mission, pour « Refaire mes erreurs ». */
export async function lireErreurs(): Promise<QuestionTiree[]> {
  const brut = await AsyncStorage.getItem(CLE_ERREURS);
  return brut ? (JSON.parse(brut) as QuestionTiree[]) : [];
}
