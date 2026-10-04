import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import type { Solde } from './credits';
import { mefierNotificationReward, planifierNotificationRappelHebdo } from './rappels';
import { getSupabase } from './supabase';

type Client = Pick<SupabaseClient, 'rpc' | 'from'>;

export type ActionQuotidienne = 'site_web' | 'facebook' | 'instagram' | 'parrainage';

export type ConfigActionQuotidienne = {
  id: ActionQuotidienne;
  gain: number;
  url?: string;
  route?: string;
};

export const ACTIONS_QUOTIDIENNES: Record<ActionQuotidienne, ConfigActionQuotidienne> = {
  site_web: {
    id: 'site_web',
    gain: 10,
    url: 'https://elearnprepa.com',
  },
  facebook: {
    id: 'facebook',
    gain: 5,
    url: 'https://facebook.com/elearnprepa',
  },
  instagram: {
    id: 'instagram',
    gain: 5,
    url: 'https://instagram.com/elearnprepa',
  },
  parrainage: {
    id: 'parrainage',
    gain: 0,
    route: '/parrainage',
  },
};

const cleJour = (maintenant = new Date()) => {
  const a = maintenant.getFullYear();
  const m = String(maintenant.getMonth() + 1).padStart(2, '0');
  const j = String(maintenant.getDate()).padStart(2, '0');
  return `credits.actionsQuotidiennes.${a}-${m}-${j}`;
};

export type EtatActionsQuotidiennes = Record<ActionQuotidienne, boolean>;

/**
 * Renvoie l'état des actions effectuées pour le jour courant (true = accomplie aujourd'hui).
 */
export async function lireEtatActionsQuotidiennes(maintenant = new Date()): Promise<EtatActionsQuotidiennes> {
  const cle = cleJour(maintenant);
  try {
    const brut = await AsyncStorage.getItem(cle);
    if (!brut) return { site_web: false, facebook: false, instagram: false, parrainage: false };
    const stock = JSON.parse(brut) as Partial<EtatActionsQuotidiennes>;
    return {
      site_web: !!stock.site_web,
      facebook: !!stock.facebook,
      instagram: !!stock.instagram,
      parrainage: !!stock.parrainage,
    };
  } catch {
    return { site_web: false, facebook: false, instagram: false, parrainage: false };
  }
}

/**
 * Enregistre une action comme accomplie pour aujourd'hui.
 */
export async function enregistrerActionQuotidienne(action: ActionQuotidienne, maintenant = new Date()): Promise<void> {
  const cle = cleJour(maintenant);
  const courant = await lireEtatActionsQuotidiennes(maintenant);
  const maj = { ...courant, [action]: true };
  await AsyncStorage.setItem(cle, JSON.stringify(maj));
}

/**
 * Vrai si l'élève n'a pas de pass illimité et qu'au moins une action quotidienne (+5 ou +10) est disponible aujourd'hui.
 */
export async function aDesActionsDisponibles(solde: Solde | null, maintenant = new Date()): Promise<boolean> {
  if (solde?.illimite) return false;
  const etat = await lireEtatActionsQuotidiennes(maintenant);
  return !etat.site_web || !etat.facebook || !etat.instagram;
}

/**
 * Crédite les récompenses en base de données Supabase si possible (table credit_ledger et credit_balances via RPC ou fallback).
 */
export async function crediterRecompenseServeur(client: Client, actionCode: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('claim_daily_action', { p_action_code: actionCode });
    if (!error && data > 0) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Exécute une action quotidienne : ouvre le lien/route, crédite le solde si non faite aujourd'hui, etnotifie l'utilisateur.
 */
export async function executerActionQuotidienne(
  action: ActionQuotidienne,
  options: {
    client?: Client;
    utilisateurId?: string;
    onSucces?: (gain: number) => void;
    maintenant?: Date;
  } = {},
): Promise<boolean> {
  const maintenant = options.maintenant ?? new Date();
  const config = ACTIONS_QUOTIDIENNES[action];

  if (config.route) {
    router.push(config.route as never);
    return true;
  }

  const etat = await lireEtatActionsQuotidiennes(maintenant);

  if (config.url) {
    let targetUrl = config.url;
    if (action === 'site_web' && options.utilisateurId) {
      targetUrl = `${config.url}?token=${encodeURIComponent(options.utilisateurId)}`;
    }
    await Linking.openURL(targetUrl).catch(() => {});
  }

  // Si dj rclame aujourd'hui, on ouvre juste le lien sans r-attribuer de crdits.
  if (etat[action]) return false;

  if (config.gain > 0) {
    const client = options.client ?? getSupabase();
    if (options.utilisateurId) {
      const succes = await crediterRecompenseServeur(client, action);
      if (!succes) return false; // Dj rclam sur un autre appareil ou erreur serveur
    }
    await enregistrerActionQuotidienne(action, maintenant);
    await mefierNotificationReward(action, config.gain);
    options.onSucces?.(config.gain);
  } else {
    await enregistrerActionQuotidienne(action, maintenant);
  }

  return true;
}

/** Initialise la planification automatique des rappels récurrents (ex: lundi 08h). */
export function initialiserRappelsCrediting(): void {
  void planifierNotificationRappelHebdo().catch(() => {});
}
