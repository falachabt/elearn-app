import { requireOptionalNativeModule } from 'expo-modules-core';
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
  /** Une sonde est en vol : anime l'indicateur sans mentir sur l'état connu. */
  enVerification: boolean;
  /** Dernier changement d'état connu, en ISO. */
  actualiseLe: string;
};

/** Délai au-delà duquel une sonde est considérée en échec (réseau instable : on ne bloque pas l'élève). */
export const DELAI_SONDE_MS = 4000;

/**
 * Cadence de sondage pendant une coupure : rapide au début (le retour du réseau se voit tout de suite), puis
 * dégressive. Mesuré sur le projet : une sonde coûte ~1,6 Ko (dont le handshake TLS), donc une cadence fixe de
 * quelques secondes coûterait plus de 1 Mo par heure — inacceptable sur un forfait mobile. On paie la rapidité
 * seulement pendant la première minute de coupure, et seulement si l'app est au premier plan.
 */
export const DELAIS_REESSAI_MS = [2000, 4000, 8000, 15000, 30000, 60000] as const;

/**
 * Cadence quand tout va bien, **sans évènement réseau système** (repli). Avec un binaire qui embarque
 * `expo-network`, la perte de réseau est signalée par le système en moins d'une seconde et cette cadence ne sert
 * plus que de filet de sécurité — elle reste donc lente. Voir `DEMI_TOUR_MS` pour la réaction à un évènement.
 */
export const INTERVALLE_EN_LIGNE_MS = 10000;

/**
 * Après un évènement réseau du système, on sonde tout de suite. Ce court délai laisse l'interface se stabiliser :
 * Android signale souvent « connecté » avant que la route soit réellement utilisable, et sonder trop tôt donnerait
 * un faux « hors ligne ».
 */
export const DEMI_TOUR_MS = 400;

let etat: EtatConnectivite = { connecte: true, internet: true, backend: null, enVerification: false, actualiseLe: new Date().toISOString() };
let arret: (() => void) | null = null;
let minuterie: ReturnType<typeof setTimeout> | null = null;
/** Le cycle périodique est-il actif ? Une sonde lancée à la main ne doit pas en démarrer un. */
let minuterieActif = false;
/** Index courant dans `DELAIS_REESSAI_MS` : avance à chaque échec, revient à 0 sur succès ou sur signe de vie. */
let essai = 0;
let sondeEnCours: Promise<boolean> | null = null;
let demiTour: ReturnType<typeof setTimeout> | null = null;
const ecouteurs = new Set<(e: EtatConnectivite) => void>();

type ModuleReseau = {
  /** Écouteur brut du module natif : `expo-network` le nomme `addListener` sur le module natif lui-même. */
  addListener: (nom: string, ecouteur: (e: { isConnected?: boolean; isInternetReachable?: boolean }) => void) => { remove: () => void };
};

/** Nom de l'évènement émis par le module natif `ExpoNetwork` à chaque changement d'interface. */
const EVENEMENT_RESEAU = 'onNetworkStateChanged';

/**
 * Module natif de réseau, chargé **paresseusement et sans erreur**. Il n'est pas indispensable : la sonde suffit.
 *
 * `requireOptionalNativeModule` plutôt que `requireNativeModule` : ce dernier **lève** quand le module est absent,
 * donc une OTA partie vers un binaire qui ne l'embarque pas planterait l'app au démarrage — c'est l'incident
 * `expo-network` du 5 octobre 2026. Ici, un binaire sans le module se contente du sondage périodique.
 *
 * On n'importe pas `expo-network` : son point d'entrée appelle `requireNativeModule` au chargement du module, donc
 * l'importer suffirait à faire planter un binaire qui ne l'embarque pas.
 */
function moduleReseau(): ModuleReseau | null {
  try {
    const module = requireOptionalNativeModule<ModuleReseau>('ExpoNetwork');
    return typeof module?.addListener === 'function' ? module : null;
  } catch {
    return null;
  }
}


function publier(suivant: EtatConnectivite) {
  etat = suivant;
  for (const ecouteur of ecouteurs) ecouteur(etat);
}

