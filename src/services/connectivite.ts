import { AppState, Platform } from 'react-native';

/**
 * État de connexion de l'application (issue #25).
 *
 * Aucun module natif ici : la détection repose sur une **sonde du serveur** (`sonder()`), pas sur les évènements
 * réseau du système. C'est un choix délibéré, pour deux raisons.
 *
 * 1. `expo-network` est un module natif. L'ajouter casse tout binaire déjà publié qui ne le contient pas :
 *    `requireNativeModule('ExpoNetwork')` lève à l'évaluation du module, donc au démarrage de l'app, avant tout
 *    rendu — et aucun try/catch autour de l'appel ne peut l'attraper. Le garde-fou
 *    `src/__tests__/garde-module-natif.test.ts` interdit désormais ce cas.
 * 2. Ce que le système annonce est peu fiable. Sur web, `isConnected` et `isInternetReachable` dérivent tous deux
 *    de `navigator.onLine` ; en natif, l'interface peut être active avec un portail captif ou un backend éteint.
 *    Une requête qui échoue est une preuve directe, pas une supposition.
 *
 * `signalerEchec()` / `signalerSucces()` permettent à une action de mettre l'état à jour immédiatement, sans
 * attendre le prochain cycle de sondage : l'indicateur réagit à la seconde où une requête échoue.
 *
 * Les deux notions restent distinctes :
 * - `connecte` : l'appareil dispose d'une interface réseau (déduit du résultat de la sonde) ;
 * - `backend` : le serveur a répondu à la dernière sonde ; null tant qu'aucune sonde n'a abouti.
 */
export type EtatConnectivite = {
  /** Interface réseau utilisable. */
  connecte: boolean;
  /** Internet annoncé joignable. Aligné sur `connecte` : sans module natif, la sonde est la seule source. */
  internet: boolean;
  /** Dernière réponse connue de la sonde serveur ; null tant qu'aucune sonde n'a abouti. */
  backend: boolean | null;
  /** Dernier changement d'état connu, en ISO. */
  actualiseLe: string;
};

/** Délai au-delà duquel une sonde est considérée en échec (réseau instable : on ne bloque pas l'élève). */
export const DELAI_SONDE_MS = 6000;

/** Espacement entre deux sondes automatiques pendant que l'app est au premier plan. */
export const PERIODE_SONDE_MS = 15000;

let etat: EtatConnectivite = { connecte: true, internet: true, backend: null, actualiseLe: new Date().toISOString() };
let arret: (() => void) | null = null;
let minuterie: ReturnType<typeof setInterval> | null = null;
let sondeEnCours: Promise<boolean> | null = null;
const ecouteurs = new Set<(e: EtatConnectivite) => void>();

function publier(suivant: EtatConnectivite) {
  etat = suivant;
  for (const ecouteur of ecouteurs) ecouteur(etat);
}

function maj(partiel: Partial<Omit<EtatConnectivite, 'actualiseLe'>>, maintenant = new Date()) {
  const suivant: EtatConnectivite = { ...etat, ...partiel, actualiseLe: maintenant.toISOString() };
  if (suivant.connecte === etat.connecte && suivant.internet === etat.internet && suivant.backend === etat.backend) return;
  publier(suivant);
}

/** État courant, lisible sans React (services, files de synchronisation). */
export function lireConnectivite(): EtatConnectivite {
  return etat;
}

/** S'abonne aux changements. Renvoie la fonction d'arrêt. */
export function ecouterConnectivite(ecouteur: (e: EtatConnectivite) => void): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

/**
 * L'application peut-elle présenter son état comme « en ligne » ?
 * Une sonde en échec suffit à répondre non, même si l'appareil a une interface réseau.
 */
export function estEnLigne(): boolean {
  return etat.connecte && etat.backend !== false;
}

/** Une action qui exige le serveur peut-elle être lancée ? Même règle que l'indicateur. */
export function serveurJoignable(): boolean {
  return estEnLigne();
}

/** Force l'état (tests uniquement). */
export function definirConnectivitePourTest(partiel: Partial<EtatConnectivite>): void {
  publier({ ...etat, ...partiel, actualiseLe: new Date().toISOString() });
}

/**
 * Une action serveur vient d'échouer pour cause de réseau : on le retient tout de suite, sans attendre la sonde.
 * L'indicateur passe hors ligne immédiatement, ce qui évite de présenter l'échec comme une erreur de l'élève.
 */
