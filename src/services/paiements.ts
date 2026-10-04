import type { SupabaseClient } from '@supabase/supabase-js';

import type { CodeOffre } from './pass';

export type StatutHistoriquePaiement = 'pending' | 'succeeded' | 'failed' | 'expired' | 'cancelled' | 'refunded';

export type Paiement = {
  id: string;
  offre: CodeOffre;
  pays: string;
  devise: string;
  montant: number;
  statut: StatutHistoriquePaiement;
  canal: 'app' | 'parent_link';
  operateur: string | null;
  referenceFournisseur: string | null;
  creeLe: string;
  misAJourLe: string;
  motifEchec: string | null;
  expireLe: string | null;
  numeroMasque: string | null;
  sandbox: boolean;
  recu: string | null;
  payeLe: string | null;
  rembourseLe: string | null;
  motifRemboursement: string | null;
};

type LignePaiement = {
  id: string;
  product_code: CodeOffre;
  country: string;
  currency: string;
  amount: number;
  status: StatutHistoriquePaiement;
  channel: 'app' | 'parent_link';
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
  failure_code: string | null;
  expires_at: string | null;
  msisdn_masked: string | null;
  sandbox: boolean;
  receipt_no: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
};

type Client = Pick<SupabaseClient, 'from'>;

const COLONNES = 'id, product_code, country, currency, amount, status, channel, provider, provider_ref, created_at, updated_at, failure_code, expires_at, msisdn_masked, sandbox, receipt_no, paid_at, refunded_at, refund_reason';

function convertir(ligne: LignePaiement): Paiement {
  return {
    id: ligne.id,
    offre: ligne.product_code,
    pays: ligne.country,
    devise: ligne.currency,
    montant: ligne.amount,
    statut: ligne.status,
    canal: ligne.channel,
    operateur: ligne.provider,
    referenceFournisseur: ligne.provider_ref,
    creeLe: ligne.created_at,
    misAJourLe: ligne.updated_at,
    motifEchec: ligne.failure_code,
    expireLe: ligne.expires_at,
    numeroMasque: ligne.msisdn_masked,
    sandbox: ligne.sandbox,
    recu: ligne.receipt_no,
    payeLe: ligne.paid_at,
    rembourseLe: ligne.refunded_at,
    motifRemboursement: ligne.refund_reason,
  };
}

/** Historique privé de l'élève connecté, du plus récent au plus ancien. */
export async function lirePaiements(client: Client): Promise<Paiement[]> {
  const { data, error } = await client.from('orders').select(COLONNES).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as LignePaiement[]).map(convertir);
}

/** Un paiement privé, utilisé par l'écran de détail. */
export async function lirePaiement(client: Client, id: string): Promise<Paiement | null> {
  const { data, error } = await client.from('orders').select(COLONNES).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? convertir(data as unknown as LignePaiement) : null;
}
