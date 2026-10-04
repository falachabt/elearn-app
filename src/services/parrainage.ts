import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Share } from 'react-native';

import { suivre } from './analytics';

/** Rattachement au parrain (M15) : on conserve le code 7 jours sur le téléphone, sans aucune récompense à ce stade. */
export const CLE_PARRAINAGE = 'parrainage.code';
export const CLE_CODE_PARRAIN_INVITE = 'parrainage.codeInvite';
export const DUREE_CONSERVATION_MS = 7 * 24 * 60 * 60 * 1000;

type Source = 'lien' | 'saisie';
type Conserve = { code: string; capturedAt: number };
type Client = Pick<SupabaseClient, 'rpc'>;

export type JalonParrainage = {
  id: string;
  referrals_needed: number;
  reward_type: string;
  reward_value: number;
  label_fr: string;
  label_en: string;
  unlocked: boolean;
  claimed: boolean;
};

export type StatsParrainage = {
  code: string;
  liensCliques: number;
  comptesCrees: number;
  passAchetes: number;
  creditsGagnes: number;
  jalons: JalonParrainage[];
};

/** Code propre : majuscules, sans espaces ni tirets, 4 à 12 lettres ou chiffres. `null` si invalide. */
export function normaliserCode(brut?: string | null): string | null {
  const code = (brut ?? '').replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

/** Lit le code d'un lien profond : `elearnprepa://rejoindre/<code>`, `https://…/rejoindre/<code>` ou `?ref=<code>`. */
export function extraireCodeDepuisUrl(url?: string | null): string | null {
  if (!url) return null;
  const chemin = /\/rejoindre\/([^/?#]+)/i.exec(url);
  const ref = /[?&]ref=([^&#]+)/i.exec(url);
  const brut = chemin?.[1] ?? ref?.[1];
  if (!brut) return null;
  try {
    return normaliserCode(decodeURIComponent(brut));
  } catch {
    return null;
  }
}

/** Mémorise le code pour 7 jours (un nouveau code remplace l'ancien). Renvoie le code normalisé, ou `null` si invalide. */
export async function conserverCode(brut: string, source: Source, maintenant = Date.now()): Promise<string | null> {
  const code = normaliserCode(brut);
  if (!code) return null;
  try {
    await AsyncStorage.setItem(CLE_PARRAINAGE, JSON.stringify({ code, capturedAt: maintenant } satisfies Conserve));
  } catch {
    // Non mémorisé : le code reste utilisable pour cette saisie.
  }
  suivre('referral_code_captured', { source });
  return code;
}

/** Capte le code d'un lien profond et le mémorise. `null` si le lien n'en contient pas. */
export async function capturerDepuisUrl(url?: string | null, maintenant = Date.now()): Promise<string | null> {
  const code = extraireCodeDepuisUrl(url);
  return code ? conserverCode(code, 'lien', maintenant) : null;
}

/** Code mémorisé s'il a moins de 7 jours ; un code expiré ou illisible est effacé. */
export async function lireCodeValide(maintenant = Date.now()): Promise<string | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PARRAINAGE);
    if (!brut) return null;
    const lu = JSON.parse(brut) as Partial<Conserve>;
    const code = normaliserCode(lu.code);
    if (code && typeof lu.capturedAt === 'number' && maintenant - lu.capturedAt < DUREE_CONSERVATION_MS && maintenant >= lu.capturedAt) return code;
    await AsyncStorage.removeItem(CLE_PARRAINAGE);
  } catch {
    // Stockage indisponible ou JSON illisible : pas de code.
  }
  return null;
}

export async function effacerCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLE_PARRAINAGE);
  } catch {
    // ignoré
  }
}

/**
 * Récupère ou génère le code parrain unique de l'utilisateur connecté (M15).
 */
export async function obtenirMonCode(client: Client): Promise<string> {
  const { data, error } = await client.rpc('get_my_referral_code');
  if (error || typeof data !== 'string') {
    throw new Error(error?.message ?? 'Impossible de récupérer le code parrain');
  }
  return data;
}

/**
 * Charge les statistiques complètes de parrainage pour l'écran principal.
 */
export async function chargerStatsParrainage(client: Client): Promise<StatsParrainage> {
  const { data, error } = await client.rpc('get_referral_stats');
  if (error || !data || typeof data !== 'object') {
    throw new Error(error?.message ?? 'Impossible de charger les statistiques de parrainage');
  }
  const obj = data as Record<string, unknown>;
  return {
    code: (obj.code as string) ?? 'ELEARN',
    liensCliques: (obj.liens_cliques as number) ?? 0,
    comptesCrees: (obj.comptes_crees as number) ?? 0,
    passAchetes: (obj.pass_achetes as number) ?? 0,
    creditsGagnes: (obj.credits_gagnes as number) ?? 0,
    jalons: Array.isArray(obj.jalons) ? (obj.jalons as JalonParrainage[]) : [],
  };
}

/**
 * Partage le code parrain via WhatsApp ou le menu natif du téléphone.
 */
export async function partagerLienWhatsApp(code: string, prenom?: string): Promise<void> {
  const nom = prenom ? prenom.trim() : 'Un ami';
  const lien = `https://elearnprepa.com/r/${code}`;
  const message = `${nom} t’invite sur Elearn Prepa ! Reçois tes crédits de bienvenue et -15% sur ton premier Pass avec le code : ${code}\n\nClique ici pour commencer : ${lien}`;
  
  try {
    await Share.share({
      message,
      url: lien,
      title: 'Invitation Elearn Prepa',
    });
  } catch {
    // Annulé par l'utilisateur
  }
}

/**
 * Sauvegarde temporairement le code parrain utilisé par un invité avant sa création de compte.
 */
export async function sauvegarderCodeInvite(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_CODE_PARRAIN_INVITE, code.trim().toUpperCase());
  } catch {
    // Silencieux
  }
}

/**
 * Lit le code parrain sauvegardé en local.
 */
export async function lireCodeInvite(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLE_CODE_PARRAIN_INVITE);
  } catch {
    return null;
  }
}
