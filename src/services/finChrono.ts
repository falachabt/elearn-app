import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Fin d'un compte à rebours d'ancien sujet : notification locale à l'échéance, pour l'élève dont l'application est en
 * arrière-plan. Ne demande jamais la permission (AGENTS §18) : sans elle, rien n'est programmé. Ne lève jamais.
 */
export const CANAL_CHRONO = 'chrono';
export const TYPE_FIN_CHRONO = 'annale_chrono_fin';
export const DUREE_MIN_NOTIFICATION_S = 5;

export type TextesFinChrono = { titre: string; corps: string; canal: string };

/** Programme la notification dans `secondes` ; renvoie l'identifiant à annuler, ou null. */
export async function programmerFinChrono(secondes: number, textes: TextesFinChrono): Promise<string | null> {
  if (Platform.OS === 'web' || !Number.isFinite(secondes) || secondes < DUREE_MIN_NOTIFICATION_S) return null;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_CHRONO, { name: textes.canal, importance: Notifications.AndroidImportance.HIGH });
    }
    return await Notifications.scheduleNotificationAsync({
      content: { title: textes.titre, body: textes.corps, data: { type: TYPE_FIN_CHRONO } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(secondes), channelId: CANAL_CHRONO },
    });
  } catch {
    return null;
  }
}

/** Annule la notification (le temps est écoulé à l'écran, le chrono a été relancé ou l'élève a quitté). */
export async function annulerFinChrono(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // déjà passée ou inconnue
  }
}
