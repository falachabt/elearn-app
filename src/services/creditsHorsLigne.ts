import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { estEnLigne, estErreurReseau } from './connectivite';
import type { ActionCredit, Depense, Solde, StatutDepense } from './credits';

/**
 * Crédits hors ligne (issue #13, partie « Crédits en ligne et hors ligne »).
 *
 * Principe : le serveur reste la seule autorité. `depenser_credits` ne renvoie pas seulement un débit, il renvoie
 * **le contenu** — sans réseau, il n'y a donc rien à afficher. Une dépense hors ligne n'est possible que si ce
 * contenu est déjà présent sur l'appareil (débloqué lors d'une session précédente et mis en cache). Dans ce cas :
 *
 * 1. on débite le **dernier solde confirmé** gardé sur l'appareil ;
 * 2. on enregistre l'opération dans une file, rejouée à la reconnexion ;
 * 3. le serveur ne renvoie `spent` que si le contenu n'était pas déjà débloqué, et `already` sinon : le rejeu ne
 *    peut donc pas débiter deux fois.
 *
 * Rien n'est présenté comme confirmé par le serveur : `confirme` reste faux tant que la file n'a pas été vidée.
 */

/** Clés de stockage : le solde local est rangé par utilisateur (jamais celui d'un autre compte). */
export const CLE_SOLDE_LOCAL = 'credits.soldeLocal';
export const CLE_DEPENSES_EN_ATTENTE = 'credits.depensesEnAttente';

export type SoldeLocal = {
  /** Propriétaire du solde : un changement de compte invalide la copie locale. */
  pour: string;
  solde: Solde;
  /** Faux tant que des dépenses attendent d'être confirmées par le serveur. */
  confirme: boolean;
  /** Date ISO du dernier solde reçu du serveur. */
  recuLe: string;
};

export type OperationHorsLigne = {
  /** Identifiant local de l'opération, pour ne jamais la rejouer deux fois. */
  id: string;
  action: ActionCredit;
  /** Référence du contenu (identifiant d'exercice, de document…). */
  objet: string;
  /** Coût connu au moment de la dépense. */
  cout: number;
  /** Date ISO de la dépense hors ligne. */
  le: string;
};

/** Préfixe des contenus conservés sur l'appareil après un déblocage. */
export const PREFIXE_CACHE = 'credits.contenu.';

/** Clé de cache d'un contenu débloqué. */
export function cleCache(action: ActionCredit, objet: string | number): string {
  return `${PREFIXE_CACHE}${action}.${String(objet)}`;
}

/** Contenu débloqué conservé localement, avec sa date de mise en cache. */
export async function enregistrerContenuEnCache<C>(action: ActionCredit, objet: string | number, contenu: C, maintenant = new Date()): Promise<void> {
  await AsyncStorage.setItem(cleCache(action, objet), JSON.stringify({ contenu, le: maintenant.toISOString() })).catch(() => {});
}

/** Contenu déjà présent sur l'appareil, ou null. C'est ce qui autorise une dépense hors ligne. */
export async function lireContenuEnCache<C>(action: ActionCredit, objet: string | number): Promise<C | null> {
  try {
    const brut = await AsyncStorage.getItem(cleCache(action, objet));
    if (!brut) return null;
    const enveloppe = JSON.parse(brut) as { contenu?: C };
    return enveloppe?.contenu ?? null;
  } catch {
    return null;
  }
}

/** Retire un contenu du cache (espace à libérer, contenu remplacé). */
export async function oublierContenuEnCache(action: ActionCredit, objet: string | number): Promise<void> {
  await AsyncStorage.removeItem(cleCache(action, objet)).catch(() => {});
}

/** Solde local gardé pour ce compte, ou null. */
export async function lireSoldeLocal(pour: string): Promise<SoldeLocal | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_SOLDE_LOCAL);
    if (!brut) return null;
    const garde = JSON.parse(brut) as SoldeLocal;
    return garde?.pour === pour && garde.solde ? garde : null;
  } catch {
    return null;
  }
}

/**
 * Garde le solde reçu du serveur. `confirme` est faux dès qu'une dépense attend : un solde local ne doit jamais
 * être présenté comme confirmé par le serveur.
 */
