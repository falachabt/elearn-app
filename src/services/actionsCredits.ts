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

/**
 * Le jour des actions est celui du serveur (Africa/Douala, UTC+1 sans heure d'été) : c'est lui qui décide si une
 * action est déjà réclamée (`claim_daily_action`). Le jour du téléphone peut différer, donc on ne s'en sert pas.
 */
export const jourServeur = (maintenant = new Date()): string => new Date(maintenant.getTime() + 3600000).toISOString().slice(0, 10);

/** Clé locale du jour, rangée par élève : un autre compte sur le même téléphone ne voit pas les actions du premier. */
const cleJour = (maintenant = new Date(), utilisateurId?: string) =>
  `credits.actionsQuotidiennes.${utilisateurId ? `${utilisateurId}.` : ''}${jourServeur(maintenant)}`;

export type EtatActionsQuotidiennes = Record<ActionQuotidienne, boolean>;

/** Ce qu'il faut pour interroger le serveur : le client et l'élève connecté (sans compte, l'état reste local). */
export type SourceServeur = { client?: Client; utilisateurId?: string };

const ETAT_VIDE: EtatActionsQuotidiennes = { site_web: false, facebook: false, instagram: false, parrainage: false };

async function lireEtatLocal(maintenant: Date, utilisateurId?: string): Promise<EtatActionsQuotidiennes> {
  try {
    const brut = await AsyncStorage.getItem(cleJour(maintenant, utilisateurId));
    if (!brut) return { ...ETAT_VIDE };
    const stock = JSON.parse(brut) as Partial<EtatActionsQuotidiennes>;
    return {
      site_web: !!stock.site_web,
      facebook: !!stock.facebook,
      instagram: !!stock.instagram,
      parrainage: !!stock.parrainage,
    };
  } catch {
    return { ...ETAT_VIDE };
  }
}

/** Actions déjà réclamées aujourd'hui selon le serveur (table `daily_reward_claims`, lisible par l'élève). */
export async function lireActionsReclameesServeur(client: Client, maintenant = new Date()): Promise<ActionQuotidienne[]> {
  const { data, error } = await client.from('daily_reward_claims').select('action_code').eq('claim_date', jourServeur(maintenant));
  if (error) throw error;
  return ((data ?? []) as { action_code: string }[])
    .map((l) => l.action_code)
    .filter((c): c is ActionQuotidienne => c === 'site_web' || c === 'facebook' || c === 'instagram' || c === 'parrainage');
}

/**
 * Renvoie l'état des actions effectuées pour le jour courant (true = accomplie aujourd'hui). Avec un compte connecté,
 * le serveur fait foi : une action déjà réclamée l'est aussi après une déconnexion, sur un autre téléphone ou après
 * un effacement des données. Hors ligne, on garde ce que le téléphone sait.
 */
export async function lireEtatActionsQuotidiennes(maintenant = new Date(), source: SourceServeur = {}): Promise<EtatActionsQuotidiennes> {
  const local = await lireEtatLocal(maintenant, source.utilisateurId);
  if (!source.utilisateurId) return local;
  try {
    // Sans client donné, celui de l'app : s'il n'est pas configuré, on reste sur l'état du téléphone.
    const reclamees = await lireActionsReclameesServeur(source.client ?? getSupabase(), maintenant);
    if (reclamees.every((a) => local[a])) return local;
    const fusion = { ...local };
    for (const a of reclamees) fusion[a] = true;
    // Gardé sur le téléphone : l'état reste juste hors ligne.
    await AsyncStorage.setItem(cleJour(maintenant, source.utilisateurId), JSON.stringify(fusion)).catch(() => {});
    return fusion;
  } catch {
    return local;
  }
}

/**
 * Enregistre une action comme accomplie pour aujourd'hui.
 */
export async function enregistrerActionQuotidienne(action: ActionQuotidienne, maintenant = new Date(), utilisateurId?: string): Promise<void> {
  const courant = await lireEtatLocal(maintenant, utilisateurId);
  await AsyncStorage.setItem(cleJour(maintenant, utilisateurId), JSON.stringify({ ...courant, [action]: true }));
}

/**
 * Vrai si l'élève n'a pas de pass illimité et qu'au moins une action quotidienne (+5 ou +10) est disponible aujourd'hui.
 */
export async function aDesActionsDisponibles(solde: Solde | null, maintenant = new Date(), source: SourceServeur = {}): Promise<boolean> {
  if (solde?.illimite) return false;
  const etat = await lireEtatActionsQuotidiennes(maintenant, source);
  return !etat.site_web || !etat.facebook || !etat.instagram;
}

export type ResultatReclamation = 'credite' | 'deja' | 'erreur';

/**
 * Réclame les crédits d'une action auprès du serveur : `credite` (gain versé), `deja` (le serveur l'a déjà donnée
 * aujourd'hui, sur cet appareil ou un autre) ou `erreur` (réseau, serveur : on pourra réessayer).
 */
export async function reclamerActionServeur(client: Client, actionCode: string): Promise<ResultatReclamation> {
  try {
    const { data, error } = await client.rpc('claim_daily_action', { p_action_code: actionCode });
    if (error) return 'erreur';
    return Number(data) > 0 ? 'credite' : 'deja';
  } catch {
    return 'erreur';
  }
}

/** Version booléenne : vrai seulement si le gain vient d'être versé. */
export async function crediterRecompenseServeur(client: Client, actionCode: string): Promise<boolean> {
  return (await reclamerActionServeur(client, actionCode)) === 'credite';
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
    /** Le serveur dit que l'action a déjà été réclamée aujourd'hui : l'écran doit l'afficher comme faite. */
    onDejaFait?: () => void;
    maintenant?: Date;
  } = {},
): Promise<boolean> {
  const maintenant = options.maintenant ?? new Date();
  const config = ACTIONS_QUOTIDIENNES[action];

  if (config.route) {
    router.push(config.route as never);
    return true;
  }

  const client = options.client ?? getSupabase();
  const etat = await lireEtatActionsQuotidiennes(maintenant, options.utilisateurId ? { client, utilisateurId: options.utilisateurId } : {});

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
    if (options.utilisateurId) {
      const resultat = await reclamerActionServeur(client, action);
      // Erreur réseau ou serveur : rien n'est marqué, l'élève pourra réessayer.
      if (resultat === 'erreur') return false;
      // Déjà donnée aujourd'hui (autre appareil, session précédente) : l'action est faite, aucun crédit de plus.
      if (resultat === 'deja') {
        await enregistrerActionQuotidienne(action, maintenant, options.utilisateurId);
        options.onDejaFait?.();
        return false;
      }
    }
    await enregistrerActionQuotidienne(action, maintenant, options.utilisateurId);
    await mefierNotificationReward(action, config.gain);
    options.onSucces?.(config.gain);
  } else {
    await enregistrerActionQuotidienne(action, maintenant, options.utilisateurId);
  }

  return true;
}

/** Initialise la planification automatique des rappels récurrents (ex: lundi 08h). */
export function initialiserRappelsCrediting(): void {
  void planifierNotificationRappelHebdo().catch(() => {});
}
