import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { obtenirApi } from './api';
import { lireReglages, type LigneReglage, type Reglages } from './reglages';
import type { Examen, FinTentative, PlanEleve, ReponseEnvoyee, Tentative, TentativeListee } from './types';

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

/**
 * Reconnexion ou nouvel appareil : la déconnexion efface tout l'état local (M2-14), donc aussi le diagnostic
 * terminé gardé sur l'appareil — mais le serveur garde la tentative (historique des tentatives). Si l'appareil n'a
 * ni résultat ni diagnostic en cours, l'état terminé est restauré depuis le serveur : l'accueil et la barre
 * d'onglets reconnaissent le diagnostic fait sans dépendre du drapeau local perdu. Tout ou rien : si le serveur ne
 * répond pas (hors ligne) ou si la tentative complète ne peut pas être relue, rien n'est écrit et le comportement
 * actuel (premier pas) reste — la restauration repartira à la prochaine ouverture.
 */
export async function restaurerDiagnostic(exam: string): Promise<EtatDiagnostic | null> {
  const existant = await lireDiagnostic();
  if (existant?.fin || existant?.tentative) return existant;
  try {
    const api = obtenirApi();
    const liste = await api.listerTentatives(exam);
    const faite: TentativeListee | undefined = liste.find((t) => t.kind === 'diagnostic' && t.status === 'finished');
    if (!faite) return existant;
    const tentative = await api.lireTentative(faite.id);
    if (tentative.kind !== 'diagnostic') return existant;
    const etat: EtatDiagnostic = {
      clientUuid: randomUUID(),
      tentative,
      reponses: [],
      index: tentative.questions.length,
      termine: true,
      fin: {
        status: 'finished',
        attempt_id: faite.id,
        kind: 'diagnostic',
        // Le serveur estime le diagnostic dès qu'il a produit un score ou une fourchette (voir terminerTentative).
        estimated: faite.score !== null || faite.scoreMin !== null,
        score: faite.score ?? null,
        score_min: faite.scoreMin,
        score_max: faite.scoreMax,
        per_part: faite.perPart ?? {},
        // Le détail question par question (résultats, réponses) ne vit que sur l'appareil d'origine : la revue
        // détaillée du diagnostic reste là-bas, l'historique serveur garde le score et la maîtrise.
        results: [],
        replay: false,
      },
    };
    await ecrireDiagnostic(etat);
    return etat;
  } catch {
    return existant;
  }
}

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