function maj(partiel: Partial<Omit<EtatConnectivite, 'actualiseLe'>>, maintenant = new Date()) {
  const suivant: EtatConnectivite = { ...etat, ...partiel, actualiseLe: maintenant.toISOString() };
  if (
    suivant.connecte === etat.connecte &&
    suivant.internet === etat.internet &&
    suivant.backend === etat.backend &&
    suivant.enVerification === etat.enVerification
  )
    return;
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
 * La cadence repart au plus rapide : l'utilisateur est actif, c'est le moment où il attend le retour.
 */
export function signalerEchec(maintenant = new Date()): void {
  maj({ backend: false }, maintenant);
  relancerCadence(0);
}

/** Une action serveur a répondu : le serveur est joignable, la dernière sonde en échec est périmée. */
export function signalerSucces(maintenant = new Date()): void {
  maj({ connecte: true, internet: true, backend: true }, maintenant);
  relancerCadence(0);
}

/**
 * Signe de vie de l'utilisateur (ouverture d'un écran, retour au premier plan, action lancée) : la cadence
 * repart au plus rapide. C'est ce qui permet de rester réactif sans sonder vite en permanence : on paie la
 * rapidité seulement quand quelqu'un regarde.
 */
export function signalerActivite(): void {
  relancerCadence(0);
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
 * Interroge le serveur pour savoir s'il répond vraiment. `fetchTete` est injectable pour les tests ; par défaut un
 * `GET` sur la route de santé de l'authentification, avec la clé publique : le serveur répond alors un vrai 200.
 */
export async function sonder(fetchTete?: () => Promise<unknown>, maintenant = Date.now()): Promise<boolean> {
  const appel = fetchTete ?? sondeParDefaut;
  maj({ enVerification: true }, new Date(maintenant));
  let joignable = false;
  const enCours = (async () => {
    try {
      await appel();
      joignable = true;
    } catch {
      joignable = false;
    }
    // Une sonde réussie prouve l'interface et le serveur ; une sonde ratée ne prouve que le serveur.
    maj({ internet: joignable || etat.internet, backend: joignable, enVerification: false }, new Date(maintenant));
    return joignable;
  })();
  sondeEnCours = enCours;
  try {
    return await enCours;
  } finally {
    if (sondeEnCours === enCours) sondeEnCours = null;
    // Un succès remet la cadence au plus court ; un échec laisse le compteur tel quel, c'est le réveil de la
    // minuterie qui l'avance (sinon le premier échec sauterait directement le délai le plus court).
    if (joignable) essai = 0;
    if (minuterieActif) planifierProchaineSonde();
  }
}

async function sondeParDefaut(): Promise<unknown> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('adresse Supabase absente');
  const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  let minuterieDelai: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuterieDelai = setTimeout(() => rejeter(new Error('délai de sonde dépassé')), DELAI_SONDE_MS);
  });
  try {
    // `fetch` n'accepte pas d'annulation ici : la minuterie borne l'attente et est toujours nettoyée.
    // La clé publique évite un 401 sans signification : on veut un 200, réponse explicite du serveur.
    return await Promise.race([
      fetch(`${base.replace(/\/+$/, '')}/auth/v1/health`, {
        method: 'GET',
        headers: cle ? { apikey: cle } : undefined,
      }),
      delai,
    ]);
  } finally {
    clearTimeout(minuterieDelai);
  }
}

/** Sonde immédiate, sans doublon si une sonde est déjà en vol. */
export function sonderSiBesoin(): void {
  if (sondeEnCours) return;
  void sonder().catch(() => {});
}

/** Délai courant : court pendant une coupure, long quand le serveur répond. */
function delaiCourant(): number {
  if (etat.backend !== false) return INTERVALLE_EN_LIGNE_MS;
  return DELAIS_REESSAI_MS[Math.min(essai, DELAIS_REESSAI_MS.length - 1)];
}

/**
 * (Re)planifie la prochaine sonde selon l'état connu. `setTimeout` chaîné plutôt que `setInterval` : la cadence
 * change après chaque résultat, et une sonde lente ne décale pas les suivantes.
 *
 * Seule la fin d'une sonde rappelle cette fonction (voir `sonder`) : la minuterie ne se ré-arme pas elle-même,
 * sinon deux planifications concurrentes feraient sonder deux fois par cycle.
 */
