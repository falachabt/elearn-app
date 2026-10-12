import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { identifiantAppareil } from './credits';

type Client = Pick<SupabaseClient, 'rpc' | 'channel' | 'removeChannel'>;

export const CLE_SESSION_EPOCH = 'auth.sessionEpoch';

export type StatutSessionAppareil = 'allowed' | 'same_device' | 'limit_reached' | 'anonymous';

export type ResultatAppareilActif = {
  statut: StatutSessionAppareil;
  deviceHash: string | null;
  sessionEpoch: string | null;
  changementsMois: number;
  changementsRestants: number;
  prochaineReinitialisation: string | null;
};

type LigneRpc = {
  status: StatutSessionAppareil;
  device_hash: string | null;
  session_epoch: string | null;
  monthly_changes_count: number;
  monthly_changes_left: number;
  next_reset_at: string | null;
};

/**
 * Enregistre cet appareil auprès du serveur comme appareil actif unique pour ce compte (issue #26).
 * Renvoie le statut d'autorisation et le quota mensuel.
 */
export async function enregistrerAppareilActif(client: Client): Promise<ResultatAppareilActif> {
  const appareil = await identifiantAppareil();
  const { data, error } = await client.rpc('register_active_device', { p_device: appareil });
  if (error) throw error;
  const l = (data as LigneRpc[] | LigneRpc | null);
  const ligne: LigneRpc = Array.isArray(l) ? l[0] : (l as LigneRpc);
  if (!ligne) throw new Error('Réponse vide lors de l’enregistrement de l’appareil');

  if (ligne.session_epoch) {
    await AsyncStorage.setItem(CLE_SESSION_EPOCH, ligne.session_epoch).catch(() => {});
  }

  return {
    statut: ligne.status,
    deviceHash: ligne.device_hash,
    sessionEpoch: ligne.session_epoch,
    changementsMois: ligne.monthly_changes_count,
    changementsRestants: ligne.monthly_changes_left,
    prochaineReinitialisation: ligne.next_reset_at,
  };
}

/**
 * Vérifie si cet appareil est toujours l'appareil actif autorisé côté serveur.
 */
export async function verifierAppareilActif(client: Client): Promise<boolean> {
  const appareil = await identifiantAppareil();
  const epoch = await AsyncStorage.getItem(CLE_SESSION_EPOCH).catch(() => null);
  const { data, error } = await client.rpc('check_active_device', {
    p_device: appareil,
    p_session_epoch: epoch ?? undefined,
  });
  if (error) throw error;
  return data === true;
}

/**
 * S'abonne aux changements d'appareil actif de l'élève en temps réel.
 * Si un autre appareil s'enregistre, surInvalide est appelée immédiatement.
 */
export function suivreAppareilActif(
  client: Client,
  utilisateur: string,
  surInvalide: () => void,
): () => void {
  const canal = client
    .channel(`active_device:${utilisateur}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_active_devices', filter: `user_id=eq.${utilisateur}` },
      async (charge) => {
        const nouvelle = charge.new as { session_epoch?: string } | undefined;
        const monEpoch = await AsyncStorage.getItem(CLE_SESSION_EPOCH).catch(() => null);
        if (nouvelle?.session_epoch && monEpoch && nouvelle.session_epoch !== monEpoch) {
          surInvalide();
        }
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(canal);
  };
}
