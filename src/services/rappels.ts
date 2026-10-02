import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { suivre } from './analytics';
import { TYPE_CORRECTION_PRETE } from './photoNotification';

/** Heure du rappel quotidien par défaut (M9-01 : 19 h–21 h, heure locale). */
export const HEURE_RAPPEL = 19;
export const CLE_RAPPEL = 'rappel.notification';
export const CLE_RAPPEL_COMPTE = 'rappel.compte';
export const CLE_PREMIERE_OUVERTURE = 'rappel.premiereOuverture';

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Après « Pas maintenant », on ne redemande pas avant ce délai. */
export const DELAI_REPROPOSER_JOURS = 3;
/** Le rappel de compte d'invité n'apparaît qu'après ce délai depuis la première ouverture, et au plus ce nombre de fois. */
export const DELAI_RAPPEL_COMPTE_JOURS = 2;
export const MAX_RAPPELS_COMPTE = 4;

type EtatRappel = { statut: 'actif' | 'refuse' | 'plus-tard'; le: string; heure?: number };
type EtatRappelCompte = { vus: number; le: string };

async function lireJson<T>(cle: string): Promise<T | null> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}

const joursDepuis = (iso: string, maintenant: Date) => (maintenant.getTime() - new Date(iso).getTime()) / JOUR_MS;

/** Faut-il proposer le rappel quotidien ? Non s'il est actif, refusé par le système, ou reporté récemment. */
export async function doitProposerRappel(maintenant = new Date()): Promise<boolean> {
  const etat = await lireJson<EtatRappel>(CLE_RAPPEL);
  if (!etat) return true;
  if (etat.statut === 'plus-tard') return joursDepuis(etat.le, maintenant) >= DELAI_REPROPOSER_JOURS;
  return false;
}

export async function reporterRappel(maintenant = new Date()): Promise<void> {
  await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'plus-tard', le: maintenant.toISOString() } satisfies EtatRappel));
  suivre('notification_prompt_answered', { choix: 'plus_tard' });
}

export type TextesRappel = { titre: string; corps: string; canal: string };

/**
 * Demande la permission puis programme une notification locale chaque jour à `heure` (une seule par jour).
 * Renvoie false si l'élève refuse dans la fenêtre du système.
 */
export async function activerRappel(textes: TextesRappel, heure = HEURE_RAPPEL, maintenant = new Date()): Promise<boolean> {
  const existant = await Notifications.getPermissionsAsync();
  const reponse = existant.granted ? existant : await Notifications.requestPermissionsAsync();
  if (!reponse.granted) {
    await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'refuse', le: maintenant.toISOString() } satisfies EtatRappel));
    suivre('notification_prompt_answered', { choix: 'refuse' });
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rappels', { name: textes.canal, importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: textes.titre, body: textes.corps, data: { type: 'rappel_mission' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: heure, minute: 0, channelId: 'rappels' },
  });
  await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'actif', le: maintenant.toISOString(), heure } satisfies EtatRappel));
  suivre('notification_prompt_answered', { choix: 'accepte' });
  return true;
}

/** État du rappel quotidien pour Paramètres (H2) : actif ou non, et son heure. */
export async function lireRappel(): Promise<{ actif: boolean; heure: number }> {
  const etat = await lireJson<EtatRappel>(CLE_RAPPEL);
  return { actif: etat?.statut === 'actif', heure: etat?.heure ?? HEURE_RAPPEL };
}

/** Coupe le rappel quotidien depuis Paramètres : plus de notification programmée, et on ne le repropose plus. */
export async function desactiverRappel(maintenant = new Date()): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Rien de programmé (web, permission jamais donnée).
  }
  await AsyncStorage.setItem(CLE_RAPPEL, JSON.stringify({ statut: 'refuse', le: maintenant.toISOString() } satisfies EtatRappel));
  suivre('notification_setting_changed', { rappel: false });
}

/** Suit l'ouverture des notifications (M9, `notification_opened`). Renvoie la fonction d'arrêt. */
export function suivreOuvertures(): () => void {
  const abonnement = Notifications.addNotificationResponseReceivedListener((r) => {
    const type = r.notification.request.content.data?.type;
    suivre('notification_opened', { type: typeof type === 'string' ? type : 'inconnu' });
    // Correction par photo prête : l'historique s'ouvre sur l'onglet Photo.
    if (type === TYPE_CORRECTION_PRETE) router.push({ pathname: '/photo', params: { historique: '1' } });
  });
  return () => abonnement.remove();
}

/** Note la première ouverture de l'application (base du rappel de compte d'invité). */
export async function noterPremiereOuverture(maintenant = new Date()): Promise<string> {
  const deja = await AsyncStorage.getItem(CLE_PREMIERE_OUVERTURE).catch(() => null);
  if (deja) return deja;
  const iso = maintenant.toISOString();
  await AsyncStorage.setItem(CLE_PREMIERE_OUVERTURE, iso).catch(() => {});
  return iso;
}

/**
 * Rappel à l'invité de lier un compte : après quelques jours d'usage, s'il a déjà de la progression à perdre,
 * au plus une fois tous les quelques jours et quelques fois en tout.
 */
export async function doitRappelerCompte(p: { invite: boolean; aProgression: boolean }, maintenant = new Date()): Promise<boolean> {
  const premiere = await noterPremiereOuverture(maintenant);
  if (!p.invite || !p.aProgression) return false;
  if (joursDepuis(premiere, maintenant) < DELAI_RAPPEL_COMPTE_JOURS) return false;
  const etat = await lireJson<EtatRappelCompte>(CLE_RAPPEL_COMPTE);
  if (!etat) return true;
  return etat.vus < MAX_RAPPELS_COMPTE && joursDepuis(etat.le, maintenant) >= DELAI_REPROPOSER_JOURS;
}

export async function noterRappelCompte(maintenant = new Date()): Promise<void> {
  const etat = await lireJson<EtatRappelCompte>(CLE_RAPPEL_COMPTE);
  await AsyncStorage.setItem(CLE_RAPPEL_COMPTE, JSON.stringify({ vus: (etat?.vus ?? 0) + 1, le: maintenant.toISOString() } satisfies EtatRappelCompte));
}
