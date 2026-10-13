import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { lireEcranCourant, suivreException } from './analytics';
import { masquer } from './confidentialite';
import { lireVersion } from './version';

export const CLE_JOURNAL_ERREURS = 'erreurs.journal';
export const TAILLE_JOURNAL_ERREURS = 50;

export type EntreeJournal = {
  date: string;
  origine: 'boundary' | 'global';
  message: string;
  pile?: string;
  fatale?: boolean;
  ecran: string | null;
  version: string;
  plateforme: string;
};

let ecritureEnCours: Promise<void> = Promise.resolve();

/** Ajoute une entrée au journal local (50 dernières erreurs, lisible hors ligne et sans PostHog). */
function ajouterAuJournal(entree: EntreeJournal): Promise<void> {
  ecritureEnCours = ecritureEnCours.then(async () => {
    try {
      const brut = await AsyncStorage.getItem(CLE_JOURNAL_ERREURS);
      const liste = brut ? (JSON.parse(brut) as EntreeJournal[]) : [];
      liste.push(entree);
      await AsyncStorage.setItem(CLE_JOURNAL_ERREURS, JSON.stringify(liste.slice(-TAILLE_JOURNAL_ERREURS)));
    } catch {
      // Le journal ne doit jamais faire échouer le traitement de l'erreur.
    }
  });
  return ecritureEnCours;
}

export async function lireJournalErreurs(): Promise<EntreeJournal[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_JOURNAL_ERREURS);
    return brut ? (JSON.parse(brut) as EntreeJournal[]) : [];
  } catch {
    return [];
  }
}

export async function viderJournalErreurs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLE_JOURNAL_ERREURS);
  } catch {
    // ignoré
  }
}

/**
 * Journalise une erreur : console, journal local et PostHog.
 *
 * Les exceptions non gérées et les refus de promesse sont déjà envoyés à PostHog par le suivi d'erreurs du SDK
 * (`errorTracking.autocapture`) : ici elles ne vont qu'au journal local, sinon elles seraient comptées deux fois. Les
 * erreurs de rendu attrapées par la frontière d'erreur, que le SDK ne voit pas, sont envoyées avec leur contexte
 * (écran, version, plateforme).
 */
export function journaliserErreur(erreur: unknown, origine: 'boundary' | 'global', fatale?: boolean) {
  const e = erreur instanceof Error ? erreur : new Error(String(erreur));
  console.warn(`[erreur:${origine}]`, e);
  let version = '?';
  try {
    version = lireVersion().version;
  } catch {
    // version inconnue
  }
  const ecran = lireEcranCourant();
  void ajouterAuJournal({
    date: new Date().toISOString(),
    origine,
    message: masquer(e.message).slice(0, 300),
    pile: e.stack ? masquer(e.stack).slice(0, 1500) : undefined,
    fatale,
    ecran,
    version,
    plateforme: Platform.OS,
  });
  if (origine === 'boundary') suivreException(e, { origine, ecran, version_app: version, plateforme: Platform.OS, fatale: fatale ?? false });
}

let installe = false;

/** Handler global pour les erreurs non gérées (natif : ErrorUtils ; web : window), chaînée au handler du SDK. */
export function installerHandlerGlobal() {
  if (installe) return;
  installe = true;
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, f?: boolean) => void; setGlobalHandler(h: (e: unknown, f?: boolean) => void): void } }).ErrorUtils;
  if (Platform.OS !== 'web' && utils) {
    const precedent = utils.getGlobalHandler();
    utils.setGlobalHandler((erreur, fatale) => {
      journaliserErreur(erreur, 'global', fatale);
      precedent?.(erreur, fatale);
    });
    return;
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', (ev) => journaliserErreur(ev.error ?? ev.message, 'global'));
    window.addEventListener('unhandledrejection', (ev) => journaliserErreur(ev.reason, 'global'));
  }
}

/** Pour les tests uniquement. */
export function reinitialiserHandlerPourTests() {
  installe = false;
}
