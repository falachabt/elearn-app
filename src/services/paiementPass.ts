import type { SupabaseClient } from '@supabase/supabase-js';
import * as Updates from 'expo-updates';

import { suivre } from './analytics';
import type { CodeOffre } from './pass';

/**
 * Paiement d'un pass par Mobile Money (pawaPay, direct charge) via le back-office. L'app ne parle jamais à pawaPay :
 * le serveur choisit le prix du pays, vérifie que l'opérateur accepte sa devise, formate le numéro et appelle pawaPay ;
 * l'élève valide seulement sur son téléphone. Les pays et les opérateurs (avec leurs logos) viennent de pawaPay.
 */
export const URL_BACKOFFICE = 'https://staff.elearnprepa.com';

/** Essai : développement et canal EAS « preview » passent par le bac à sable pawaPay (aucun argent réel). */
export const modeEssai = (): boolean => __DEV__ || Updates.channel === 'preview';

export type Operateur = {
  provider: string;
  name: string;
  logo: string | null;
  currency: string;
  min: number | null;
  max: number | null;
  /** PROVIDER_AUTH : demande de PIN sur le téléphone ; PREAUTH : code d'autorisation à saisir ; REDIRECT_AUTH : page de l'opérateur. */
  authType: 'PROVIDER_AUTH' | 'PREAUTH' | 'REDIRECT_AUTH';
  pinPrompt: 'AUTOMATIC' | 'MANUAL';
  delayed: boolean;
};
export type OffrePays = { code: CodeOffre; amount: number; currency: string; converted: boolean; recommended: boolean; durationDays: number | null };
export type MethodesPays = {
  payable: boolean;
  country: string;
  countryName?: string;
  flag?: string | null;
  /** Indicatif sans « + » (237). */
  prefix?: string;
  currency?: string | null;
  offers: OffrePays[];
  providers: Operateur[];
};
export type PaysPaiement = { alpha2: string; name: string; flag: string | null; prefix: string; currencies: string[] };

export type StatutPaiement = 'en_attente' | 'reussi' | 'echoue' | 'expire' | 'rembourse';
export type ResultatPaiement = {
  statut: StatutPaiement;
  commande: string;
  /** Message prêt à afficher (dans la langue demandée) quand le paiement a échoué. */
  message?: string;
  echec?: string;
  recu?: string;
  montant?: number;
  devise?: string;
  authType?: Operateur['authType'];
  pinPrompt?: Operateur['pinPrompt'];
  /** REDIRECT_AUTH : adresse de l'opérateur où l'élève valide. */
  urlAutorisation?: string | null;
};

/** Refus avant tout prélèvement (ou panne) : l'écran choisit le texte, `message` vient du serveur quand il existe. */
export class ErreurPaiement extends Error {
  constructor(readonly code: string, readonly message: string = '', readonly commande?: string, readonly echec?: string) {
    super(`paiement: ${code}`);
  }
}

type Fetch = typeof fetch;
type Corps = Record<string, unknown>;

