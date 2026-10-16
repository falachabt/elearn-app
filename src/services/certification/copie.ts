import { ecrireJson } from './etat';
import { lireLocalHorsLigne, oublierLocalEnMemoire } from '../reviser';

/**
 * Lecture « réseau d'abord » avec copie locale pour le hors ligne. Les données de l'élève (maîtrise, carnet) changent
 * à chaque séance : on ne sert jamais une copie quand le serveur répond. Hors ligne, la copie passe par
 * `lireLocalHorsLigne`, qui applique l'expiration de 7 jours (AGENTS.md §16 bis).
 */
export async function lireAvecCopie<T>(cle: string, lire: () => Promise<T>): Promise<{ valeur: T; depuisCopie: boolean }> {
  try {
    const valeur = await lire();
    await ecrireJson(cle, valeur);
    oublierLocalEnMemoire(cle);
    return { valeur, depuisCopie: false };
  } catch (erreur) {
    const copie = await lireLocalHorsLigne<T>(cle);
    if (copie === null) throw erreur;
    return { valeur: copie, depuisCopie: true };
  }
}
