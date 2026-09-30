import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';

type Client = Pick<SupabaseClient, 'from' | 'rpc'>;

export type CodeOffre = 'week' | 'month' | 'contest';
export type Offre = { code: CodeOffre; montant: number; devise: string; recommandee: boolean; dureeJours: number | null; finSaison: string | null; converti?: boolean };
export type Acces = { offre: CodeOffre; fin: string; source: string } | null;

/** Repère affiché en haut des offres (M8-01) : un répétiteur à la maison, par mois. */
export const PRIX_REPETITEUR = 20000;

type LigneOffre = {
  product_code: CodeOffre;
  amount: number;
  currency: string;
  converted: boolean;
  recommended: boolean;
  sort_order: number;
  duration_days: number | null;
  season_ends_on: string | null;
};

/**
 * Offres disponibles dans le pays (M8-01, M14), dans l'ordre d'affichage. Vide si aucun prix pour ce pays.
 * Le serveur (pass_offers) prend le prix saisi, sinon convertit le prix camerounais dans la devise du pays.
 */
export async function lireOffres(client: Client, pays: string): Promise<Offre[]> {
  const { data, error } = await client.rpc('pass_offers', { p_country: pays.toUpperCase() });
  if (!error && Array.isArray(data)) {
    return (data as LigneOffre[]).map((l) => ({
      code: l.product_code,
      montant: l.amount,
      devise: l.currency,
      recommandee: l.recommended,
      dureeJours: l.duration_days,
      finSaison: l.season_ends_on,
      converti: l.converted,
    }));
  }
  return lirePrixSaisis(client, pays);
}

/** Repli tant que pass_offers n'est pas en production : seulement les prix saisis. */
async function lirePrixSaisis(client: Client, pays: string): Promise<Offre[]> {
  const { data, error } = await client
    .from('pass_prices')
    .select('product_code, amount, currency, pass_products!inner(recommended, sort_order, duration_days, season_ends_on)')
    .eq('country', pays.toUpperCase());
  if (error) throw error;
  type Ligne = { product_code: CodeOffre; amount: number; currency: string; pass_products: { recommended: boolean; sort_order: number; duration_days: number | null; season_ends_on: string | null } };
  return ((data ?? []) as unknown as Ligne[])
    .sort((a, b) => a.pass_products.sort_order - b.pass_products.sort_order)
    .map((l) => ({
      code: l.product_code,
      montant: l.amount,
      devise: l.currency,
      recommandee: l.pass_products.recommended,
      dureeJours: l.pass_products.duration_days,
      finSaison: l.pass_products.season_ends_on,
    }));
}

/** Accès en cours (null = gratuit). */
export async function lireAcces(client: Client): Promise<Acces> {
  const { data, error } = await client.rpc('my_access');
  if (error) throw error;
  const l = (data as { product_code: CodeOffre; ends_at: string; source: string }[] | null)?.[0];
  return l ? { offre: l.product_code, fin: l.ends_at, source: l.source } : null;
}

export type LienParent = { jeton: string; url: string; montant: number; devise: string; expire: string };

export const URL_PAIEMENT_PARENT = 'https://elearnprepa.com/p/';

/** Lien de paiement pour le parent ou tuteur (M8-06) : créé par le serveur, montant fixé, valable 48 h. */
export async function creerLienParent(client: Client, p: { offre: CodeOffre; pays: string; prenom?: string | null }): Promise<LienParent> {
  const { data, error } = await client.rpc('create_parent_payment_link', { p_product: p.offre, p_country: p.pays, p_student_name: p.prenom ?? null });
  if (error) throw error;
  const l = (data as { token: string; amount: number; currency: string; expires_at: string }[] | null)?.[0];
  if (!l) throw new Error('lien non créé');
  suivre('parent_link_created', { offre: p.offre, montant: l.amount });
  return { jeton: l.token, url: `${URL_PAIEMENT_PARENT}${l.token}`, montant: l.amount, devise: l.currency, expire: l.expires_at };
}

/** XAF et XOF s'affichent « FCFA ». */
export const estFcfa = (devise: string) => devise === 'XAF' || devise === 'XOF';

/** « 2 500 FCFA » : espaces insécables, FCFA pour XAF et XOF. */
export function formaterMontant(montant: number, devise: string): string {
  const nombre = String(Math.round(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const unite = estFcfa(devise) ? 'FCFA' : devise;
  return `${nombre} ${unite}`;
}

/** Lien WhatsApp avec le message prérempli, sans destinataire : l'élève choisit son parent dans WhatsApp. */
export function lienWhatsApp(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
