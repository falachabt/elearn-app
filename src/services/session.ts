import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';

type ClientAuth = Pick<SupabaseClient, 'auth'>;

/**
 * Session invité : réutilise la session stockée, sinon connexion anonyme.
 * Au premier lancement seulement, la connexion anonyme est créée ; elle est ensuite
 * conservée par le client (AsyncStorage) et rafraîchie automatiquement.
 */
export async function assurerSessionInvite(client: ClientAuth): Promise<Session> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('Session stockée invalide ou expirée, réinitialisation :', error);
      await client.auth.signOut().catch(() => {});
    } else if (data?.session) {
      return data.session;
    }
  } catch (e) {
    console.warn('Erreur lors de la récupération de la session stockée :', e);
    await client.auth.signOut().catch(() => {});
  }

  const { data: connexion, error: erreurConnexion } = await client.auth.signInAnonymously();
  if (erreurConnexion) throw erreurConnexion;
  if (!connexion.session) throw new Error('La connexion anonyme n’a pas renvoyé de session.');
  suivre('session_invite_creee', {});
  return connexion.session;
}
