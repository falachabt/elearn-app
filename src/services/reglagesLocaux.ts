import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Date de la dernière modification des réglages faite sur ce téléphone (préférences de retours, langue, profil
 * d'arrivée). Sert à départager le téléphone et le compte lors de la synchronisation (le plus récent gagne).
 * Module sans dépendance pour que retours, i18n et profil puissent le prévenir sans import circulaire.
 */
export const CLE_MAJ_REGLAGES = 'reglages.maj';

const ecouteurs = new Set<() => void>();
let enPause = false;

export function abonnerModifications(fonction: () => void): () => void {
  ecouteurs.add(fonction);
  return () => ecouteurs.delete(fonction);
}

export async function lireMajReglages(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLE_MAJ_REGLAGES);
  } catch {
    return null;
  }
}

export async function ecrireMajReglages(date: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_MAJ_REGLAGES, date);
  } catch {
    // Au pire, le compte gagnera à la prochaine synchronisation.
  }
}

/** À appeler après un changement de réglage fait par l'utilisateur. */
export async function signalerModification(maintenant = new Date()): Promise<void> {
  if (enPause) return;
  await ecrireMajReglages(maintenant.toISOString());
  ecouteurs.forEach((f) => f());
}

/** Applique des réglages venus du compte sans les renvoyer aussitôt. */
export async function sansSignaler(action: () => Promise<void>): Promise<void> {
  enPause = true;
  try {
    await action();
  } finally {
    enPause = false;
  }
}