export async function garderSoldeLocal(pour: string, solde: Solde, maintenant = new Date()): Promise<SoldeLocal> {
  const enAttente = await lireDepensesEnAttente(pour);
  const garde: SoldeLocal = { pour, solde, confirme: enAttente.length === 0, recuLe: maintenant.toISOString() };
  await AsyncStorage.setItem(CLE_SOLDE_LOCAL, JSON.stringify(garde)).catch(() => {});
  return garde;
}

const CLE_FILE = (pour: string) => `${CLE_DEPENSES_EN_ATTENTE}.${pour}`;

/** Opérations hors ligne en attente de confirmation, dans l'ordre où elles ont eu lieu. */
export async function lireDepensesEnAttente(pour: string): Promise<OperationHorsLigne[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_FILE(pour));
    if (!brut) return [];
    const liste = JSON.parse(brut) as OperationHorsLigne[];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

async function ecrireDepensesEnAttente(pour: string, operations: OperationHorsLigne[]): Promise<void> {
  if (!operations.length) {
    await AsyncStorage.removeItem(CLE_FILE(pour)).catch(() => {});
    return;
  }
  await AsyncStorage.setItem(CLE_FILE(pour), JSON.stringify(operations)).catch(() => {});
}

/** Ajoute une opération à la file. Un même contenu n'y est jamais deux fois : la seconde dépense serait un doublon. */
export async function ajouterDepenseEnAttente(pour: string, operation: OperationHorsLigne): Promise<OperationHorsLigne[]> {
  const operations = await lireDepensesEnAttente(pour);
  if (operations.some((o) => o.action === operation.action && o.objet === operation.objet)) return operations;
  const suivantes = [...operations, operation];
  await ecrireDepensesEnAttente(pour, suivantes);
  return suivantes;
}

/** Retire de la file les opérations confirmées par le serveur (ou définitivement refusées). */
export async function retirerDepensesEnAttente(pour: string, ids: readonly string[]): Promise<OperationHorsLigne[]> {
  const retirees = new Set(ids);
  const restantes = (await lireDepensesEnAttente(pour)).filter((o) => !retirees.has(o.id));
  await ecrireDepensesEnAttente(pour, restantes);
  return restantes;
}

/** Nombre d'opérations qui attendent d'être confirmées par le serveur : le solde affiché n'est alors pas confirmé. */
export async function compterDepensesEnAttente(pour: string): Promise<number> {
  return (await lireDepensesEnAttente(pour)).length;
}

/** Identifiant d'une opération : stable, pour qu'un rejeu ne crée pas de doublon. */
export function identifiantOperation(action: ActionCredit, objet: string | number, maintenant = Date.now()): string {
  return `${action}:${String(objet)}:${maintenant}`;
}

export type ResultatDepenseHorsLigne = {
  /** Statut à présenter à l'écran, aligné sur ceux du parcours en ligne. */
  statut: StatutDepense;
  cout: number;
  /** Solde local après débit, ou solde connu si la dépense est refusée. */
  solde: number;
  /** Contenu à afficher (celui du cache) ; null si la dépense n'a pas eu lieu. */
  contenu: unknown | null;
  /** Vrai quand la dépense a été enregistrée pour être rejouée à la reconnexion. */
  enAttente: boolean;
};

/**
 * Décide d'une dépense hors ligne. Fonction pure : tout ce qui vient du stockage est passé en argument, pour que la
 * règle soit testable sans appareil.
 *
 * - contenu absent du cache : impossible, l'écran proposera de réessayer au retour du réseau (`contenu` null) ;
 * - solde connu insuffisant : même refus qu'en ligne (`insufficient`) ;
 * - sinon : débit local et opération à rejouer (`spent`, `enAttente` vrai).
 */
