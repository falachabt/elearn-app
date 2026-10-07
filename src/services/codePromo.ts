import type { SupabaseClient } from '@supabase/supabase-js';

import type { CodeOffre } from './pass';

type Client = Pick<SupabaseClient, 'rpc'>;

export const LONGUEUR_CODE_MAX = 20;

export type CodePromoAppliquable = {
  valide: true;
  code: string;
  type: 'pct' | 'fixe';
  valeur: number;
  prixInitial: number;
  prixFinal: number;
  devise: string;
  gratuit: boolean;
};

/** Motifs de refus : ceux du serveur plus `reseau` (pas de réponse) et `inconnu` pour toute réponse illisible. */
export type MotifPromo = 'inconnu' | 'expire' | 'epuise' | 'offre' | 'limite' | 'reseau' | 'compte_requis';

export type CodePromoRefuse = {
  valide: false;
  erreur: MotifPromo;
  /** Date d'expiration AAAA-MM-JJ (motif `expire`). */
  expireLe?: string;
  /** Offres pour lesquelles le code vaut (motif `offre`), limitées à celles que l'app connaît. */
  offresValables?: CodeOffre[];
};

export type ResultatCodePromo = CodePromoAppliquable | CodePromoRefuse;

const OFFRES: CodeOffre[] = ['week', 'month', 'contest'];
const MOTIFS: MotifPromo[] = ['inconnu', 'expire', 'epuise', 'offre', 'limite', 'compte_requis'];

/** Saisie → forme envoyée au serveur : majuscules, lettres, chiffres et tiret seulement, 20 caractères au plus. */
export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, LONGUEUR_CODE_MAX);
}

/** Motif d'un refus de create_order (message de l'erreur P0004, renvoyé par le back-office) vers un motif d'écran. */
export function motifDepuisServeur(motif?: string): MotifPromo {
  if (motif === 'inactif') return 'inconnu';
  return MOTIFS.includes(motif as MotifPromo) ? (motif as MotifPromo) : 'inconnu';
}

type Brut = Record<string, unknown>;

function lire(donnees: unknown): ResultatCodePromo {
  const d = (donnees ?? {}) as Brut;
  if (d.valide === true && typeof d.prix_final === 'number' && typeof d.prix_initial === 'number') {
    return {
      valide: true,
      code: String(d.code ?? ''),
      type: d.type === 'fixe' ? 'fixe' : 'pct',
      valeur: Number(d.valeur ?? 0),
      prixInitial: d.prix_initial,
      prixFinal: d.prix_final,
      devise: String(d.devise ?? ''),
      gratuit: d.prix_final === 0,
    };
  }
  const offres = Array.isArray(d.offres_valables) ? (d.offres_valables as unknown[]).filter((o): o is CodeOffre => OFFRES.includes(o as CodeOffre)) : undefined;
  return {
    valide: false,
    erreur: motifDepuisServeur(typeof d.erreur === 'string' ? d.erreur : undefined),
    expireLe: typeof d.expire_le === 'string' ? d.expire_le : undefined,
    offresValables: offres?.length ? offres : undefined,
  };
}

/**
 * Vérifie un code pour une offre et un pays avant de payer (RPC apply_promo_code). Le prix revient du serveur : l'app ne le
 * calcule pas et ne l'envoie jamais. Un échec réseau donne le motif `reseau` (le texte saisi reste, « Réessayer »).
 */
export async function verifierCodePromo(client: Client, p: { code: string; offre: CodeOffre; pays: string }): Promise<ResultatCodePromo> {
  try {
    const { data, error } = await client.rpc('apply_promo_code', { p_code: normaliserCode(p.code), p_product: p.offre, p_country: p.pays.toUpperCase() });
    if (error) return { valide: false, erreur: 'reseau' };
    return lire(data);
  } catch {
    return { valide: false, erreur: 'reseau' };
  }
}

/** Libellé du badge : « -20 % » ou « -500 FCFA » (le montant est mis en forme par l'appelant). */
export const etiquetteRabais = (c: Pick<CodePromoAppliquable, 'type' | 'valeur'>, montant: (n: number) => string): string =>
  c.type === 'pct' ? `-${c.valeur} %` : `-${montant(c.valeur)}`;
