import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Jeton de notifications push Expo (M9) : une fois la permission donnée, l'appareil donne son jeton au compte
 * (`register_push_token`) ; le serveur s'en sert pour prévenir l'élève (correction prête, réponses, crédits…).
 * Sur Android le jeton ne s'obtient que si le build contient le fichier Firebase (voir app.config.ts) : sans lui,
 * `getExpoPushTokenAsync` échoue, rien n'est enregistré et les rappels locaux restent la seule voie.
 */
export const CLE_JETON_PUSH = 'push.jetonEnregistre';
/** Canal Android utilisé par les notifications envoyées par le serveur (`channelId: "default"`). */
export const CANAL_PAR_DEFAUT = 'default';

type Client = Pick<SupabaseClient, 'rpc'>;

/** Vrai si un jeton push est enregistré pour ce téléphone (le push fonctionne : les rappels locaux de secours sont inutiles). */
export async function jetonPushActif(): Promise<boolean> {
  try {
    return !!(await AsyncStorage.getItem(CLE_JETON_PUSH));
  } catch {
    return false;
  }
}

/**
 * Enregistre le jeton push du téléphone sur le compte, sans jamais demander la permission (elle se demande au bon
 * moment, ailleurs). Ne lève jamais ; renvoie true quand le jeton est enregistré.
 */
export async function enregistrerJetonPush(client: Client): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PAR_DEFAUT, { name: CANAL_PAR_DEFAUT, importance: Notifications.AndroidImportance.DEFAULT });
    }
    const { data: jeton } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!jeton) return false;
    const { data: ok, error } = await client.rpc('register_push_token', { p_token: jeton });
    if (error || ok === false) return false;
    await AsyncStorage.setItem(CLE_JETON_PUSH, jeton);
    return true;
  } catch {
    return false;
  }
}
