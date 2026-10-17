import { lireProfil } from '../profil';
import { lireDiagnostic, lirePlan, obtenirReglages } from './etat';
import { scoreEstime } from './certDiagnostic';
import { jourDe, joursAvantTest } from './jours';
import { chargerDonneesRevision, motsEchus, type DonneesRevision } from './revision';
import { chargerSeanceJour, seancesFaitesSemaine, type EtatSeanceJour } from './seanceJour';
import { lireSerieEnCours, type EtatSerie } from './serie';
import type { PlanEleve } from './types';

export type DonneesAccueil = {
  exam: string;
  plan: PlanEleve | null;
  /** Jours avant le test ; `null` sans date. Négatif : la date est passée. */
  joursRestants: number | null;
  revision: DonneesRevision;
  motsAReviser: number;
  /** Score estimé sur 990 (exact, sinon milieu de la fourchette) ; `null` sans estimation. */
  score: number | null;
  /** Série interrompue à reprendre (B1 à B7), sinon `null`. */
  serie: EtatSerie | null;
  /** Séance du jour ; `null` quand le serveur ne répond pas et qu'aucune copie du jour n'existe. */
  seance: EtatSeanceJour | null;
  seanceErreur: boolean;
  /** Séances de la semaine : faites sur l'appareil, prévues par le plan (3 par semaine à défaut). */
  seancesSemaine: { faites: number; prevues: number };
  /** Diagnostic terminé : sans lui, l'accueil reste la préparation (maquette TOEIC-S7), sans cartes. */
  diagnosticFait: boolean;
};

/** Séances prévues par semaine quand le plan n'en porte pas (valeur de départ de la maquette N1). */
export const SEANCES_PAR_SEMAINE = 3;

/** Durée voulue de la séance : celle du plan, sinon la valeur par défaut de la configuration (jamais écrite en dur). */
export async function minutesDeLaSeance(): Promise<number> {
  const [plan, r] = await Promise.all([lirePlan(), obtenirReglages()]);
  return plan?.minutes && r.seanceMinutesChoix.includes(plan.minutes) ? plan.minutes : r.seanceMinutesDefaut;
}

export async function chargerAccueil(): Promise<DonneesAccueil> {
  const profil = await lireProfil();
  const exam = profil?.exam ?? 'toeic';
  const aujourdhui = jourDe(new Date());
  const [plan, revision, serie, diagnostic, minutes] = await Promise.all([lirePlan(), chargerDonneesRevision(), lireSerieEnCours(), lireDiagnostic(), minutesDeLaSeance().catch(() => null)]);
  let seance: EtatSeanceJour | null = null;
  let seanceErreur = false;
  if (minutes !== null) {
    try {
      seance = await chargerSeanceJour(exam, aujourdhui, minutes);
    } catch {
      seanceErreur = true;
    }
  } else seanceErreur = true;
  const fin = diagnostic?.fin;
  return {
    exam,
    plan,
    joursRestants: joursAvantTest(plan?.dateTest, aujourdhui),
    revision,
    motsAReviser: motsEchus(revision.carnet, aujourdhui).length,
    score: scoreEstime(fin),
    serie: serie && !serie.termine && serie.exam === exam ? serie : null,
    seance,
    seanceErreur,
    seancesSemaine: { faites: await seancesFaitesSemaine(aujourdhui), prevues: SEANCES_PAR_SEMAINE },
    diagnosticFait: !!fin,
  };
}

/** Un seul accueil à la fois : le profil TOEIC n'est actif qu'une fois le diagnostic vu (« Voir mon plan »). */
export async function profilToeicActif(): Promise<boolean> {
  const p = await lireProfil();
  return p?.type === 'certification';
}
