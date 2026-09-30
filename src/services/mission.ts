import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import { calculerResultat, melanger, tirerMiniTest, type QuestionTiree, type ResultatMiniTest } from './miniTest';

type Client = Pick<SupabaseClient, 'from' | 'rpc'>;

/** Ligne renvoyée par daily_mission (M4-01). */
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
};

export type Mission = { jour: string; source: 'serveur' | 'locale'; questions: QuestionTiree[] };
export type ResultatMission = ResultatMiniTest & { jour: string; serie: number; graceUtilisee: boolean };

export const TAILLE_MISSION = 5;
export const CLE_MISSION = 'mission.jour';
export const CLE_HISTORIQUE = 'mission.historique';
export const CLE_DERNIER = 'mission.dernier';

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
  p: { niveau: string; pays: string; vraiFaux: { vrai: string; faux: string }; jour?: string },
): Promise<Mission> {
  const jour = p.jour ?? jourLocal();
  const brut = await AsyncStorage.getItem(CLE_MISSION);
  const garde = brut ? (JSON.parse(brut) as Mission & { niveau?: string }) : null;
  if (garde?.jour === jour && garde.niveau === p.niveau) return garde;

  let mission: Mission;
  try {
    const { data, error } = await client.rpc('daily_mission', { p_level: p.niveau, p_country: p.pays, p_day: jour, p_size: TAILLE_MISSION });
    if (error) throw error;
    const questions = ((data ?? []) as LigneMission[]).map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => !!q);
    if (questions.length < 3) throw new Error('mission trop courte');
    mission = { jour, source: 'serveur', questions };
  } catch {
    mission = { jour, source: 'locale', questions: tirerMiniTest(p.niveau) };
  }
  await AsyncStorage.setItem(CLE_MISSION, JSON.stringify({ ...mission, niveau: p.niveau }));
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
  const resultat: ResultatMission = { ...base, jour, serie, graceUtilisee };
  await AsyncStorage.multiSet([
    [CLE_HISTORIQUE, JSON.stringify(historique)],
    [CLE_DERNIER, JSON.stringify(resultat)],
  ]);
  suivre('mission_completed', { score: resultat.score, total: resultat.total, duree_s: resultat.dureeS, serie });
  void client
    .from('mission_runs')
    .insert({ day: jour, level: p.niveau, score: resultat.score, total: resultat.total, duration_s: resultat.dureeS, details: { chapitres: resultat.chapitres } })
    .then(() => undefined, () => undefined);
  return resultat;
}
