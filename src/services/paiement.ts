import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import type { CodeOffre } from './pass';

type Client = Pick<SupabaseClient, 'from' | 'rpc' | 'functions'>;

/** État d'un paiement vu par l'élève. Le serveur seul décide : l'app lit (M8-03). */
export type StatutPaiement = 'en_attente' | 'reussi' | 'echoue' | 'expire';
/** Pourquoi un paiement a échoué : l'écran choisit le texte. */
export type MotifEchec = 'solde' | 'refus' | 'delai' | 'numero' | 'autre';

export type ResultatPaiement = {
  statut: StatutPaiement;
  commande: string;
  motif?: MotifEchec;
  recu?: string | null;
  /** simulation (aucun argent), sandbox (essai pawaPay) ou production. */
  mode?: 'simulation' | 'sandbox' | 'production';
  montant?: number;
  devise?: string;
  expire?: string;
};

/** Refus avant tout prélèvement. numero : saisie invalide ; operateur : opérateur indisponible ; indisponible : réessayer. */
export type CodeErreurPaiement = 'auth' | 'requete' | 'offre' | 'numero' | 'operateur' | 'indisponible';

export class ErreurPaiement extends Error {
  constructor(readonly code: CodeErreurPaiement) {
    super(`paiement: ${code}`);
  }
}

type Corps = { status?: StatutPaiement; order_id?: string; motif?: MotifEchec; receipt_no?: string | null; code?: CodeErreurPaiement;
  mode?: ResultatPaiement['mode']; amount?: number; currency?: string; expires_at?: string };

/** Corps JSON d'une réponse d'erreur de fonction (le client Supabase le cache dans error.context). */
async function corpsErreur(error: unknown): Promise<Corps | null> {
  const contexte = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  try {
    return contexte?.json ? ((await contexte.json()) as Corps) : null;
  } catch {
    return null;
  }
}

function resultat(c: Corps): ResultatPaiement {
  if (!c.status || !c.order_id) throw new ErreurPaiement('indisponible');
  return {
    statut: c.status, commande: c.order_id, motif: c.motif, recu: c.receipt_no, mode: c.mode,
    montant: c.amount, devise: c.currency, expire: c.expires_at,
  };
}

async function appeler(client: Client, fonction: string, corps: Record<string, unknown>): Promise<Corps> {
  const { data, error } = await client.functions.invoke(fonction, { body: corps });
  if (!error) return (data ?? {}) as Corps;
  const detail = await corpsErreur(error);
  if (detail?.code) throw new ErreurPaiement(detail.code);
  throw new ErreurPaiement('indisponible');
}

/**
 * Lance le paiement d'un pass (M8-02, M8-15). Le montant est fixé par le serveur selon l'offre et le pays ; l'élève
 * confirme ensuite sur son téléphone. Un deuxième appel reprend la commande en attente, sans second prélèvement.
 */
export async function payerPass(client: Client, p: { offre: CodeOffre; pays: string; telephone: string; operateur?: string }): Promise<ResultatPaiement> {
  const r = resultat(await appeler(client, 'payment-start', { product: p.offre, country: p.pays, phone: p.telephone, operateur: p.operateur }));
  suivre('payment_initiated', { offre: p.offre, pays: p.pays, mode: r.mode });
  return r;
}

/** État d'une commande ; le serveur relit le dépôt chez pawaPay si elle est encore en attente (M8-05). */
export async function lireStatutPaiement(client: Client, commande: string): Promise<ResultatPaiement> {
  return resultat(await appeler(client, 'payment-status', { order_id: commande }));
}

/** Annule une commande en attente (bouton « Annuler » pendant l'attente). Un paiement déjà prélevé reste réussi. */
export async function annulerPaiement(client: Client, commande: string): Promise<StatutPaiement> {
  const { data, error } = await client.rpc('cancel_my_order', { p_order: commande });
  if (error) throw error;
  return data === 'cancelled' ? 'echoue' : data === 'succeeded' ? 'reussi' : 'en_attente';
}

const TERMINES: StatutPaiement[] = ['reussi', 'echoue', 'expire'];

/**
 * Suit une commande jusqu'à son issue : interroge le serveur toutes les `intervalle` ms pendant au plus `duree` ms
 * (10 minutes, M8-05). `surStatut` reçoit chaque état. Renvoie le dernier état connu ; une erreur réseau passagère
 * ne l'interrompt pas.
 */
export async function suivrePaiement(
  client: Client, commande: string,
  options: { intervalle?: number; duree?: number; surStatut?: (r: ResultatPaiement) => void; attendre?: (ms: number) => Promise<void>; arret?: { annule: boolean } } = {},
): Promise<ResultatPaiement> {
  const { intervalle = 3000, duree = 600_000, surStatut, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), arret } = options;
  let dernier: ResultatPaiement = { statut: 'en_attente', commande };
  for (let ecoule = 0; ecoule <= duree && !arret?.annule; ecoule += intervalle) {
    try {
      dernier = await lireStatutPaiement(client, commande);
      surStatut?.(dernier);
      if (TERMINES.includes(dernier.statut)) break;
    } catch (e) {
      if (e instanceof ErreurPaiement && e.code === 'auth') throw e;
    }
    await attendre(intervalle);
  }
  return dernier;
}

/** Paiement encore en attente d'un élève qui rouvre l'app (M8-05) : la commande la plus récente non échue, sinon null. */
export async function paiementEnCours(client: Client, maintenant = new Date()): Promise<ResultatPaiement | null> {
  const { data, error } = await client
    .from('orders')
    .select('id, expires_at')
    .eq('status', 'pending')
    .gt('expires_at', maintenant.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const ligne = (data as { id: string; expires_at: string }[] | null)?.[0];
  return ligne ? { statut: 'en_attente', commande: ligne.id, expire: ligne.expires_at } : null;
}

export type Recu = { commande: string; offre: CodeOffre; montant: number; devise: string; numero: string | null; payeLe: string; recu: string };

/** Historique des paiements réussis, du plus récent au plus ancien (M8-04). */
export async function lireRecus(client: Client): Promise<Recu[]> {
  const { data, error } = await client
    .from('orders')
    .select('id, product_code, amount, currency, msisdn_masked, paid_at, receipt_no')
    .in('status', ['succeeded', 'refunded'])
    .order('paid_at', { ascending: false });
  if (error) throw error;
  type L = { id: string; product_code: CodeOffre; amount: number; currency: string; msisdn_masked: string | null; paid_at: string; receipt_no: string };
  return ((data ?? []) as L[]).map((l) => ({ commande: l.id, offre: l.product_code, montant: l.amount, devise: l.currency, numero: l.msisdn_masked, payeLe: l.paid_at, recu: l.receipt_no }));
}
