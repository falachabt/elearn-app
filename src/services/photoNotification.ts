import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { enregistrerJetonPush, jetonPushActif } from './push';
import { getSupabase } from './supabase';

/**
 * Rappel de fin de correction (M3) : à l'envoi d'une photo, une notification locale est programmée juste après le temps
 * habituel de l'IA. Si la correction arrive pendant que l'élève est dans l'application, elle est annulée. S'il est parti,
 * elle le prévient. Cette voie ne demande ni Firebase ni connexion : la correction, elle, est enregistrée par le
 * serveur même si l'application est fermée. Quand le push fonctionne (jeton enregistré, build avec Firebase), le
 * serveur prévient lui-même un élève parti : le rappel programmé est alors inutile et n'est pas créé.
 */
export const DELAI_NOTIFICATION_S = 35;
export const CLE_REFUS_NOTIFICATION = 'photo.notificationRefusee';
export const CANAL_CORRECTIONS = 'corrections';
export const TYPE_CORRECTION_PRETE = 'photo_ready';

export type TextesNotification = { titre: string; corps: string; canal: string };

/**
 * Programme le rappel. Demande la permission au premier envoi seulement ; un refus est retenu (on ne redemande pas).
 * Renvoie l'identifiant à annuler, ou null (refus, web, erreur : jamais bloquant pour l'envoi).
 */
export async function programmerCorrectionPrete(textes: TextesNotification, photoId?: string): Promise<string | null> {
  try {
    if (await jetonPushActif()) return null;
    if (await AsyncStorage.getItem(CLE_REFUS_NOTIFICATION)) return null;
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) return null;
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      await AsyncStorage.setItem(CLE_REFUS_NOTIFICATION, '1').catch(() => {});
      return null;
    }
    // Permission donnée : le téléphone donne son jeton au compte. Enregistré (push possible), le serveur prévient seul.
    if (await enregistrerJetonPush(getSupabase())) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_CORRECTIONS, { name: textes.canal, importance: Notifications.AndroidImportance.DEFAULT });
    }
    return await Notifications.scheduleNotificationAsync({
      content: { title: textes.titre, body: textes.corps, data: { type: TYPE_CORRECTION_PRETE, ...(photoId ? { photoId } : {}) } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: DELAI_NOTIFICATION_S, channelId: CANAL_CORRECTIONS },
    });
  } catch {
    return null;
  }
}

/** Annule le rappel (la correction est arrivée dans l'application). Ne lève jamais. */
export async function annulerCorrectionPrete(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // déjà passée ou inconnue
  }
}

/** Prévient tout de suite : la correction vient d'arriver pendant que l'application était en arrière-plan. Ne lève jamais. */
export async function notifierCorrectionPrete(textes: TextesNotification, photoId?: string): Promise<void> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_CORRECTIONS, { name: textes.canal, importance: Notifications.AndroidImportance.DEFAULT });
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: textes.titre, body: textes.corps, data: { type: TYPE_CORRECTION_PRETE, ...(photoId ? { photoId } : {}) } },
      trigger: null,
    });
  } catch {
    // pas de notification : la correction reste dans l'historique
  }
}