export function deciderDepenseHorsLigne(p: {
  solde: number;
  cout: number;
  contenuEnCache: unknown | null;
  illimite?: boolean;
}): ResultatDepenseHorsLigne {
  if (p.illimite) {
    return { statut: 'unlimited', cout: 0, solde: p.solde, contenu: p.contenuEnCache, enAttente: false };
  }
  if (p.contenuEnCache === null || p.contenuEnCache === undefined) {
    return { statut: 'insufficient', cout: p.cout, solde: p.solde, contenu: null, enAttente: false };
  }
  if (p.solde < p.cout) {
    return { statut: 'insufficient', cout: p.cout, solde: p.solde, contenu: null, enAttente: false };
  }
  return { statut: 'spent', cout: p.cout, solde: p.solde - p.cout, contenu: p.contenuEnCache, enAttente: true };
}

/** Solde local après une opération, sans toucher à ses autres champs. */
export function soldeDebite(solde: Solde, montant: number): Solde {
  return { ...solde, total: Math.max(0, solde.total - montant) };
}

/** Résultat d'une opération rejouée, tel que le serveur l'a renvoyé. */
export type ResultatRejeu = { id: string; statut: StatutDepense; solde: number; confirme: boolean };

/**
 * Classe les opérations rejouées : une opération confirmée est retirée de la file, une opération en échec réseau y
 * reste pour un prochain essai. `confirme` ne passe à vrai que si toutes ont été confirmées.
 */
export function repartirRejeu(resultats: readonly ResultatRejeu[]): { confirmees: string[]; restantes: number; confirme: boolean } {
  const confirmees = resultats.filter((r) => r.confirme).map((r) => r.id);
  const restantes = resultats.length - confirmees.length;
  return { confirmees, restantes, confirme: restantes === 0 };
}

/** Dépense hors ligne à présenter à l'écran, au format du parcours en ligne. */
export function versDepense<C>(resultat: ResultatDepenseHorsLigne): Depense<C> {
  return { statut: resultat.statut, cout: resultat.cout, solde: resultat.solde, contenu: resultat.contenu as C | null };
}

/** Une action serveur est impossible hors ligne et le contenu n'est pas sur l'appareil : l'écran propose de réessayer. */
export class ContenuIndisponibleHorsLigne extends Error {
  constructor(action: ActionCredit) {
    super(`contenu indisponible hors ligne : ${action}`);
    this.name = 'ContenuIndisponibleHorsLigne';
  }
}

type ClientCredits = Pick<SupabaseClient, 'rpc'>;
type ReponseDepense<C> = { status: StatutDepense; cost: number; balance: number; content: C | null };

/**
 * Dépense une action payante en tenant compte du hors ligne (issue #13).
 *
 * En ligne : dépense serveur, et le contenu renvoyé est **conservé localement** pour pouvoir être dépensé plus tard
 * sans réseau. Hors ligne : si le contenu est déjà sur l'appareil, on débite le dernier solde confirmé et on
 * enregistre l'opération pour le rejeu ; sinon on refuse explicitement (`ContenuIndisponibleHorsLigne`).
 *
 * `cout` vient des coûts déjà chargés : hors ligne, le serveur ne peut pas les donner.
 */
export async function depenserAvecRepli<C = Record<string, unknown>>(p: {
  client: ClientCredits;
  utilisateur: string;
  soldeLocal: Solde | null;
  cout: number;
  action: ActionCredit;
  objet: string | number;
  illimite?: boolean;
  maintenant?: number;
}): Promise<Depense<C>> {
  const { client, utilisateur, action, objet, cout } = p;
  const maintenant = p.maintenant ?? Date.now();

  if (!estEnLigne()) return depenserHorsLigne<C>(p);

  try {
    const { data, error } = await client.rpc('depenser_credits', { p_action: action, p_ref: String(objet) });
    if (error) throw error;
    const ligne = (data as ReponseDepense<C>[] | null)?.[0];
    if (!ligne) throw new Error('réponse vide');
    if (ligne.status === 'spent' || ligne.status === 'already') {
      if (ligne.content) await enregistrerContenuEnCache(action, objet, ligne.content, new Date(maintenant));
    }
    return { statut: ligne.status, cout: ligne.cost, solde: ligne.balance, contenu: ligne.content };
  } catch (erreur) {
    // La requête a pu échouer pour un autre motif qu'un problème réseau : on ne dépense pas localement à l'aveugle.
    if (!estErreurReseau(erreur)) throw erreur;
    return depenserHorsLigne<C>({ ...p, maintenant });
  }
}

