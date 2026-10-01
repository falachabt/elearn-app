import AsyncStorage from '@react-native-async-storage/async-storage';

/** Taille de la mission du jour choisie par l'élève (rythme), en nombre de questions. */
export const CLE_RYTHME = 'mission.rythme';
export const TAILLE_DEFAUT = 20;
export const TAILLE_MIN = 15;
export const TAILLE_MAX = 30;
export const PAS_TAILLE = 5;

/** Temps qu'on est prêt à donner chaque jour, et la taille de mission proposée (environ 30 s par question). */
export const RYTHMES = [
  { minutes: 10, questions: 15 },
  { minutes: 15, questions: 20 },
  { minutes: 20, questions: 30 },
] as const;

export const bornerTaille = (n: number) => Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, Math.round(n / PAS_TAILLE) * PAS_TAILLE));

/** null tant que l'élève n'a pas choisi : on lui proposera de le faire à la fin d'une mission. */
export async function lireRythme(): Promise<number | null> {
  const brut = await AsyncStorage.getItem(CLE_RYTHME).catch(() => null);
  const n = brut ? Number(brut) : NaN;
  return Number.isFinite(n) ? bornerTaille(n) : null;
}

export async function enregistrerRythme(n: number): Promise<number> {
  const taille = bornerTaille(n);
  await AsyncStorage.setItem(CLE_RYTHME, String(taille));
  return taille;
}
