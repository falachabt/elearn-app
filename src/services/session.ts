import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import { effacerDonneesLocales } from './donneesLocales';

type ClientAuth = Pick<SupabaseClient, 'auth'>;

/**
 * Session invité : réutilise la session stockée, sinon connexion anonyme.
 * Au premier lancement seulement, la connexion anonyme est créée ; elle est ensuite
 * conservée par le client (AsyncStorage) et rafraîchie automatiquement.
 * Si la session stockée est corrompue ou son jeton expiré/invalide, elle est purgée
 * proprement (signOut) et les données locales sont effacées pour réinitialiser
 * une session invité saine sans fuite de données de l'ancien compte.
 */
export async function assurerSessionInvite(client: ClientAuth): Promise<Session> {
  let sessionExistante: Session | null = null;
  try {
    const { data, error } = await client.auth.getSession();
    if (!error && data?.session) {
      sessionExistante = data.session;
    } else if (error) {
      console.warn('Session stockée invalide ou expirée, réinitialisation :', error.message);
      await client.auth.signOut().catch(() => {});
      await effacerDonneesLocales().catch(() => {});
    }
  } catch (err) {
    console.warn('Erreur lors de la lecture de la session :', err);
    await client.auth.signOut().catch(() => {});
    await effacerDonneesLocales().catch(() => {});
  }

  if (sessionExistante) return sessionExistante;

  const { data: connexion, error: erreurConnexion } = await client.auth.signInAnonymously();
  if (erreurConnexion) {
    // Si l'ancien stockage bloquait encore, tenter un signOut propre et réitérer une fois
    await client.auth.signOut().catch(() => {});
    const retry = await client.auth.signInAnonymously();
    if (retry.error) throw retry.error;
    if (!retry.data.session) throw new Error('La connexion anonyme n’a pas renvoyé de session.');
    suivre('session_invite_creee', {});
    return retry.data.session;
  }
  if (!connexion.session) throw new Error('La connexion anonyme n’a pas renvoyé de session.');
  suivre('session_invite_creee', {});
  return connexion.session;
}

