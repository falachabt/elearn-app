import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { enregistrerJetonPush } from './push';

/**
 * Proposition d'autoriser les notifications (demande de Benny, 7 octobre 2026). La permission n'est plus demandée au
 * démarrage de l'app : elle est proposée une fois que l'élève a terminé une première mission, un quiz ou un chapitre,
 * dans une feuille du bas ; s'il accepte, le téléphone demande l'autorisation puis il arrive sur Paramètres, Notifications.
 *
 * Règles : jamais pour un invité ; jamais si la permission est déjà accordée, ou refusée pour de bon par le système ;
 * « Plus tard » ne se reproposera pas avant 7 jours ; une fois acceptée (ou refusée au téléphone), plus jamais.
 */
export const CLE_PROPOSITION = 'notifications.proposition';
export const DELAI_RELANCE_JOURS = 7;
const JOUR_MS = 24 * 60 * 60 * 1000;

type Etat = { statut: 'plus-tard' | 'terminee'; le: string };
type Client = Pick<SupabaseClient, 'rpc'>;

async function lireEtat(): Promise<Etat | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PROPOSITION);
    const e = brut ? (JSON.parse(brut) as Partial<Etat>) : null;
    return e && (e.statut === 'plus-tard' || e.statut === 'terminee') && typeof e.le === 'string' ? (e as Etat) : null;
  } catch {
    return null;
  }
}

/** Faut-il proposer la feuille maintenant ? À appeler seulement à la fin d'une mission, d'un quiz ou d'un chapitre. */
export async function doitProposerNotifications(p: { invite: boolean; maintenant?: Date }): Promise<boolean> {
  if (p.invite || Platform.OS === 'web') return false;
  const etat = await lireEtat();
  if (etat?.statut === 'terminee') return false;
  if (etat?.statut === 'plus-tard') {
    const ecoule = ((p.maintenant ?? new Date()).getTime() - new Date(etat.le).getTime()) / JOUR_MS;
    if (ecoule < DELAI_RELANCE_JOURS) return false;
  }
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return false;
    // Refusée pour de bon : le système ne redemandera plus, la feuille serait inutile (l'élève passe par les réglages du téléphone).
    if (permission.canAskAgain === false) return false;
  } catch {
    return false;
  }
  return true;
}

export async function noterPropositionPlusTard(maintenant = new Date()): Promise<void> {
  await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ statut: 'plus-tard', le: maintenant.toISOString() } satisfies Etat)).catch(() => {});
}

/**
 * « Autoriser » : demande la permission au téléphone puis donne le jeton push au compte. La proposition est terminée
 * dans tous les cas (acceptée ou refusée au téléphone) ; l'écran Notifications permet de choisir quoi recevoir.
 */
export async function accepterNotifications(client: Client, maintenant = new Date()): Promise<boolean> {
  let accordee = false;
  try {
    const reponse = await Notifications.requestPermissionsAsync();
    accordee = !!reponse.granted;
  } catch {
    accordee = false;
  }
  await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ statut: 'terminee', le: maintenant.toISOString() } satisfies Etat)).catch(() => {});
  if (accordee) await enregistrerJetonPush(client);
  return accordee;
}
