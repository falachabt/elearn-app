import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { lireAcces, type Acces, type CodeOffre } from './pass';
import { joursAvant } from './quand';

/**
 * Feuille « recharger le Pass » (issue #124) : présentée au toucher d'une notification `pass_ending` et, sans
 * toucher, à la prochaine ouverture de l'app. Le pilote est l'**état du Pass** (accès en cours, dernière fin
 * connue), jamais le statut lu de la notification : « tout lire » dans la cloche ne doit pas éteindre le rappel.
 *
 * Règle : la feuille entre en scène à J-3 (les alertes J-8/J-5 restent de simples notifications ; le toucher, lui,
 * ouvre la feuille quel que soit le jour). Première ouverture dans la fenêtre, puis au plus **une fois par jour**
 * tant que le Pass n'est pas rechargé. Le drapeau est clé par la **date de fin** : un rechargement donne une
 * nouvelle fin, donc un nouveau cycle. Il n'est posé qu'à l'**affichage effectif**, jamais à la simple détection.
 * Ce ne sont pas des clés de contenu : aucune expiration hors ligne (§16 bis de l'AGENTS).
 */

/** Fenêtre d'entrée de la feuille automatique : jours avant la fin, inclus (alignée sur l'alerte J-3). */
export const FENETRE_RECHARGE_JOURS = 3;

export const CLE_DERNIERE_FIN = 'pass.recharge.derniereFin';
const cleDerniereFin = (utilisateur: string) => `${CLE_DERNIERE_FIN}.${utilisateur}`;
/** Clé du drapeau d'affichage d'un cycle : la date de fin du Pass concerné. */
export const cleAffichee = (fin: string) => `pass.recharge.affichee.${fin}`;

export type FinConnue = { fin: string; offre: CodeOffre | null };

export type SituationPass =
  | { genre: 'actif'; offre: CodeOffre | null; fin: string; jours: number }
  | { genre: 'expire'; offre: CodeOffre | null; fin: string }
  | { genre: 'aucun' };

type Client = Pick<SupabaseClient, 'from' | 'rpc'>;

/**
 * Situation du Pass : accès actif (avec ses jours restants) ; sinon « expiré » si la dernière fin connue de
 * l'élève est dépassée (patron `BienvenuePass`, symétrique : on sait qu'il avait un Pass, il ne l'a plus) ;
 * sinon rien (gratuit de toujours, ou fin connue encore à venir sans accès lisible : on ne devine pas).
 */
export function situationPass(acces: Acces, derniereFin: FinConnue | null, maintenant = new Date()): SituationPass {
  if (acces) return { genre: 'actif', offre: acces.offre, fin: acces.fin, jours: joursAvant(acces.fin, maintenant) };
  if (derniereFin && new Date(derniereFin.fin).getTime() <= maintenant.getTime()) {
    return { genre: 'expire', offre: derniereFin.offre, fin: derniereFin.fin };
  }
  return { genre: 'aucun' };
}

/** La feuille automatique entre en scène : Pass actif dans la fenêtre J-3, ou Pass expiré. */
export function dansFenetre(s: SituationPass): boolean {
  return s.genre === 'expire' || (s.genre === 'actif' && s.jours <= FENETRE_RECHARGE_JOURS);
}

/** Urgence : la feuille passe avant le récap « Ma semaine » (veille, dernier jour, ou déjà expiré). */
export function estUrgente(s: SituationPass): boolean {
  return s.genre === 'expire' || (s.genre === 'actif' && s.jours <= 1);
}

const memeJour = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Faut-il présenter la feuille à cette ouverture ? Dans la fenêtre, et pas déjà montrée aujourd'hui pour cette
 * date de fin (« Plus tard » la réarme donc pour le lendemain, jamais pour la même journée).
 */
export function doitPresenter(s: SituationPass, derniereAfficheeLe: string | null, maintenant = new Date()): boolean {
  if (!dansFenetre(s)) return false;
  if (!derniereAfficheeLe) return true;
  const d = new Date(derniereAfficheeLe);
  return Number.isNaN(d.getTime()) || !memeJour(d, maintenant);
}