function planifierProchaineSonde() {
  if (minuterie) clearTimeout(minuterie);
  const delai = delaiCourant();
  minuterie = setTimeout(() => {
    // C'est ici qu'on avance dans la dégressivité : le délai qui vient de s'écouler est consommé.
    if (etat.backend === false) essai += 1;
    sonderSiBesoin();
  }, delai);
}

/** Repart d'une cadence rapide (signe de vie) puis replanifie. */
function relancerCadence(nouvelEssai: number) {
  essai = nouvelEssai;
  if (minuterieActif) planifierProchaineSonde();
}

function demarrerMinuterie() {
  if (minuterieActif) return;
  minuterieActif = true;
  // Une sonde est peut-être déjà en vol : son résultat armera la minuterie. Sinon on arme tout de suite.
  if (!sondeEnCours) planifierProchaineSonde();
}

function arreterMinuterie() {
  minuterieActif = false;
  if (!minuterie) return;
  clearTimeout(minuterie);
  minuterie = null;
}

/**
 * Démarre l'observation : évènements réseau du système (si le binaire embarque le module), sonde initiale, puis
 * sondage périodique **au premier plan uniquement** (au retour dans l'app, on sonde tout de suite ; en arrière-plan
 * on s'arrête, pour ne pas consommer de batterie ni de données). Renvoie la fonction d'arrêt.
 *
 * `sonderAuDemarrage` à false laisse l'appelant piloter la première sonde : un test mesure ainsi ses propres sondes.
 */
export function demarrerConnectivite({ sonderAuDemarrage = true }: { sonderAuDemarrage?: boolean } = {}): () => void {
  if (arret) return arret;

  const app = AppState.addEventListener('change', (statut) => {
    if (statut === 'active') {
      // Retour au premier plan : l'état a pu changer pendant l'absence. Cadence rapide, puis sonde immédiate.
      signalerActivite();
      sonderSiBesoin();
      demarrerMinuterie();
    } else {
      arreterMinuterie();
    }
  });

  const abonnementReseau = ecouterReseau();
  if (!abonnementReseau) {
    // Sans module natif, seul le sondage périodique peut voir la perte de réseau : c'est le repli, et il est plus lent.
    console.warn('Module réseau absent : la perte de connexion ne sera vue qu’au prochain sondage.');
  }

  // On sonde sauf si l'app est explicitement en arrière-plan. Comparer à 'active' serait trop strict :
  // `AppState.currentState` vaut `undefined` au tout premier rendu (et sous Jest), et l'app est alors au premier plan.
  //
  // L'ordre compte : la sonde d'abord, le cycle ensuite. Le résultat de cette première sonde décide de la cadence
  // (rapide si le serveur est muet), et `demarrerMinuterie` s'appuie dessus plutôt que d'armer un délai « en ligne »
  // avant de savoir.
  if (AppState.currentState !== 'background') {
    if (sonderAuDemarrage) sonderSiBesoin();
    demarrerMinuterie();
  }

  arret = () => {
    app.remove();
    abonnementReseau?.remove();
    if (demiTour) clearTimeout(demiTour);
    demiTour = null;
    arreterMinuterie();
    arret = null;
  };
  return arret;
}

/**
 * Le système signale un changement d'interface réseau : on sonde tout de suite, au lieu d'attendre le prochain
 * cycle (jusqu'à `INTERVALLE_EN_LIGNE_MS`). Renvoie `null` quand le module natif est absent.
 *
 * L'évènement ne décide **pas** de l'état : « connecté » veut seulement dire qu'une interface est active, ce qui est
 * faux avec un portail captif ou un serveur éteint. Il sert uniquement à déclencher la sonde, seule source de vérité.
 */
function ecouterReseau(): { remove: () => void } | null {
  const module = moduleReseau();
  if (!module) return null;
  try {
    return module.addListener(EVENEMENT_RESEAU, () => {
      if (demiTour) clearTimeout(demiTour);
      demiTour = setTimeout(() => {
        demiTour = null;
        // L'interface est peut-être déjà coupée : on ne sonde pas dans le vide.
        if (etat.connecte === false) return;
        signalerActivite();
        sonderSiBesoin();
      }, DEMI_TOUR_MS);
    });
  } catch {
    return null;
  }
}

/** Plateforme web : utile aux écrans qui adaptent leur message. */
export const estWeb = Platform.OS === 'web';
