import AsyncStorage from '@react-native-async-storage/async-storage';

import { obtenirApi } from './api';
import { lireReglages, type LigneReglage, type Reglages } from './reglages';
import type { Examen, FinTentative, PlanEleve, ReponseEnvoyee, Tentative } from './types';

/** État local du profil TOEIC : l'élève peut tout faire sans compte et hors ligne (le serveur reprend au retour du réseau). */
export const CLE_PLAN = 'cert.plan';
export const CLE_DIAGNOSTIC = 'cert.diagnostic';
export const CLE_SERIE = 'cert.serie';
export const CLE_CACHE_EXAMENS = 'cert.cache.examens';
export const CLE_CACHE_REGLAGES = 'cert.cache.reglages';

export async function lireJson<T>(cle: string): Promise<T | null> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

export async function ecrireJson(cle: string, valeur: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Non mémorisé : l'écran continue, la reprise repartira du serveur.
  }
}

// Plan ------------------------------------------------------------------------------------------------------------
export const lirePlan = () => lireJson<PlanEleve>(CLE_PLAN);

/** Fusionne dans le plan local, puis tente le serveur (silencieux : l'écriture est rejouée plus tard si besoin). */
export async function ecrirePlan(partiel: Partial<PlanEleve> & { exam: string }, options: { effacerDate?: boolean } = {}): Promise<PlanEleve> {
  const avant = await lirePlan();
  const base: PlanEleve = avant && avant.exam === partiel.exam ? avant : { exam: partiel.exam, pays: avant?.pays ?? 'CM', objectif: null, dateTest: null, minutes: null };
  const plan: PlanEleve = { ...base, ...partiel, dateTest: options.effacerDate ? null : (partiel.dateTest ?? base.dateTest) };
  await ecrireJson(CLE_PLAN, plan);
  void obtenirApi()
    .enregistrerPlan({ exam: plan.exam, objectif: partiel.objectif, dateTest: partiel.dateTest, minutes: partiel.minutes, effacerDate: options.effacerDate })
    .catch(() => {});
  return plan;
}

// Diagnostic (A5 à A8) ------------------------------------------------------------------------------------------
export type EtatDiagnostic = {
  /** Identifiant de reprise : une seule tentative par appareil tant que le diagnostic n'est pas terminé. */
  clientUuid: string;
  tentative: Tentative | null;
  reponses: ReponseEnvoyee[];
  /** Index de la question affichée. */
  index: number;
  /** Fin locale (A8) : les 20 réponses sont gardées, l'envoi au serveur peut attendre. */
  termine: boolean;
  fin: FinTentative | null;
};

export const lireDiagnostic = () => lireJson<EtatDiagnostic>(CLE_DIAGNOSTIC);
export const ecrireDiagnostic = (etat: EtatDiagnostic) => ecrireJson(CLE_DIAGNOSTIC, etat);
export const effacerDiagnostic = () => AsyncStorage.removeItem(CLE_DIAGNOSTIC).catch(() => {});

// Listes servies par le serveur, gardées pour l'ouverture hors ligne (A2, R-04) --------------------------------------
export async function obtenirExamens(): Promise<{ examens: Examen[]; depuisCache: boolean }> {
  try {
    const examens = await obtenirApi().listerExamens();
    await ecrireJson(CLE_CACHE_EXAMENS, examens);
    return { examens, depuisCache: false };
  } catch (e) {
    const cache = await lireJson<Examen[]>(CLE_CACHE_EXAMENS);
    if (cache) return { examens: cache, depuisCache: true };
    throw e;
  }
}

export async function obtenirReglages(): Promise<Reglages> {
  try {
    const lignes = await obtenirApi().lireReglages();
    await ecrireJson(CLE_CACHE_REGLAGES, lignes);
    return lireReglages(lignes);
  } catch (e) {
    const cache = await lireJson<LigneReglage[]>(CLE_CACHE_REGLAGES);
    if (cache) return lireReglages(cache);
    throw e;
  }
}
