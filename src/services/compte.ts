import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import type { CleTexte } from '@/i18n';

import { suivre } from './analytics';
import { effacerDonneesLocales } from './donneesLocales';
import { conserverCode, normaliserCode } from './parrainage';
import {
  annulerOAuthRepriseInvite,
  effacerRepriseInvite,
  preparerRepriseInvite,
  progressionInviteeLocalePresente,
  terminerOAuthRepriseInvite,
  verifierRepriseInvitee,
} from './repriseInvite';
import { assurerSessionInvite } from './session';

type Client = Pick<SupabaseClient, 'auth' | 'functions' | 'rpc'>;

export type Methode = 'email' | 'google' | 'apple' | 'facebook';

/** Fournisseurs passant par la page OAuth de Supabase dans le navigateur. */
export type FournisseurOAuth = 'google' | 'facebook';

/** Erreur que l'écran sait traduire : `cle` est une clé de texte. */
export class ErreurCompte extends Error {
  constructor(readonly cle: CleTexte, options?: { cause?: unknown; code?: string }) {
    super(cle, options);
    this.name = 'ErreurCompte';
    this.code = options?.code;
  }

  readonly code?: string;
}

export const MOT_DE_PASSE_MIN = 8;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Clé de l'erreur de saisie à afficher sous le champ, ou `null` si la valeur est valable. */
export function validerEmail(valeur: string): CleTexte | null {
  const v = valeur.trim();
  if (!v) return 'compte.erreurs.emailVide';
  return RE_EMAIL.test(v) ? null : 'compte.erreurs.emailInvalide';
}
export function validerMotDePasse(valeur: string): CleTexte | null {
  if (!valeur) return 'compte.erreurs.motDePasseVide';
  return valeur.length >= MOT_DE_PASSE_MIN ? null : 'compte.erreurs.motDePasseCourt';
}
/** Le code de parrainage est facultatif : vide est valable. */
export function validerCodeParrainage(valeur: string): CleTexte | null {
  return !valeur.trim() || normaliserCode(valeur) ? null : 'compte.erreurs.codeInvalide';
}

/** Traduit une erreur Supabase ou réseau en message lisible (jamais de texte technique à l'écran). */
export function cleErreur(erreur: unknown): CleTexte {
  if (erreur instanceof ErreurCompte) return erreur.cle;
  const e = erreur as { code?: string; status?: number; name?: string; message?: string } | null;
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  if (code === 'user_already_exists' || code === 'email_exists' || code === 'identity_already_exists' || /already (been )?registered|already exists/.test(msg)) return 'compte.erreurs.emailDejaUtilise';
  if (code === 'invalid_credentials' || /invalid login credentials/.test(msg)) return 'compte.erreurs.identifiants';
  if (code === 'weak_password' || /password.*(short|least|weak)/.test(msg)) return 'compte.erreurs.motDePasseCourt';
  if (code === 'email_address_invalid' || code === 'validation_failed' && /email/.test(msg)) return 'compte.erreurs.emailInvalide';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || e?.status === 429) return 'compte.erreurs.tropDeTentatives';
  if (code === 'email_not_confirmed') return 'compte.erreurs.emailNonConfirme';
  if (code === 'manual_linking_disabled' || code === 'provider_disabled') return 'compte.erreurs.methodeIndisponible';
  if (e?.name === 'AuthRetryableFetchError' || /network|failed to fetch|timeout/.test(msg)) return 'compte.erreurs.reseau';
  return 'compte.erreurs.inconnue';
}

export const estInvite = (user?: Pick<User, 'is_anonymous'> | null) => !!user?.is_anonymous;

async function confirmerBesoinReprise(client: Client, inviteId: string, compteId: string): Promise<boolean> {
  if (!(await terminerOAuthRepriseInvite(inviteId, compteId))) return false;
  try {
    const progressionLocale = await progressionInviteeLocalePresente();
    if (progressionLocale || await verifierRepriseInvitee(client, false)) return true;
    await effacerRepriseInvite();
    return false;
  } catch (e) {
    console.warn('Impossible de vérifier la progression invitée avant son rattachement.', e);
    return true;
  }
}

type ResultatCreation = { etat: 'cree' | 'confirmation'; conversionInvite: boolean };

/**
 * Crée le compte e-mail + mot de passe. Si la session courante est celle d'un invité, `updateUser` convertit cet utilisateur
 * en compte permanent (même identifiant : la progression est conservée). Le code de parrainage part dans la metadata
 * `referral_code` (le serveur l'enregistre par trigger). `confirmation` : Supabase attend un clic sur le lien e-mail.
 */
