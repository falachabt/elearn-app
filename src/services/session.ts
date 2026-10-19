import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';

type ClientAuth = Pick<SupabaseClient, 'auth'>;

/**
 * Session invité : réutilise la session stockée, sinon connexion anonyme.
 * Au premier lancement seulement, la connexion anonyme est créée ; elle est ensuite
 * conservée par le client (AsyncStorage) et rafraîchie automatiquement.
 * Si la session stockée est corrompue ou son jeton expiré/invalide, elle est purgée
 * proprement (signOut) pour réinitialiser une session invité saine sans bloquer l'application.
 * Les données locales (cours, exercices hors-ligne, copies locales) sont impérativement
 * conservées afin de ne jamais compromettre le travail et les révisions hors-ligne de l'élève.
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
    }
  } catch (err) {
    console.warn('Erreur lors de la lecture de la session :', err);
    await client.auth.signOut().catch(() => {});
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

