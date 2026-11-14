import { lireProfil } from '../profil';
import { obtenirApi } from './api';
import { ErreurContenuExpire, lireAvecCopie } from './copie';
import { obtenirReglages } from './etat';
import { jourDe, type Jour } from './jours';
import { etatContenu, maitriseDeLaFamille, notionsDeLaFamille } from './etatsContenu';
import { nombreFaits, scoreBorne } from './listesTests';
import { chargerRevision } from './revision';
import type { FamilleNotion, NotionListee, PeriodeStats, Stats } from './types';

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

/** Décompte des notions par état et par catégorie (maquette v34, TOEIC-V34-STATS) : Vus, Validés, Maîtrisés, À revoir. */
export type DecompteNotions = {
  vus: number;
  valides: number;
  maitrises: number;
  aRevoir: number;
  familles: { famille: FamilleNotion; total: number; pourcent: number }[];
};

const FAMILLES: FamilleNotion[] = ['grammaire', 'vocabulaire', 'piege', 'methode'];

/**
 * Décompte calculé sur les fiches publiées. « Vus » compte les notions ouvertes (vues, validées ou maîtrisées), « Validés »
 * les validées et maîtrisées, « Maîtrisés » les maîtrisées : chaque compteur contient le suivant, comme « vues 12, validées 6,
 * maîtrisées 2 » de la maquette. Les catégories sans fiche sont omises.
 */
export function decompteDesNotions(notions: NotionListee[]): DecompteNotions {
  const avecFiche = notions.filter((n) => n.fiche);
  const etats = avecFiche.map((n) => etatContenu(n));
  return {
    vus: etats.filter((e) => e === 'vu' || e === 'valide' || e === 'maitrise').length,
    valides: etats.filter((e) => e === 'valide' || e === 'maitrise').length,
    maitrises: etats.filter((e) => e === 'maitrise').length,
    aRevoir: etats.filter((e) => e === 'a_revoir').length,
    familles: FAMILLES.map((famille) => ({ famille, total: notionsDeLaFamille(notions, famille).length, pourcent: maitriseDeLaFamille(notions, famille) })).filter((f) => f.total > 0),
  };
}

/** Décompte lu sur la révision (copie hors ligne comprise) ; `null` quand elle n'est pas lisible : le bloc disparaît, jamais de zéro inventé. */
export async function chargerDecompte(): Promise<DecompteNotions | null> {
  try {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const r = await chargerRevision(exam, jourDe(new Date()));
    return decompteDesNotions(r.valeur.notions);
  } catch {
    return null;
  }
}

/** Tests faits sur le total des tests proposés, et meilleur score des demi-tests et tests complets (maquette v33). */
export type ResumeTests = { faits: number; total: number; meilleur: { valeur: number; max: number } | null };

export async function chargerResumeTests(): Promise<ResumeTests | null> {
  try {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const api = obtenirApi();
    const [defs, tentatives, reglages] = await Promise.all([api.listerDefsTests(exam, null), api.listerTentatives(exam), obtenirReglages().catch(() => null)]);
    const max = reglages?.objectifMax ?? null;
    const meilleurDe = (kinds: string[]) => {
      const scores = tentatives.filter((x) => kinds.includes(x.kind) && x.status === 'finished' && x.score !== null && x.score !== undefined).map((x) => x.score as number);
      return scores.length ? Math.max(...scores) : null;
    };
    const complet = meilleurDe(['full']);
    const demi = meilleurDe(['half_listening', 'half_reading']);
    const meilleur = complet !== null ? scoreBorne('full', complet, 200, max) : scoreBorne('listening', demi, 100, max);
    return { faits: nombreFaits(defs), total: defs.length, meilleur };
  } catch {
    return null;
  }
}
