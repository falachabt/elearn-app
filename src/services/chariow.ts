import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import type { CodeOffre } from './pass';

/**
 * Paiement international par Chariow, pour les pays que le Mobile Money (pawaPay) ne couvre pas.
 *
 * L'application ne parle jamais à Chariow : elle appelle notre Edge Function `chariow-checkout`, qui crée la commande,
 * garde la clé secrète côté serveur et renvoie l'adresse de la page de paiement. Même séparation que pour pawaPay, où
 * l'app ne connaît que le back-office.
 */

/** Réponse de la fonction `chariow-checkout`. */
export type PaiementChariow = {
  commande: string;
  url: string;
  montant?: number;
  devise?: string;
  /** Vrai quand une commande en attente a été reprise (aucun second paiement). */
  repris?: boolean;
};

/** Codes d'échec que l'écran sait traduire. */
export type CodeErreurChariow = 'indisponible' | 'configuration' | 'auth' | 'reseau';

export class ErreurChariow extends Error {
  constructor(readonly code: CodeErreurChariow, readonly message: string = '') {
    super(`chariow: ${code}`);
  }
}

type Invocateur = Pick<SupabaseClient, 'functions'>;
type Contexte = { status?: number; json?: () => Promise<{ message?: string }> };

/** Statut et message renvoyés par la fonction : le message du serveur sert quand il existe. */
async function lireErreur(erreur: unknown): Promise<{ statut: number; message: string }> {
  const contexte = (erreur as { context?: Contexte } | null)?.context;
  const statut = contexte?.status ?? 0;
  const corps = await contexte?.json?.().catch(() => null);
  return { statut, message: corps?.message ?? '' };
}

const codeDepuisStatut = (statut: number): CodeErreurChariow => {
  if (statut === 401) return 'auth';
  if (statut === 500) return 'configuration';
  return 'indisponible';
};

/**
 * Ouvre une page de paiement Chariow. Lève {@link ErreurChariow} : `indisponible` quand le pays n'a pas de prix ou
 * que Chariow refuse, `configuration` quand le serveur n'est pas prêt, `auth` sans session, `reseau` en cas de coupure.
 */
export async function ouvrirPaiementChariow(
  client: Invocateur,
  p: { offre: CodeOffre; pays: string; telephone: string; prenom?: string; nom?: string; indicatif?: string },
): Promise<PaiementChariow> {
  let donnees: unknown;
  try {
    const r = await client.functions.invoke('chariow-checkout', {
      body: {
        product: p.offre,
        country: p.pays.toUpperCase(),
        phone: p.telephone,
        first_name: p.prenom,
        last_name: p.nom,
        indicatif: p.indicatif,
      },
    });
    if (r.error) {
      const { statut, message } = await lireErreur(r.error);
      throw new ErreurChariow(codeDepuisStatut(statut), message);
    }
    donnees = r.data;
  } catch (e) {
    if (e instanceof ErreurChariow) throw e;
    throw new ErreurChariow('reseau');
  }

  const d = (donnees ?? {}) as Partial<PaiementChariow>;
  if (!d.commande || !d.url) throw new ErreurChariow('indisponible');
  // Même évènement que le Mobile Money, avec le mode : les deux tunnels restent comparables dans les statistiques.
  suivre('payment_initiated', { offre: p.offre, pays: p.pays, operateur: 'chariow', mode: 'carte' });
  return { commande: d.commande, url: d.url, montant: d.montant, devise: d.devise, repris: d.repris };
}