// --- Dernière fin connue (par élève : un appareil peut changer de compte) ---------------------------------------

export async function lireDerniereFinConnue(utilisateur: string): Promise<FinConnue | null> {
  try {
    const brut = await AsyncStorage.getItem(cleDerniereFin(utilisateur));
    if (!brut) return null;
    const o = JSON.parse(brut) as Partial<FinConnue>;
    if (typeof o.fin !== 'string' || !o.fin) return null;
    return { fin: o.fin, offre: o.offre === 'week' || o.offre === 'month' || o.offre === 'contest' ? o.offre : null };
  } catch {
    return null;
  }
}

/** Retient la fin du Pass actif : c'est elle qui permettra de reconnaître l'état « expiré » ensuite. */
export const noterFinConnue = (utilisateur: string, fin: FinConnue) =>
  AsyncStorage.setItem(cleDerniereFin(utilisateur), JSON.stringify(fin)).catch(() => {});

// --- Drapeau d'affichage (posé uniquement quand la feuille est effectivement montrée) ---------------------------

export async function lireDerniereAffichee(fin: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(cleAffichee(fin));
  } catch {
    return null;
  }
}

export const noterAffichee = (fin: string, maintenant = new Date()) =>
  AsyncStorage.setItem(cleAffichee(fin), maintenant.toISOString()).catch(() => {});

/** Situation complète : accès frais du serveur, repli sur la dernière fin connue pour l'état expiré. */
export async function lireSituation(client: Client, utilisateur: string): Promise<SituationPass> {
  const acces = await lireAcces(client).catch(() => null);
  if (acces) {
    void noterFinConnue(utilisateur, { fin: acces.fin, offre: acces.offre });
    return situationPass(acces, null);
  }
  return situationPass(null, await lireDerniereFinConnue(utilisateur));
}

/**
 * Le récap « Ma semaine » demande avant de s'ouvrir tout seul : une feuille de recharge **urgente** et due à
 * cette ouverture passe avant lui (il s'ouvrira à la suivante, la feuille étant bornée à une fois par jour).
 */
export async function feuilleRechargePrioritaire(client: Client, utilisateur: string): Promise<boolean> {
  const situation = await lireSituation(client, utilisateur);
  if (!estUrgente(situation) || situation.genre === 'aucun') return false;
  return doitPresenter(situation, await lireDerniereAffichee(situation.fin));
}

// --- Demande d'ouverture au toucher d'une notification -----------------------------------------------------------

export type DemandeFeuilleRecharge = { joursRestants?: number | null };

type EcouteurDemande = (d: DemandeFeuilleRecharge) => void;
const ecouteurs = new Set<EcouteurDemande>();

/** La feuille montée à la racine s'abonne ici ; renvoie la fonction d'arrêt. */
export function sAbonnerFeuilleRecharge(cb: EcouteurDemande): () => void {
  ecouteurs.add(cb);
  return () => {
    ecouteurs.delete(cb);
  };
}

/**
 * Demande l'ouverture de la feuille (toucher d'un push ou d'une ligne de la cloche). Renvoie false si la feuille
 * n'est montée nulle part : l'appelant retombe alors sur la navigation `destinationDe` (les offres).
 */
export function demanderFeuilleRecharge(demande: DemandeFeuilleRecharge = {}): boolean {
  if (ecouteurs.size === 0) return false;
  ecouteurs.forEach((cb) => cb(demande));
  return true;
}

// --- Coordination avec le récap « Ma semaine » (mémoire de session, pas de stockage) ------------------------------
// Quand le récap s'est ouvert tout seul à l'ouverture en cours, la feuille non urgente attend l'ouverture
// suivante : le composant compare ce compteur à celui de son montage et à chaque reprise.

let recapsAutoPresentes = 0;

export const noterRecapAutoPresente = () => {
  recapsAutoPresentes += 1;
};

export const nombreRecapsAutoPresentes = () => recapsAutoPresentes;
