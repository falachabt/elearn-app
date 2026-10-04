import { useSyncExternalStore } from 'react';

/**
 * Déclencheur de l'appareil photo partagé avec la barre d'onglets. Quand l'appareil est prêt, l'écran caméra enregistre
 * ici sa prise de vue : le bouton Photo central de la barre n'est alors plus un doublon, il prend la photo (et son rond
 * est remplacé par le déclencheur de l'écran, aligné avec galerie et retournement).
 */
type Declencheur = (() => void) | null;

let courant: Declencheur = null;
const abonnes = new Set<() => void>();

export function definirDeclencheur(action: Declencheur): void {
  courant = action;
  abonnes.forEach((a) => a());
}

/** Prend la photo si l'appareil est prêt. Renvoie false sinon (l'onglet navigue alors comme d'habitude). */
export function declencherPhoto(): boolean {
  if (!courant) return false;
  courant();
  return true;
}

const abonner = (a: () => void) => {
  abonnes.add(a);
  return () => {
    abonnes.delete(a);
  };
};

/** Vrai tant que l'appareil photo est affiché et prêt à prendre une photo. */
export const useDeclencheurActif = (): boolean => useSyncExternalStore(abonner, () => courant !== null, () => false);
