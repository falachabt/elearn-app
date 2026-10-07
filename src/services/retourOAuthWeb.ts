import type { SupabaseClient } from '@supabase/supabase-js';

import { lireRetourOAuth, rattacherCode } from './compte';
import { effacerCode, lireCodeValide } from './parrainage';

type Client = Pick<SupabaseClient, 'auth' | 'rpc'>;

/** Adresse de la page au chargement du module, avant tout changement de route : le retour OAuth y est écrit. */
export const urlAuLancement: string | null = typeof globalThis.location?.href === 'string' ? globalThis.location.href : null;

/**
 * Web : connexion Google en page entière. L'élève part sur la page Google dans le même onglet et revient sur l'app avec
 * `?code=` (flux PKCE) ou `#access_token=` : on installe la session ici, quelle que soit la route d'arrivée (l'adresse
 * `/auth/callback` n'est pas forcément autorisée dans Supabase, qui renvoie alors à la racine du site).
 * `rien` : ce n'est pas un retour OAuth ; `session` : session installée ; `erreur` : refus ou échec, l'élève reste invité.
 */
export async function finirRetourOAuthWeb(client: Client, url: string | null): Promise<'rien' | 'session' | 'erreur'> {
  if (!url) return 'rien';
  const r = lireRetourOAuth(url);
  if (!r.code && !r.accessToken && !r.erreur) return 'rien';
  if (r.erreur) return 'erreur';
  try {
    const { error } = r.code
      ? await client.auth.exchangeCodeForSession(r.code)
      : await client.auth.setSession({ access_token: r.accessToken as string, refresh_token: r.refreshToken ?? '' });
    if (error) return 'erreur';
  } catch {
    return 'erreur';
  }
  // Le code de parrainage saisi avant le départ est gardé sur l'appareil : on le rattache au compte maintenant.
  const parrainage = await lireCodeValide().catch(() => null);
  if (parrainage && (await rattacherCode(client, parrainage))) await effacerCode().catch(() => {});
  return 'session';
}
