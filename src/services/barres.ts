import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Couleur des barres système (barre d'état en haut, barre de navigation Android en bas).
 * `theme` : fond de l'écran (crème ou encre). `vert` : émeraude Elearn. Réglage d'essai demandé par Benny le 30/09/2026
 * pour comparer les deux sur son téléphone ; on retirera celui qui n'est pas retenu.
 */
export type VarianteBarres = 'theme' | 'vert';
export const CLE_BARRES = 'apparence.barres';
export const BARRES_PAR_DEFAUT: VarianteBarres = 'theme';

let variante: VarianteBarres = BARRES_PAR_DEFAUT;
const ecouteurs = new Set<() => void>();

export const lireVarianteBarres = (): VarianteBarres => variante;

function abonner(fonction: () => void): () => void {
  ecouteurs.add(fonction);
  return () => ecouteurs.delete(fonction);
}

export async function chargerVarianteBarres(): Promise<VarianteBarres> {
  try {
    const lu = await AsyncStorage.getItem(CLE_BARRES);
    variante = lu === 'vert' || lu === 'theme' ? lu : BARRES_PAR_DEFAUT;
  } catch {
    variante = BARRES_PAR_DEFAUT;
  }
  ecouteurs.forEach((f) => f());
  return variante;
}

export async function definirVarianteBarres(valeur: VarianteBarres): Promise<void> {
  variante = valeur;
  ecouteurs.forEach((f) => f());
  try {
    await AsyncStorage.setItem(CLE_BARRES, valeur);
  } catch {
    // Actif pour cette session seulement.
  }
}

export function useVarianteBarres(): VarianteBarres {
  return useSyncExternalStore(abonner, lireVarianteBarres, lireVarianteBarres);
}
