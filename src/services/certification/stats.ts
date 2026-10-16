import { lireProfil } from '../profil';
import { obtenirApi } from './api';
import { ErreurContenuExpire, lireAvecCopie } from './copie';
import { obtenirReglages } from './etat';
import { jourDe, type Jour } from './jours';
import type { PeriodeStats, Stats } from './types';

/** Clé locale de la dernière réponse par période (ST4). Lue seulement par `lireAvecCopie` (AGENTS.md §16 bis). */
export const CLE_STATS = (exam: string, periode: PeriodeStats) => `cert.cache.stats.${exam}.${periode}`;

/** Statistiques d'une période, réseau d'abord, copie datée hors ligne. `depuisCopie` déclenche la mention « Dernier calcul ». */
export const chargerStats = (exam: string, periode: PeriodeStats, jour: Jour) =>
  lireAvecCopie<Stats>(CLE_STATS(exam, periode), () => obtenirApi().lireStats(exam, periode, jour));

/** Les trois segments de période (ST1) dans l'ordre affiché. */
export const PERIODES: PeriodeStats[] = [7, 30, 0];

export type DonneesStats = { exam: string; stats: Stats; depuisCopie: boolean; scoreMax: number; /** La copie locale a plus de 7 jours : elle n'est pas servie (S9). */ expire: boolean };

/** Données de l'écran Statistiques : la période demandée, le score maximal pour l'échelle du graphique. */
export async function chargerPageStats(periode: PeriodeStats): Promise<DonneesStats> {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  const reglages = await obtenirReglages();
  try {
    const r = await chargerStats(exam, periode, jourDe(new Date()));
    return { exam, stats: r.valeur, depuisCopie: r.depuisCopie, scoreMax: reglages.objectifMax, expire: false };
  } catch (e) {
    if (!(e instanceof ErreurContenuExpire)) throw e;
    const vide: Stats = { status: 'empty', periode, reponsesTotal: 0, score: null, barres: [], tendance: null, parties: [], minutesSeances: 0, minutesLecture: 0, joursSur7: 0, seances: 0, serieJours: 0, mots: { aRevoir: 0, enCours: 0, connus: 0 }, calculeLe: null };
    return { exam, stats: vide, depuisCopie: false, scoreMax: reglages.objectifMax, expire: true };
  }
}