/** Voie hors ligne : débite le solde local connu et met l'opération en file. */
async function depenserHorsLigne<C>(p: {
  utilisateur: string;
  soldeLocal: Solde | null;
  cout: number;
  action: ActionCredit;
  objet: string | number;
  illimite?: boolean;
  maintenant?: number;
}): Promise<Depense<C>> {
  const { utilisateur, action, objet, cout } = p;
  const maintenant = p.maintenant ?? Date.now();
  if (!p.soldeLocal) throw new ContenuIndisponibleHorsLigne(action);

  const enCache = await lireContenuEnCache<C>(action, objet);
  const decision = deciderDepenseHorsLigne({
    solde: p.soldeLocal.total,
    cout,
    contenuEnCache: enCache,
    illimite: p.illimite ?? p.soldeLocal.illimite,
  });

  if (decision.statut === 'unlimited') {
    return { statut: 'unlimited', cout: 0, solde: p.soldeLocal.total, contenu: enCache };
  }
  if (!decision.enAttente) {
    // Refus : soit le solde connu est insuffisant, soit le contenu n'est pas sur l'appareil. Le second cas est un
    // manque de réseau, pas un manque de crédits : l'écran doit pouvoir le distinguer.
    if (decision.contenu === null && enCache === null) throw new ContenuIndisponibleHorsLigne(action);
    return versDepense<C>(decision);
  }

  await ajouterDepenseEnAttente(utilisateur, {
    id: identifiantOperation(action, objet, maintenant),
    action,
    objet: String(objet),
    cout: decision.cout,
    le: new Date(maintenant).toISOString(),
  });
  await garderSoldeLocal(utilisateur, soldeDebite(p.soldeLocal, decision.cout), new Date(maintenant));
  return versDepense<C>(decision);
}

/** Résultat du rejeu d'une opération en attente. */
export type ResultatRejeuOperation = { operation: OperationHorsLigne; statut: StatutDepense; solde: number };

/**
 * Rejoue les opérations en attente, dans l'ordre, et met à jour le solde local avec le dernier solde serveur.
 *
 * Idempotence : c'est le serveur qui l'assure. Il renvoie `already` quand le contenu était déjà débloqué, donc une
 * opération rejouée après un déblocage en ligne ne débite pas une seconde fois. Une opération en échec réseau reste
 * en file et le solde reste marqué non confirmé.
 */
export async function synchroniserDepensesHorsLigne(p: { client: ClientCredits; utilisateur: string; soldeLocal: Solde | null }): Promise<{
  envoyees: number;
  restantes: number;
  confirme: boolean;
  solde: Solde | null;
}> {
  const { client, utilisateur } = p;
  let solde = p.soldeLocal;
  const operations = await lireDepensesEnAttente(utilisateur);
  if (!operations.length) {
    if (solde) await garderSoldeLocal(utilisateur, solde);
    return { envoyees: 0, restantes: 0, confirme: true, solde };
  }

  const confirmees: string[] = [];
  let echecReseau = false;

  for (const operation of operations) {
    // Après un échec réseau, inutile d'insister sur les suivantes : elles partiront au prochain essai.
    if (echecReseau) break;
    try {
      const { data, error } = await client.rpc('depenser_credits', { p_action: operation.action, p_ref: operation.objet });
      if (error) throw error;
      const ligne = (data as ReponseDepense<unknown>[] | null)?.[0];
      if (!ligne) throw new Error('réponse vide');
      // `already` signifie que le contenu était déjà débloqué : le solde renvoyé fait foi, aucun double débit.
      if (solde) {
        solde = { ...solde, total: ligne.balance };
        await garderSoldeLocal(utilisateur, solde);
      }
      await enregistrerContenuEnCache(operation.action, operation.objet, ligne.content);
      confirmees.push(operation.id);
    } catch (erreur) {
      if (!estErreurReseau(erreur)) throw erreur;
      echecReseau = true;
    }
  }

  await retirerDepensesEnAttente(utilisateur, confirmees);
  const restantes = operations.length - confirmees.length;
  if (solde) await garderSoldeLocal(utilisateur, solde);
  return { envoyees: confirmees.length, restantes, confirme: restantes === 0, solde };
}