export async function creerCompteEmail(client: Client, p: { email: string; motDePasse: string; codeParrainage?: string | null }): Promise<ResultatCreation> {
  const email = p.email.trim();
  const code = normaliserCode(p.codeParrainage);
  const { data: courante } = await client.auth.getSession();
  const conversionInvite = estInvite(courante.session?.user);

  if (conversionInvite) {
    const { data: maj, error } = await client.auth.updateUser({ email, password: p.motDePasse });
    if (error) throw error;
    await rattacherCode(client, p.codeParrainage);
    suivre('compte_cree', { methode: 'email', conversion_invite: true, avec_parrainage: !!code });
    return { etat: maj.user?.new_email ? 'confirmation' : 'cree', conversionInvite };
  }

  const { data: nouveau, error } = await client.auth.signUp({ email, password: p.motDePasse });
  if (error) throw error;
  if (nouveau.session) {
    await rattacherCode(client, p.codeParrainage);
  }
  suivre('compte_cree', { methode: 'email', conversion_invite: false, avec_parrainage: !!code });
  return { etat: nouveau.session ? 'cree' : 'confirmation', conversionInvite };
}

export async function connecterEmail(client: Client, p: { email: string; motDePasse: string }): Promise<Session> {
  const { data: courante } = await client.auth.getSession();
  const sessionInvite = estInvite(courante.session?.user) ? courante.session : null;
  if (sessionInvite) {
    if (!sessionInvite.refresh_token) throw new ErreurCompte('compte.erreurs.inconnue');
    await preparerRepriseInvite(sessionInvite.user.id, sessionInvite.refresh_token);
  }
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: p.email.trim(), password: p.motDePasse });
    if (error) throw error;
    if (sessionInvite) {
      const sessionCible = data.session ?? (await client.auth.getSession()).data.session;
      if (!sessionCible) throw new ErreurCompte('compte.erreurs.inconnue');
      await confirmerBesoinReprise(client, sessionInvite.user.id, sessionCible.user.id);
    }
    suivre('connexion_reussie', { methode: 'email' });
    return data.session;
  } catch (e) {
    if (sessionInvite) await annulerOAuthRepriseInvite();
    throw e;
  }
}

/** Déconnexion : données du téléphone effacées (M2-14), puis nouvelle session invité pour que l'app reste utilisable. */
export async function deconnecter(client: Client): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
  suivre('deconnexion', {});
  await effacerDonneesLocales();
  await assurerSessionInvite(client);
}

/** Dépendances natives injectées (expo-web-browser, expo-linking) pour garder la logique testable. */
export type DepsOAuth = {
  ouvrirNavigateur: (url: string, redirection: string) => Promise<{ type: string; url?: string }>;
  urlRedirection: string;
  /** Web : l'onglet part chez le fournisseur et revient avec le code ; la session est installée au retour (retourOAuthWeb). */
  pleinePage?: boolean;
};

/**
 * Google ou Facebook via OAuth Supabase. Par défaut un invité rattache le fournisseur à son compte pour garder sa
 * progression. L'écran de connexion peut demander une connexion directe au compte existant.
 */
export async function connecterOAuth(client: Client, fournisseur: FournisseurOAuth, deps: DepsOAuth, codeParrainage?: string | null, mode: ModeSocial = {}): Promise<boolean> {
  const { data: courante } = await client.auth.getSession();
  const conversionInvite = estInvite(courante.session?.user);
  const rattachement = !mode.connexionDirecte && (conversionInvite || !!mode.rattacher);
  const sessionInvite = mode.connexionDirecte && conversionInvite ? courante.session : null;
  if (sessionInvite) {
    if (!sessionInvite.refresh_token) throw new ErreurCompte('compte.erreurs.inconnue');
    await preparerRepriseInvite(sessionInvite.user.id, sessionInvite.refresh_token);
  }
  try {
    // Page entière : le formulaire est perdu pendant l'aller-retour, le code de parrainage saisi est gardé sur l'appareil.
    if (deps.pleinePage && codeParrainage) await conserverCode(codeParrainage, 'saisie').catch(() => null);
    await parcoursOAuth(client, fournisseur, deps, rattachement);
    let reprise = false;
    if (sessionInvite) {
      const { data: connexion } = await client.auth.getSession();
      if (!connexion.session) throw new ErreurCompte('compte.erreurs.inconnue');
      reprise = await confirmerBesoinReprise(client, sessionInvite.user.id, connexion.session.user.id);
    }
    const avecCode = await rattacherCode(client, codeParrainage);
    if (rattachement && conversionInvite) suivre('compte_cree', { methode: fournisseur, conversion_invite: true, avec_parrainage: avecCode });
    else if (mode.rattacher) suivre('identite_rattachee', { methode: fournisseur });
    else suivre('connexion_reussie', { methode: fournisseur });
    return reprise;
  } catch (e) {
    if (sessionInvite) await annulerOAuthRepriseInvite();
    throw e;
  }
}

