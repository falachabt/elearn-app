import { Platform } from 'react-native';

import { suivre } from './analytics';

/** Journalise une erreur (console + analytics). Ne lève jamais. */
export function journaliserErreur(erreur: unknown, origine: 'boundary' | 'global', fatale?: boolean) {
  const e = erreur instanceof Error ? erreur : new Error(String(erreur));
  console.error(`[erreur_ecran:${origine}]`, e);
  suivre('erreur_ecran', { message: e.message, pile: e.stack?.slice(0, 1500), origine, fatale });
}

let installe = false;

/** Handler global pour les erreurs non gérées (natif : ErrorUtils ; web : window). */
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
