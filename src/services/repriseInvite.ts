import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { usePathname } from 'expo-router';
import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const CLE_REPRISE = 'compte.repriseInvite';
const CLE_JETON_INVITE = 'compte.repriseInvite.jeton';

type EtatReprise = { inviteId: string; etat: 'oauth' | 'a-confirmer'; compteId?: string };
export type RepriseInvite = EtatReprise & { jetonRafraichissementInvite: string };

let repriseActive = false;
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export function abonnerRepriseInvite(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function repriseInviteEnCours(): boolean {
  return repriseActive;
}

export function useRepriseInviteEnCours(): boolean {
  const pathname = usePathname();
  const active = useSyncExternalStore(abonnerRepriseInvite, repriseInviteEnCours, () => false);
  return active || pathname === '/compte/reprise';
}

export async function progressionInviteeLocalePresente(): Promise<boolean> {
  const cles = new Set(await AsyncStorage.getAllKeys());
  return [
    'miniTest.resultat',
    'mission.historique',
    'mission.dernier',
    'mission.erreurs',
    'reviser.lues',
    'entrainement.scores',
    'entrainement.exercicesFaits',
    'entrainement.sessions',
    'profil.arrivee',
  ].some((cle) => cles.has(cle));
}

export async function reprendreApresRedemarrage(compteId: string): Promise<boolean> {
  const brut = await AsyncStorage.getItem(CLE_REPRISE).catch(() => null);
  if (!brut) {
    repriseActive = false;
    notifier();
    return false;
  }
  let etat: EtatReprise;
  try {
    etat = JSON.parse(brut) as EtatReprise;
  } catch {
    await effacerRepriseInvite();
    return false;
  }
  if (!etat.inviteId || (etat.etat !== 'oauth' && etat.etat !== 'a-confirmer')) {
    await effacerRepriseInvite();
    return false;
  }
  if (etat.etat === 'a-confirmer' && !etat.compteId) {
    await effacerRepriseInvite();
    return false;
  }
  if (etat.etat === 'oauth') {
    if (etat.inviteId === compteId || !(await SecureStore.getItemAsync(CLE_JETON_INVITE))) {
      await effacerRepriseInvite();
      return false;
    }
    await AsyncStorage.setItem(CLE_REPRISE, JSON.stringify({ ...etat, etat: 'a-confirmer', compteId } satisfies EtatReprise));
  }
  repriseActive = true;
  notifier();
  return true;
}

export async function preparerRepriseInvite(inviteId: string, jetonRafraichissementInvite: string): Promise<void> {
  await SecureStore.setItemAsync(CLE_JETON_INVITE, jetonRafraichissementInvite);
  try {
    await AsyncStorage.setItem(CLE_REPRISE, JSON.stringify({ inviteId, etat: 'oauth' } satisfies EtatReprise));
  } catch (e) {
    await SecureStore.deleteItemAsync(CLE_JETON_INVITE);
    throw e;
  }
}

export async function terminerOAuthRepriseInvite(inviteId: string, compteId: string): Promise<boolean> {
  if (inviteId === compteId) {
    await effacerRepriseInvite();
    return false;
  }
  const etat: EtatReprise = { inviteId, compteId, etat: 'a-confirmer' };
  await AsyncStorage.setItem(CLE_REPRISE, JSON.stringify(etat));
  repriseActive = true;
  notifier();
  return true;
}

export async function annulerOAuthRepriseInvite(): Promise<void> {
  const brut = await AsyncStorage.getItem(CLE_REPRISE).catch(() => null);
  if (!brut) return;
  try {
    if ((JSON.parse(brut) as Partial<EtatReprise>).etat === 'oauth') await effacerRepriseInvite();
  } catch {
    await effacerRepriseInvite();
  }
}

export async function lireRepriseInvite(): Promise<RepriseInvite | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_REPRISE);
    if (!brut) return null;
    const etat = JSON.parse(brut) as EtatReprise;
    const jetonRafraichissementInvite = await SecureStore.getItemAsync(CLE_JETON_INVITE);
    return etat.etat === 'a-confirmer' && etat.compteId && jetonRafraichissementInvite ? { ...etat, jetonRafraichissementInvite } : null;
  } catch {
    return null;
  }
}

export async function transfererProgressionInvitee(client: Pick<SupabaseClient, 'functions'>, garder: boolean): Promise<void> {
  const reprise = await lireRepriseInvite();
  if (!reprise) throw new Error('La session invitée nécessaire à la reprise n’est plus disponible.');
  const { data, error } = await client.functions.invoke('transfer-guest-progress', {
    body: { action: garder ? 'garder' : 'effacer', guest_refresh_token: reprise.jetonRafraichissementInvite },
  });
  if (typeof data?.guest_refresh_token === 'string') {
    await SecureStore.setItemAsync(CLE_JETON_INVITE, data.guest_refresh_token);
  }
  if (error) throw error;
  if (!data?.ok) throw new Error('Le serveur n’a pas confirmé le transfert de progression.');
}

export async function verifierRepriseInvitee(
  client: Pick<SupabaseClient, 'functions'>,
  progressionLocale: boolean,
): Promise<boolean> {
  const reprise = await lireRepriseInvite();
  if (!reprise) throw new Error('La session invitée nécessaire à la reprise n’est plus disponible.');
  const { data, error } = await client.functions.invoke('transfer-guest-progress', {
    body: {
      action: 'verifier',
      guest_refresh_token: reprise.jetonRafraichissementInvite,
      progression_locale: progressionLocale,
    },
  });
  if (typeof data?.guest_refresh_token === 'string') {
    await SecureStore.setItemAsync(CLE_JETON_INVITE, data.guest_refresh_token);
  }
  if (error) throw error;
  if (!data?.ok || typeof data.has_progress !== 'boolean') throw new Error('Le serveur n’a pas pu vérifier la progression invitée.');
  return data.has_progress;
}

export async function effacerRepriseInvite(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(CLE_REPRISE), SecureStore.deleteItemAsync(CLE_JETON_INVITE)]);
  repriseActive = false;
  notifier();
}
