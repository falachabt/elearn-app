import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';

import { assainir } from './confidentialite';
import { lireConnectivite } from './connectivite';
import type { Evenements, NomEvenement } from './evenements';

// Projet PostHog d'Elearn (région US), comme l'ancienne app.
const HOTE_PAR_DEFAUT = 'https://us.i.posthog.com';

export const CLE_CONSENTEMENT = 'analytics.consentement';
export const CLE_IDENTITE = 'analytics.identite';

type Stockage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };
type Config = { cle?: string; hote?: string; stockage?: Stockage; reessais?: { nombre: number; delaiMs: number } };
export type Propriete = string | number | boolean | null;
export type MethodeConnexion = 'email' | 'google' | 'apple' | 'facebook';
export type ProprietesIdentification = {
  invite: boolean;
  email?: string | null;
  methode?: MethodeConnexion | string | null;
};
type Identite = { id: string; invite: boolean; email?: string | null; methode?: MethodeConnexion | null };

const METHODES_CONNEXION: ReadonlySet<string> = new Set(['email', 'google', 'apple', 'facebook']);
const EMAIL_IDENTIFICATION = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalise un fournisseur Supabase vers les seules méthodes suivies par l'application. */
export function normaliserMethodeConnexion(fournisseur: unknown): MethodeConnexion | null {
  if (typeof fournisseur !== 'string') return null;
  const methode = fournisseur.trim().toLowerCase();
  return METHODES_CONNEXION.has(methode) ? (methode as MethodeConnexion) : null;
}

function normaliserEmailIdentification(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const nettoye = email.trim();
  return EMAIL_IDENTIFICATION.test(nettoye) ? nettoye : null;
}

let client: PostHog | null = null;
let initialise = false;
let consentement = true;
let ecranCourant: string | null = null;
let identite: Identite | null = null;
let proprietesEnvoyees: Record<string, Propriete> = {};
// E-mail autorisé pour le seul évènement d'identification en cours d'émission (voir le garde-fou avant envoi).
let emailIdentifyAutorise: string | null = null;
// Évènements demandés avant que le consentement et l'identité mémorisés soient lus (quelques millisecondes au démarrage).
let enAttente: (() => void)[] = [];
let pret: Promise<void> = Promise.resolve();
let pretResolu = false;

function configDepuisEnv(): Config {
  // Accès statiques obligatoires : Expo remplace EXPO_PUBLIC_* au build.
  // EAS fournit EXPO_PUBLIC_POSTHOG_API_KEY (nom hérité de l'ancienne app) ; EXPO_PUBLIC_POSTHOG_KEY reste accepté.
  return { cle: process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.EXPO_PUBLIC_POSTHOG_KEY, hote: process.env.EXPO_PUBLIC_POSTHOG_HOST };
}

