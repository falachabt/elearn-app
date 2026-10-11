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

export type DiagnosticPush = {
  actif: boolean;
  permissionAccordee: boolean;
  jeton: string | null;
  erreur: string | null;
};

/**
 * Diagnostic complet et enregistrement du jeton push (avec messages d'erreur clairs en Preview/Dev).
 */
export async function diagnostiquerEtEnregistrerPush(client: Client, options: { demander?: boolean } = {}): Promise<DiagnosticPush> {
  const demander = options.demander ?? true;
  if (Platform.OS === 'web') {
    return { actif: false, permissionAccordee: false, jeton: null, erreur: 'Push indisponible sur Web' };
  }
  try {
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      // Demander seulement quand l'élève vient de le décider (réglages, feuille de proposition) : jamais au démarrage.
      if (demander && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync();
      }
    }
    if (!permission.granted) {
      return { actif: false, permissionAccordee: false, jeton: null, erreur: 'Permission refusée dans les réglages du téléphone' };
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return { actif: false, permissionAccordee: true, jeton: null, erreur: 'EAS projectId non configuré' };
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PAR_DEFAUT, { name: CANAL_PAR_DEFAUT, importance: Notifications.AndroidImportance.DEFAULT });
    }
    let jeton: string | null = null;
    try {
      const res = await Notifications.getExpoPushTokenAsync({ projectId });
      jeton = res.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        actif: false,
        permissionAccordee: true,
        jeton: null,
        erreur: `Firebase/FCM manquant sur Android (${msg}). google-services.json requis dans le build.`,
      };
    }
    if (!jeton) {
      return { actif: false, permissionAccordee: true, jeton: null, erreur: 'Aucun jeton push renvoyé par Expo' };
    }
    const { data: ok, error } = await client.rpc('register_push_token', { p_token: jeton });
    if (error || ok === false) {
      return { actif: false, permissionAccordee: true, jeton, erreur: `RPC Supabase échoué: ${error?.message ?? 'inconnu'}` };
    }
    await AsyncStorage.setItem(CLE_JETON_PUSH, jeton);
    return { actif: true, permissionAccordee: true, jeton, erreur: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { actif: false, permissionAccordee: false, jeton: null, erreur: `Erreur inattendue: ${msg}` };
  }
}

/**
 * Enregistre le jeton push du téléphone sur le compte, sans jamais demander la permission (elle se demande au bon
 * moment, ailleurs). Ne lève jamais ; renvoie true quand le jeton est enregistré.
 */
export async function enregistrerJetonPush(client: Client): Promise<boolean> {
  const diag = await diagnostiquerEtEnregistrerPush(client, { demander: false });
  return diag.actif;
}
