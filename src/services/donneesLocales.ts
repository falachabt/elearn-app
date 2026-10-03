import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { effacerDocuments } from './documents';
import { oublierEtatsMemorises } from './memoire';
import { CLE_HISTORIQUE } from './mission';
import { repriseInviteEnCours } from './repriseInvite';
import { oublierCopiesEnMemoire } from './reviser';

const CLE_REPRISE_INVITEE = 'compte.repriseInvite';

/**
 * Efface du téléphone tout ce qui appartient à l'élève (progression, profil, mission, réglages, copies hors ligne) pour
 * que la personne suivante trouve l'app neuve (M2-14). La session Supabase est gérée à part par le client.
 */
async function effacerDonneesLocalesEnGardant(clesGardees: readonly string[]): Promise<void> {
  const cles = await AsyncStorage.getAllKeys();
  const gardees = new Set(clesGardees);
  await AsyncStorage.multiRemove(cles.filter((c) => !c.startsWith('sb-') && !gardees.has(c)));
  effacerDocuments();
  oublierEtatsMemorises();
  oublierCopiesEnMemoire();
}

export function effacerDonneesLocales(): Promise<void> {
  return effacerDonneesLocalesEnGardant([]);
}

/** Refus de reprise : efface la progression invitée, mais garde le marqueur tant que le compte n'est pas réinitialisé. */
export function effacerDonneesInviteesLocales(): Promise<void> {
  return effacerDonneesLocalesEnGardant([CLE_REPRISE_INVITEE]);
}

/** Après une connexion : les jours de mission du compte reviennent sur le téléphone, pour retrouver sa série. */
export async function restaurerHistorique(client: Pick<SupabaseClient, 'from'>, forcer = false): Promise<string[]> {
  const brut = await AsyncStorage.getItem(CLE_HISTORIQUE);
  const locaux: string[] = brut ? JSON.parse(brut) : [];
  if (!forcer && repriseInviteEnCours()) return locaux;
  const { data, error } = await client.from('mission_runs').select('day');
  if (error) throw error;
  const jours = [...new Set([...locaux, ...((data ?? []) as { day: string }[]).map((l) => l.day)])].sort().slice(-400);
  await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(jours));
  return jours;
}
