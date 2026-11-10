import { lireProfil } from '../profil';
import { obtenirApi } from './api';
import { obtenirReglages } from './etat';
import { jourDe } from './jours';
import { derniereEstimation } from './testsAccueil';
import type { Stats, TentativeListee } from './types';

export type DonneesHistorique = {
  exam: string;
  /** Score maximal de l'examen (sert à écrire « sur 990 ») : réglage du serveur. */
  scoreMax: number;
  tentatives: TentativeListee[];
  estimation: { min: number; max: number } | null;
  /** Tendance calculée par le serveur sur toute la période ; `null` tant qu'il n'y a pas assez de points. */
  tendance: Stats['tendance'];
};

export async function chargerHistorique(): Promise<DonneesHistorique> {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  const api = obtenirApi();
  const [tentatives, stats, r] = await Promise.all([api.listerTentatives(exam), api.lireStats(exam, 0, jourDe(new Date())).catch(() => null), obtenirReglages()]);
  return { exam, scoreMax: r.objectifMax, tentatives, estimation: derniereEstimation(tentatives), tendance: stats?.tendance ?? null };
}

export async function chargerTentative(id: string): Promise<TentativeListee | null> {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  const liste = await obtenirApi().listerTentatives(exam);
  return liste.find((x) => x.id === id) ?? null;
}

/** Bonnes réponses d'une tentative : somme des parties. */
export const bonnesReponses = (t: TentativeListee) => Object.values(t.perPart ?? {}).reduce((a, p) => a + p.correct, 0);
/** Durée en minutes entre le départ et la fin ; `null` si la tentative n'est pas finie. */
export function dureeMinutes(t: TentativeListee): number | null {
  if (!t.finishedAt) return null;
  const ms = Date.parse(t.finishedAt) - Date.parse(t.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? Math.max(1, Math.round(ms / 60_000)) : null;
}
