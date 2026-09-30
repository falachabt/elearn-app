import AsyncStorage from '@react-native-async-storage/async-storage';

import { suivre } from './analytics';

/** Rattachement au parrain (M15) : on conserve le code 7 jours sur le téléphone, sans aucune récompense à ce stade. */
export const CLE_PARRAINAGE = 'parrainage.code';
export const DUREE_CONSERVATION_MS = 7 * 24 * 60 * 60 * 1000;

type Source = 'lien' | 'saisie';
type Conserve = { code: string; capturedAt: number };

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
