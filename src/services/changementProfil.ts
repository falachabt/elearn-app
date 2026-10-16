import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_PROFIL, lireProfil, type Profil } from './profil';
import { signalerModification } from './reglagesLocaux';

export const CLE_PROFIL_MEMOIRE = 'profil.memoire';

/** Dernier profil de chaque famille (secondaire ou concours, TOEIC) : on y revient sans tout ressaisir (P4, P5). */
export type MemoireProfil = { secondaire?: Profil; toeic?: Profil };

async function lireMemoire(): Promise<MemoireProfil> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PROFIL_MEMOIRE);
    return brut ? (JSON.parse(brut) as MemoireProfil) : {};
  } catch {
    return {};
  }
}

/**
 * Écrit la mémoire puis le profil. Une erreur d'écriture remonte à l'écran : le profil reste alors celui d'avant
 * (écran P6, « Changement impossible »). Aucune donnée d'élève n'est effacée : la mémoire ne fait que garder l'ancien profil.
 */
async function basculer(suivant: Profil, memoire: MemoireProfil): Promise<void> {
  await AsyncStorage.setItem(CLE_PROFIL_MEMOIRE, JSON.stringify(memoire));
  await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify(suivant));
  await signalerModification();
}

/** P4 : passer du secondaire ou du concours au TOEIC. Le profil précédent reste en mémoire. */
export async function passerAuToeic(): Promise<void> {
  const actuel = await lireProfil();
  if (actuel?.type === 'certification') return;
  const memoire = await lireMemoire();
  const suivant: Profil = memoire.toeic ?? { type: 'certification', exam: 'toeic', pays: actuel?.pays, termine: false };
  await basculer(suivant, { ...memoire, ...(actuel ? { secondaire: actuel } : {}) });
}
