import AsyncStorage from '@react-native-async-storage/async-storage';

import { signalerModification } from './reglagesLocaux';

/** Taille de la mission du jour choisie par l'élève (rythme), en nombre de questions. */
export const CLE_RYTHME = 'mission.rythme';
export const TAILLE_DEFAUT = 20;
/** Bornes du réglage (M4-08) ; 15 à 30 est la fourchette conseillée. */
export const TAILLE_MIN = 5;
export const TAILLE_MAX = 50;
export const PAS_TAILLE = 5;

/** Temps qu'on est prêt à donner chaque jour : 10 à 45 min par pas de 5 (spec 11 v2). */
export const MINUTES_RYTHME = [10, 15, 20, 25, 30, 35, 40, 45] as const;
/** Environ 35 secondes par question. */
export const SECONDES_PAR_QUESTION = 35;

export const bornerTaille = (n: number) => Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, Math.round(n / PAS_TAILLE) * PAS_TAILLE));
/** Questions proposées pour un temps donné : minutes × 60 / 35, arrondi au pas de 5, borné entre 5 et 50. */
export const questionsPour = (minutes: number) => bornerTaille(Math.round((minutes * 60) / SECONDES_PAR_QUESTION));

/** null tant que l'élève n'a pas choisi : on lui proposera de le faire à la fin d'une mission. */
export async function lireRythme(): Promise<number | null> {
  const brut = await AsyncStorage.getItem(CLE_RYTHME).catch(() => null);
  const n = brut ? Number(brut) : NaN;
  return Number.isFinite(n) ? bornerTaille(n) : null;
}

export async function enregistrerRythme(n: number): Promise<number> {
  const taille = bornerTaille(n);
  await AsyncStorage.setItem(CLE_RYTHME, String(taille));
  await signalerModification();
  return taille;
}