type EvenementPostHog = {
  event?: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

function lireSetEvenement(evenement: EvenementPostHog): Record<string, unknown> | undefined {
  if (evenement.$set && typeof evenement.$set === 'object') return evenement.$set;
  const set = evenement.properties?.$set;
  return set && typeof set === 'object' && !Array.isArray(set) ? (set as Record<string, unknown>) : undefined;
}

/**
 * Consomme l'autorisation ponctuelle posée par `identifier()` : seul l'évènement `$identify` ou `$set` émis pendant
 * cet appel peut conserver, dans son `$set`, l'e-mail exact de la session. Tout autre e-mail reste supprimé.
 */
function prendreEmailIdentifyAutorise(evenement: EvenementPostHog): string | null {
  if (!emailIdentifyAutorise) return null;
  if (evenement.event !== '$identify' && evenement.event !== '$set') return null;
  if (lireSetEvenement(evenement)?.email !== emailIdentifyAutorise) return null;
  const email = emailIdentifyAutorise;
  emailIdentifyAutorise = null;
  return email;
}

/**
 * Initialise PostHog une seule fois. Sans clé : analytics désactivé, sans erreur.
 *
 * Hors ligne : le SDK range chaque évènement dans une file persistée (stockage de l'app, donc elle survit à un
 * redémarrage), avec son identifiant unique et son horodatage d'origine, puis la vide par lots dès que le réseau
 * répond. L'identifiant unique évite tout doublon à la réception. Les réglages ci-dessous bornent la file.
 */
export function initAnalytics(config: Config = configDepuisEnv()): boolean {
  if (initialise) return client !== null;
  initialise = true;
  const cle = config.cle?.trim();
  if (!cle) return false;
  try {
    client = new PostHog(cle, {
      host: config.hote?.trim() || HOTE_PAR_DEFAUT,
      flushAt: 10,
      flushInterval: 20000,
      maxBatchSize: 50,
      maxQueueSize: 2000,
      fetchRetryCount: config.reessais?.nombre ?? 3,
      fetchRetryDelay: config.reessais?.delaiMs ?? 3000,
      captureAppLifecycleEvents: true,
      enablePersistSessionIdAcrossRestart: false,
      preloadFeatureFlags: false,
      logs: { serviceName: 'elearn-app', environment: process.env.NODE_ENV === 'production' ? 'production' : 'development' },
      disableSurveys: true,
      ...(config.stockage ? { customStorage: config.stockage } : {}),
      // Exceptions JavaScript non gérées et refus de promesse. Pas de capture de `console.error` : le SDK y écrit ses propres
      // échecs d'envoi hors ligne, ce qui ferait grossir la file d'une exception à chaque tentative.
      errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: false } },
      // Dernier garde-fou : contexte commun à tous les évènements, puis nettoyage des données personnelles.
      // Seule exception, décidée le 12/11/2026 : l'e-mail posé par `identifier()` dans le `$set` de son propre
      // évènement. Le `$set` de premier niveau est nettoyé comme les propriétés pour fermer tout autre passage.
      before_send: (evenement) => {
        if (!evenement) return null;
        const brut = evenement as EvenementPostHog;
        const reseau = lireConnectivite();
        const emailAutorise = prendreEmailIdentifyAutorise(brut);
        const proprietes = assainir(brut.properties ?? {});
        if (brut.$set) brut.$set = assainir(brut.$set);
        if (brut.$set_once) brut.$set_once = assainir(brut.$set_once);
        if (emailAutorise) {
          const set = { ...((proprietes.$set as Record<string, unknown> | undefined) ?? {}), email: emailAutorise };
          proprietes.$set = set;
          brut.$set = set;
        }
        evenement.properties = {
          ...proprietes,
          ecran: ecranCourant,
          hors_ligne: !reseau.connecte || reseau.backend === false,
        };
        return evenement;
      },
    });
  } catch (e) {
    console.warn('Analytics désactivé (initialisation impossible).', e);
    client = null;
    return false;
  }
  pretResolu = false;
  pret = chargerEtatMemorise(config.stockage ?? AsyncStorage).then(() => {
    pretResolu = true;
    const taches = enAttente;
    enAttente = [];
    if (consentement) taches.forEach((t) => t());
  });
  return true;
}

async function chargerEtatMemorise(stockage: Stockage) {
  try {
    consentement = (await stockage.getItem(CLE_CONSENTEMENT)) !== '0';
    const brut = await stockage.getItem(CLE_IDENTITE);
    if (brut && !identite) identite = JSON.parse(brut) as Identite;
  } catch {
    // Illisible : consentement par défaut, identité inconnue.
  }
  if (!consentement) await client?.optOut().catch(() => {});
}

export const analyticsActif = () => client !== null;

/** Prévient quand les drapeaux PostHog sont (re)chargés. Renvoie la fonction d'arrêt. */
export function ecouterDrapeaux(rappel: () => void): () => void {
  try {
    const arret = client?.onFeatureFlags(() => rappel());
    return typeof arret === 'function' ? arret : () => {};
  } catch {
    return () => {};
  }
}

/**
 * Drapeau de fonctionnalité PostHog (R-09). Faux tant que PostHog n'a pas répondu : une fonction derrière un drapeau
 * reste fermée plutôt que d'apparaître par erreur. `forcer` permet un essai local (variable d'environnement).
 */