export function signalerEchec(maintenant = new Date()): void {
  maj({ backend: false }, maintenant);
}

/** Une action serveur a répondu : le serveur est joignable, la dernière sonde en échec est périmée. */
export function signalerSucces(maintenant = new Date()): void {
  maj({ connecte: true, internet: true, backend: true }, maintenant);
}

/** Reconnaît une erreur de réseau (et non un refus métier du serveur, qui prouve au contraire qu'il répond). */
export function estErreurReseau(erreur: unknown): boolean {
  const e = erreur as { name?: string; message?: string } | null;
  if (!e) return false;
  const nom = e.name ?? '';
  const message = (e.message ?? '').toLowerCase();
  if (nom === 'AuthRetryableFetchError' || nom === 'AbortError' || nom === 'TypeError') return true;
  return /network|failed to fetch|fetch failed|timeout|timed out|econnrefused|enotfound|délai/.test(message);
}

/**
 * Interroge le serveur pour savoir s'il répond vraiment. `fetchTete` est injectable pour les tests ; par défaut
 * une requête HEAD légère sur l'adresse Supabase, sans en-tête d'authentification.
 */
export async function sonder(fetchTete?: () => Promise<unknown>, maintenant = Date.now()): Promise<boolean> {
  const appel = fetchTete ?? sondeParDefaut;
  const enCours = (async () => {
    let joignable = false;
    try {
      await appel();
      joignable = true;
    } catch {
      joignable = false;
    }
    // Une sonde réussie prouve l'interface et le serveur ; une sonde ratée ne prouve que le serveur.
    maj({ internet: joignable || etat.internet, backend: joignable }, new Date(maintenant));
    return joignable;
  })();
  sondeEnCours = enCours;
  try {
    return await enCours;
  } finally {
    if (sondeEnCours === enCours) sondeEnCours = null;
  }
}

async function sondeParDefaut(): Promise<unknown> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('adresse Supabase absente');
  let minuterieDelai: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterieDelai = setTimeout(() => rejeter(new Error('délai de sonde dépassé')), DELAI_SONDE_MS);
  });
  try {
    // `fetch` n'accepte pas d'annulation ici : la minuterie borne l'attente et est toujours nettoyée.
    return await Promise.race([fetch(`${base.replace(/\/+$/, '')}/auth/v1/health`, { method: 'HEAD' }), delai]);
  } finally {
    clearTimeout(minuterieDelai);
  }
}

/** Sonde immédiate, sans doublon si une sonde est déjà en vol. */
export function sonderSiBesoin(): void {
  if (sondeEnCours) return;
  void sonder().catch(() => {});
}

function demarrerMinuterie() {
  if (minuterie) return;
  minuterie = setInterval(() => sonderSiBesoin(), PERIODE_SONDE_MS);
}

function arreterMinuterie() {
  if (!minuterie) return;
  clearInterval(minuterie);
  minuterie = null;
}

/**
 * Démarre l'observation : sonde initiale, puis sondage périodique **au premier plan uniquement** (au retour dans
 * l'app, on sonde tout de suite ; en arrière-plan on s'arrête, pour ne pas consommer de batterie ni de données).
 * Renvoie la fonction d'arrêt.
 *
 * `sonderAuDemarrage` à false laisse l'appelant piloter la première sonde : un test mesure ainsi ses propres sondes.
 */
export function demarrerConnectivite({ sonderAuDemarrage = true }: { sonderAuDemarrage?: boolean } = {}): () => void {
  if (arret) return arret;

  const app = AppState.addEventListener('change', (statut) => {
    if (statut === 'active') {
      sonderSiBesoin();
      demarrerMinuterie();
    } else {
      arreterMinuterie();
    }
  });

  // On sonde sauf si l'app est explicitement en arrière-plan. Comparer à 'active' serait trop strict :
  // `AppState.currentState` vaut `undefined` au tout premier rendu (et sous Jest), et l'app est alors au premier plan.
  if (AppState.currentState !== 'background') demarrerMinuterie();
  if (sonderAuDemarrage) sonderSiBesoin();

  arret = () => {
    app.remove();
    arreterMinuterie();
    arret = null;
  };
  return arret;
}

/** Plateforme web : utile aux écrans qui adaptent leur message. */
export const estWeb = Platform.OS === 'web';
