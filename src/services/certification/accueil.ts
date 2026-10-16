import { lireProfil } from '../profil';
import { lireDiagnostic, lirePlan, obtenirReglages } from './etat';
import { formaterPlage } from './certDiagnostic';
import { jourDe, joursAvantTest } from './jours';
import { chargerDonneesRevision, motsEchus, type DonneesRevision } from './revision';
import { chargerSeanceJour, type EtatSeanceJour } from './seanceJour';
import { lireSerieEnCours, type EtatSerie } from './serie';
import type { PlanEleve } from './types';

export type DonneesAccueil = {
  exam: string;
  plan: PlanEleve | null;
  /** Jours avant le test ; `null` sans date. Négatif : la date est passée. */
  joursRestants: number | null;
  revision: DonneesRevision;
  motsAReviser: number;
  /** Fourchette du dernier diagnostic ou `null` (pas encore d'estimation). */
  plage: string | null;
  /** Série interrompue à reprendre (B1 à B7), sinon `null`. */
  serie: EtatSerie | null;
  /** Séance du jour ; `null` quand le serveur ne répond pas et qu'aucune copie du jour n'existe. */
  seance: EtatSeanceJour | null;
  seanceErreur: boolean;
  /** Diagnostic terminé : sans lui, l'accueil reste la préparation (maquette TOEIC-S7), sans cartes. */
  diagnosticFait: boolean;
};

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
    plage: fin?.estimated ? formaterPlage(fin.score_min, fin.score_max) : null,
    serie: serie && !serie.termine && serie.exam === exam ? serie : null,
    seance,
    seanceErreur,
    diagnosticFait: !!fin,
  };
}

/** Un seul accueil à la fois : le profil TOEIC n'est actif qu'une fois le diagnostic vu (« Voir mon plan »). */
export async function profilToeicActif(): Promise<boolean> {
  const p = await lireProfil();
  return p?.type === 'certification' && p.termine;
}