export function drapeauActif(nom: string, forcer = false): boolean {
  if (forcer) return true;
  try {
    return client?.isFeatureEnabled(nom) === true;
  } catch {
    return false;
  }
}
export const consentementActif = () => consentement;

/** Exécute maintenant, ou dès que l'état mémorisé est lu. */
function quandPret(tache: () => void) {
  if (!client) return;
  if (pretResolu) {
    if (consentement) tache();
    return;
  }
  if (enAttente.length < 200) enAttente.push(tache);
}

function proteger(tache: () => void) {
  try {
    tache();
  } catch {
    // L'analytics ne doit jamais casser l'app.
  }
}

/** Suit un événement typé. Ne lève jamais d'exception. */
export function suivre<E extends NomEvenement>(evenement: E, proprietes: Evenements[E]): void {
  quandPret(() => proteger(() => client?.capture(evenement, proprietes as Record<string, never>)));
}

/** Écran affiché : nom de la route sans paramètres (jamais d'identifiant ni de saisie). */
export function suivreEcran(nom: string, precedent?: string | null): void {
  ecranCourant = nom;
  quandPret(() => proteger(() => void client?.screen(nom, { precedent: precedent ?? null })));
}

export const lireEcranCourant = () => ecranCourant;

/** Exception gérée ou attrapée par une frontière d'erreur, avec son contexte (écran, version, plateforme). */
export function suivreException(erreur: unknown, contexte: Record<string, Propriete> = {}): void {
  quandPret(() => proteger(() => client?.captureException(erreur, contexte)));
}

async function ecrire(cle: string, valeur: string | null) {
  try {
    if (valeur === null) await AsyncStorage.removeItem(cle);
    else await AsyncStorage.setItem(cle, valeur);
  } catch {
    // Au pire, l'état se reconstruit au prochain lancement.
  }
}

/**
 * Lie les événements à l'identifiant du compte (invité compris : un invité est un utilisateur anonyme du serveur).
 * Quand un invité devient un autre utilisateur (connexion Apple, Google, ancien compte), son historique est rattaché au
 * compte par un alias : un seul profil, avec tout le parcours d'avant la connexion.
 *
 * Décision produit du 12/11/2026 : pour un compte, l'e-mail de la session Supabase et la méthode de connexion sont
 * aussi posés comme propriétés de la personne, afin de pouvoir la retrouver dans PostHog. L'e-mail ne transite que
 * par cette identification explicite : l'autorisation ponctuelle ci-dessous ne vaut que pour l'évènement émis par
 * cet appel, et le garde-fou continue de le retirer de tous les évènements et autres propriétés.
 */
export async function identifier(idUtilisateur: string, proprietes: ProprietesIdentification): Promise<void> {
  if (!client) return;
  await pret;
  if (!consentement) return;
  const email = normaliserEmailIdentification(proprietes.email);
  const methode = normaliserMethodeConnexion(proprietes.methode);
  const precedent = identite;
  if (
    precedent &&
    precedent.id === idUtilisateur &&
    precedent.invite === proprietes.invite &&
    (precedent.email ?? null) === email &&
    (precedent.methode ?? null) === methode
  ) {
    return;
  }
  proteger(() => {
    const aIdentifier: Record<string, Propriete> = { invite: proprietes.invite };
    if (email) aIdentifier.email = email;
    if (methode) aIdentifier.methode_connexion = methode;
    emailIdentifyAutorise = email;
    try {
      client?.identify(idUtilisateur, aIdentifier);
    } finally {
      emailIdentifyAutorise = null;
    }
    if (precedent && precedent.id !== idUtilisateur && precedent.invite && !proprietes.invite) client?.alias(precedent.id);
  });
  identite = {
    id: idUtilisateur,
    invite: proprietes.invite,
    ...(email ? { email } : {}),
    ...(methode ? { methode } : {}),
  };
  proprietesEnvoyees = {};
  await ecrire(CLE_IDENTITE, JSON.stringify(identite));
}