/** Ouvre la page du fournisseur puis installe la session renvoyée sur `elearnprepa://auth/callback`. */
async function parcoursOAuth(client: Client, fournisseur: FournisseurOAuth, deps: DepsOAuth, rattachement: boolean): Promise<void> {
  // Web : on veut le flux PKCE (`?code=` échangé contre une vraie session). `skipBrowserRedirect: true` forcerait le
  // flux implicite (`#access_token=`) dont le `refresh_token` est un leurre (`nyxhb7iejebe`) : la session serait
  // installée sans jeton de rafraîchissement valable, et l'élève retomberait déconnecté sur l'accueil.
  const options = { redirectTo: deps.urlRedirection, skipBrowserRedirect: !deps.pleinePage };
  const { data, error } = rattachement
    ? await client.auth.linkIdentity({ provider: fournisseur, options })
    : await client.auth.signInWithOAuth({ provider: fournisseur, options });
  if (error) throw error;
  if (!data.url) throw new ErreurCompte('compte.erreurs.inconnue');

  const resultat = await deps.ouvrirNavigateur(data.url, deps.urlRedirection);
  if (resultat.type !== 'success' || !resultat.url) throw new ErreurCompte('compte.erreurs.annule');

  const { code, accessToken, refreshToken, erreur, codeErreur } = lireRetourOAuth(resultat.url);
  if (codeErreur === 'identity_already_exists') throw new ErreurCompte('compte.erreurs.dejaLie', { code: codeErreur });
  if (codeErreur === 'manual_linking_disabled') throw new ErreurCompte('compte.erreurs.methodeIndisponible', { code: codeErreur });
  if (erreur) throw new ErreurCompte('compte.erreurs.annule');
  if (code) {
    const { error: e } = await client.auth.exchangeCodeForSession(code);
    if (e) throw e;
  } else if (accessToken && refreshToken) {
    const { error: e } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (e) throw e;
  } else {
    throw new ErreurCompte('compte.erreurs.inconnue');
  }
}

/** `rattacher` lie le fournisseur au compte courant ; `connexionDirecte` ouvre une session existante. */
export type ModeSocial = { rattacher?: boolean; connexionDirecte?: boolean };

export const connecterGoogle = (client: Client, deps: DepsOAuth, codeParrainage?: string | null, mode?: ModeSocial) => connecterOAuth(client, 'google', deps, codeParrainage, mode);
export const connecterFacebook = (client: Client, deps: DepsOAuth, codeParrainage?: string | null, mode?: ModeSocial) => connecterOAuth(client, 'facebook', deps, codeParrainage, mode);

/** Après une connexion sociale : envoie le code de parrainage au compte (metadata `referral_code`). Ne bloque jamais la connexion. */
export async function rattacherCode(client: Client, codeParrainage?: string | null): Promise<boolean> {
  const code = normaliserCode(codeParrainage);
  if (!code) return false;
  try {
    const { data, error } = await client.rpc('apply_referral_on_signup', { p_code: code });
    if (error) return false;
    return data?.ok === true;
  } catch {
    return false;
  }
}

/** Retour OAuth : `?code=` (PKCE) ou `#access_token=…&refresh_token=…` (flux implicite). */
export function lireRetourOAuth(url: string) {
  const [sansHash, hash = ''] = url.split('#');
  const requete = new URLSearchParams(sansHash.split('?')[1] ?? '');
  const fragment = new URLSearchParams(hash);
  return {
    code: requete.get('code'),
    accessToken: fragment.get('access_token'),
    refreshToken: fragment.get('refresh_token'),
    erreur: requete.get('error') ?? fragment.get('error'),
    codeErreur: requete.get('error_code') ?? fragment.get('error_code'),
  };
}

export type DepsApple = {
  disponible: () => Promise<boolean>;
  /** Ouvre la feuille Apple et renvoie le jeton d'identité et le nonce brut utilisé. */
  demander: () => Promise<{ identityToken: string | null; nonce: string }>;
};

/** Apple (iOS seulement) : jeton d'identité natif échangé contre une session Supabase. */
export async function connecterApple(client: Client, deps: DepsApple, codeParrainage?: string | null, mode: ModeSocial = {}): Promise<boolean> {
  if (!(await deps.disponible())) throw new ErreurCompte('compte.erreurs.appleIndisponible');
  let jeton: { identityToken: string | null; nonce: string };
  try {
    jeton = await deps.demander();
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new ErreurCompte('compte.erreurs.annule');
    throw e;
  }
  if (!jeton.identityToken) throw new ErreurCompte('compte.erreurs.inconnue');
  const identifiants = { provider: 'apple', token: jeton.identityToken, nonce: jeton.nonce };
  const { data: courante } = await client.auth.getSession();
  const sessionInvite = mode.connexionDirecte && estInvite(courante.session?.user) ? courante.session : null;
  if (sessionInvite) {
    if (!sessionInvite.refresh_token) throw new ErreurCompte('compte.erreurs.inconnue');
    await preparerRepriseInvite(sessionInvite.user.id, sessionInvite.refresh_token);
  }
  try {
    const { error } = mode.rattacher ? await client.auth.linkIdentity(identifiants) : await client.auth.signInWithIdToken(identifiants);
    if (error) throw error;
    let reprise = false;
    if (sessionInvite) {
      const { data: connexion } = await client.auth.getSession();
      if (!connexion.session) throw new ErreurCompte('compte.erreurs.inconnue');
      reprise = await confirmerBesoinReprise(client, sessionInvite.user.id, connexion.session.user.id);
    }
    await rattacherCode(client, codeParrainage);
    suivre(mode.rattacher ? 'identite_rattachee' : 'connexion_reussie', { methode: 'apple' });
    return reprise;
  } catch (e) {
    if (sessionInvite) await annulerOAuthRepriseInvite();
    throw e;
  }
}
