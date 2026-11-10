import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import { estErreurReseau } from './connectivite';

type ClientAuth = Pick<SupabaseClient, 'auth'>;

/**
 * La session telle que le client l'a rangée dans son stockage (AsyncStorage), lue directement.
 *
 * `getSession()` la refuse quand le jeton d'accès est expiré et que le rafraîchissement échoue — faute de
 * réseau, au démarrage à froid hors ligne, c'est le cas normal, pas une session invalide. La version stockée
 * suffit pour retrouver l'identité du compte et toutes les copies gardées sur l'appareil (planning, coches,
 * XP, rangées sous l'identifiant) ; le client rafraîchira le jeton tout seul au retour du réseau, le jeton
 * de rafraîchissement reste valable bien plus longtemps que celui d'accès.
 */
async function lireSessionStockee(client: ClientAuth): Promise<Session | null> {
  const cle = (client.auth as unknown as { storageKey?: unknown }).storageKey;
  if (typeof cle !== 'string' || !cle) return null;
  try {
    const brut = await AsyncStorage.getItem(cle);
    if (!brut) return null;
    const session = JSON.parse(brut) as Session | null;
    return session?.user?.id && session?.refresh_token ? session : null;
  } catch {
    return null;
  }
}

/**
 * Session invité : réutilise la session stockée, sinon connexion anonyme.
 * Au premier lancement seulement, la connexion anonyme est créée ; elle est ensuite
 * conservée par le client (AsyncStorage) et rafraîchie automatiquement.
 *
 * Une erreur de `getSession()` ne veut pas toujours dire « session invalide » : hors ligne, le
 * rafraîchissement du jeton échoue et l'erreur est une erreur réseau. Réinitialiser dans ce cas
 * (l'ancien comportement) effaçait la session de l'appareil par `signOut` : au démarrage suivant,
 * l'app repartait sans identité et les copies locales du compte devenaient invisibles — retour
 * terrain du 23 octobre 2026, le planning « disparu » en mode avion quelques heures après la
 * connexion du matin (jeton d'accès d'une heure, expiré).
 */
export async function assurerSessionInvite(client: ClientAuth): Promise<Session> {
  let erreurSession: unknown = null;
  try {
    const { data, error } = await client.auth.getSession();
    if (data?.session) return data.session;
    erreurSession = error;
  } catch (e) {
    erreurSession = e;
  }

  if (erreurSession) {
    if (estErreurReseau(erreurSession)) {
      const stockee = await lireSessionStockee(client);
      if (stockee) return stockee;
      // Pas de session stockée à servir : la connexion anonyme ci-dessous décidera (elle échouera
      // hors ligne, et l'appelant basculera sur son repli, sans avoir rien effacé).
    } else {
      console.warn('Session stockée invalide ou expirée, réinitialisation :', erreurSession);
      await client.auth.signOut().catch(() => {});
    }
  }

  const { data: connexion, error: erreurConnexion } = await client.auth.signInAnonymously();
  if (erreurConnexion) throw erreurConnexion;
  if (!connexion.session) throw new Error('La connexion anonyme n’a pas renvoyé de session.');
  suivre('session_invite_creee', {});
  return connexion.session;
}