async function appeler(chemin: string, { methode = 'GET', jeton, corps, appel = fetch }: { methode?: 'GET' | 'POST'; jeton?: string; corps?: Corps; appel?: Fetch }): Promise<Corps> {
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), 30_000);
  try {
    const reponse = await appel(`${URL_BACKOFFICE}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: arret.signal,
    });
    const donnees = (await reponse.json().catch(() => ({}))) as Corps;
    if (!reponse.ok) {
      throw new ErreurPaiement(String(donnees.code ?? 'indisponible'), String(donnees.message ?? ''), donnees.order_id as string | undefined, donnees.failure as string | undefined);
    }
    return donnees;
  } catch (e) {
    if (e instanceof ErreurPaiement) throw e;
    throw new ErreurPaiement('reseau');
  } finally {
    clearTimeout(minuteur);
  }
}

type ClientAuth = Pick<SupabaseClient, 'auth'>;

async function jetonDe(client: ClientAuth): Promise<string> {
  const { data } = await client.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new ErreurPaiement('auth');
  return jeton;
}

const parametresLangue = (langue: string) => `locale=${langue === 'en' ? 'en' : 'fr'}&sandbox=${modeEssai()}`;

/** Pays où pawaPay accepte les dépôts (sélecteur de pays). */
export async function lirePaysPaiement(langue: string, appel?: Fetch): Promise<PaysPaiement[]> {
  const r = await appeler(`/api/pass/pawapay/methods?${parametresLangue(langue)}`, { appel });
  return ((r.countries as PaysPaiement[] | undefined) ?? []).filter((p) => p.alpha2);
}

/** Offres du pays (prix dans sa devise) et opérateurs qui l'acceptent, avec leur logo. `payable: false` : pas de Mobile Money ici. */
export async function lireMethodes(pays: string, langue: string, appel?: Fetch): Promise<MethodesPays> {
  const r = await appeler(`/api/pass/pawapay/methods?country=${encodeURIComponent(pays.toUpperCase())}&${parametresLangue(langue)}`, { appel });
  return { offers: [], providers: [], ...r, payable: r.payable === true } as unknown as MethodesPays;
}

function resultat(c: Corps): ResultatPaiement {
  const statut = c.status as StatutPaiement | undefined;
  const commande = c.order_id as string | undefined;
  if (!statut || !commande) throw new ErreurPaiement('indisponible');
  return {
    statut,
    commande,
    message: c.message as string | undefined,
    echec: c.failure as string | undefined,
    recu: c.receipt_no as string | undefined,
    montant: c.amount as number | undefined,
    devise: c.currency as string | undefined,
    authType: c.authType as ResultatPaiement['authType'],
    pinPrompt: c.pinPrompt as ResultatPaiement['pinPrompt'],
    urlAutorisation: (c.authorizationUrl as string | null | undefined) ?? null,
  };
}

/**
 * Lance le paiement direct : le serveur crée la commande au prix du pays, appelle pawaPay, puis l'élève valide sur son
 * téléphone. Un deuxième appel reprend la commande en attente sans second prélèvement. Lève ErreurPaiement avec le
 * message du serveur (« Solde insuffisant… », « Numéro invalide… ») quand pawaPay refuse.
 */
export async function payerMobileMoney(
  client: ClientAuth,
  p: { offre: CodeOffre; pays: string; telephone: string; operateur: string; codePreauth?: string; langue: string },
  appel?: Fetch,
): Promise<ResultatPaiement> {
  const r = resultat(
    await appeler('/api/pass/pawapay/pay', {
      methode: 'POST',
      jeton: await jetonDe(client),
      appel,
      corps: { product: p.offre, country: p.pays, phone: p.telephone, provider: p.operateur, preAuthorisationCode: p.codePreauth || undefined, locale: p.langue === 'en' ? 'en' : 'fr', sandbox: modeEssai() },
    }),
  );
  suivre('payment_initiated', { offre: p.offre, pays: p.pays, operateur: p.operateur, mode: modeEssai() ? 'sandbox' : 'production' });
  return r;
}

/** État d'une commande ; le serveur relit le dépôt chez pawaPay si elle est encore en attente. */
export async function lireStatutCommande(client: ClientAuth, commande: string, langue: string, appel?: Fetch): Promise<ResultatPaiement> {
  return resultat(await appeler(`/api/pass/pawapay/status/${commande}?locale=${langue === 'en' ? 'en' : 'fr'}`, { jeton: await jetonDe(client), appel }));
}

const TERMINES: StatutPaiement[] = ['reussi', 'echoue', 'expire', 'rembourse'];

/**
 * Suit une commande jusqu'à son issue : interroge le serveur toutes les `intervalle` ms pendant au plus `duree` ms
 * (10 minutes). `surStatut` reçoit chaque état. Une erreur réseau passagère ne l'interrompt pas.
 */
export async function suivreCommande(
  client: ClientAuth,
  commande: string,
  langue: string,
  options: { intervalle?: number; duree?: number; surStatut?: (r: ResultatPaiement) => void; attendre?: (ms: number) => Promise<void>; arret?: { annule: boolean }; appel?: Fetch } = {},
): Promise<ResultatPaiement> {
  const { intervalle = 3000, duree = 600_000, surStatut, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), arret, appel } = options;
  let dernier: ResultatPaiement = { statut: 'en_attente', commande };
  for (let ecoule = 0; ecoule <= duree && !arret?.annule; ecoule += intervalle) {
    try {
      dernier = await lireStatutCommande(client, commande, langue, appel);
      surStatut?.(dernier);
      if (TERMINES.includes(dernier.statut)) break;
    } catch (e) {
      if (e instanceof ErreurPaiement && (e.code === 'auth' || e.code === 'introuvable')) throw e;
    }
    await attendre(intervalle);
  }
  return dernier;
}

/** Abandon par l'élève pendant l'attente. Un paiement déjà prélevé reste réussi (le serveur tranche). */
export async function annulerCommande(client: Pick<SupabaseClient, 'rpc'>, commande: string): Promise<StatutPaiement> {
  const { data, error } = await client.rpc('cancel_my_order', { p_order: commande });
  if (error) throw error;
  return data === 'cancelled' ? 'echoue' : data === 'succeeded' ? 'reussi' : 'en_attente';
}
