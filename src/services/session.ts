import type { Session, SupabaseClient } from '@supabase/supabase-js';

type ClientAuth = Pick<SupabaseClient, 'auth'>;

/**
 * Session invité : réutilise la session stockée, sinon connexion anonyme.
 * Au premier lancement seulement, la connexion anonyme est créée ; elle est ensuite
 * conservée par le client (AsyncStorage) et rafraîchie automatiquement.
 */
export async function assurerSessionInvite(client: ClientAuth): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const { data: connexion, error: erreurConnexion } = await client.auth.signInAnonymously();
  if (erreurConnexion) throw erreurConnexion;
  if (!connexion.session) throw new Error('La connexion anonyme n’a pas renvoyé de session.');
  return connexion.session;
}
