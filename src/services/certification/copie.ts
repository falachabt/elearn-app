import AsyncStorage from '@react-native-async-storage/async-storage';

import { ecrireJson } from './etat';
import { lireLocalHorsLigne, oublierLocalEnMemoire } from '../reviser';

/** Le contenu gardé hors ligne a dépassé sa durée de validité : il n'est pas servi (S9). */
export class ErreurContenuExpire extends Error {
  constructor() {
    super('contenu expiré');
    this.name = 'ErreurContenuExpire';
  }
}

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
    if (copie === null) {
      // Une copie existe mais elle a plus de 7 jours : elle n'est pas servie, l'écran le dit (S9).
      const gardee = await AsyncStorage.getItem(cle).catch(() => null);
      throw gardee ? new ErreurContenuExpire() : erreur;
    }
    return { valeur: copie, depuisCopie: true };
  }
}