/** Déconnexion : envoie ce qui reste, puis repart d'un visiteur anonyme (le prochain invité sera identifié à son tour). */
export async function reinitialiserIdentite(): Promise<void> {
  if (!client) return;
  await pret;
  // Hors ligne, l'envoi peut traîner : on n'attend pas plus de 1,5 s avant de laisser la déconnexion se terminer.
  await Promise.race([vider(), new Promise((r) => setTimeout(r, 1500))]);
  proteger(() => client?.reset());
  // `reset` efface aussi le refus : on le reprend.
  if (!consentement) await client.optOut().catch(() => {});
  identite = null;
  proprietesEnvoyees = {};
  await ecrire(CLE_IDENTITE, null);
}

/** Propriétés de la personne (classe, statut, langue, pays...) : seules celles qui ont changé sont renvoyées. */
export function definirProprietesUtilisateur(proprietes: Record<string, Propriete>): void {
  quandPret(() =>
    proteger(() => {
      const nettoyees = assainir(proprietes);
      const changees = Object.fromEntries(Object.entries(nettoyees).filter(([cle, v]) => proprietesEnvoyees[cle] !== v));
      if (Object.keys(changees).length === 0) return;
      proprietesEnvoyees = { ...proprietesEnvoyees, ...changees };
      client?.setPersonProperties(changees);
    }),
  );
}

/** Propriétés ajoutées à tous les évènements suivants (version, plateforme, langue). */
export function definirProprietesGlobales(proprietes: Record<string, Propriete>): void {
  quandPret(() => proteger(() => void client?.register(assainir(proprietes))));
}

/** Envoie sans attendre la file en cours (retour du réseau, passage en arrière-plan, déconnexion). */
export async function vider(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch {
    // Reste dans la file, repartira au prochain essai.
  }
}

/**
 * Consentement de l'élève (Paramètres). Refus : le refus est annoncé et envoyé une dernière fois, puis plus rien ne part ;
 * ce qui n'a pas pu être envoyé hors ligne est abandonné. Accord : le suivi reprend.
 */
export async function definirConsentement(actif: boolean): Promise<void> {
  const avant = consentement;
  await ecrire(CLE_CONSENTEMENT, actif ? '1' : '0');
  if (!client) {
    consentement = actif;
    return;
  }
  try {
    if (actif) {
      consentement = true;
      await client.optIn();
      if (!avant) client.capture('analytics_consent_changed', { actif: true });
    } else {
      if (avant) {
        client.capture('analytics_consent_changed', { actif: false });
        await vider();
      }
      consentement = false;
      enAttente = [];
      await client.optOut();
    }
  } catch {
    // ignoré
  }
}

/** Pour les tests uniquement. */
export function reinitialiserAnalyticsPourTests() {
  client = null;
  initialise = false;
  consentement = true;
  ecranCourant = null;
  identite = null;
  proprietesEnvoyees = {};
  emailIdentifyAutorise = null;
  enAttente = [];
  pret = Promise.resolve();
  pretResolu = false;
}

/** Pour les tests uniquement : arrête les minuteries du SDK pour que Jest puisse se terminer. */
export async function arreterAnalyticsPourTests() {
  try {
    await client?.shutdown(200);
  } catch {
    // ignoré
  }
  reinitialiserAnalyticsPourTests();
}

/** Pour les tests uniquement : attend la fin de la lecture de l'état mémorisé. */
export const attendreAnalyticsPret = () => pret;

/** Journal structuré PostHog (Logs) : diagnostic des échecs de connexion. N'échoue jamais, ne bloque jamais. */
export function journaliserErreur(message: string, attributs: Record<string, Propriete> = {}): void {
  try {
    const l = (client as unknown as { logger?: { error?: (m: string, a?: Record<string, unknown>) => void } } | null)?.logger;
    l?.error?.(message, assainir(attributs));
  } catch {
    /* le diagnostic ne doit jamais casser la connexion */
  }
}
