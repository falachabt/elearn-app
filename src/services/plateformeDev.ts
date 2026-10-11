import { modeDeveloppement } from './developpement';

/**
 * Simulation « iOS » pour la page « Paramètres développeur » : force l'application à se comporter comme sur un
 * iPhone (achats intégrés Apple via RevenueCat), même sur le web ou sur Android. Sert à vérifier l'écran des offres
 * iOS et le parcours d'achat sans build iPhone, uniquement pendant le développement.
 *
 * Inactif hors développement ou canal « preview » : `iosSimule()` y renvoie toujours `false`. Les prix affichés sont
 * simulés (voir `achatsIntegres.ts`) ; rien n'est écrit sur le serveur ni facturé.
 *
 * `EXPO_PUBLIC_SIMULER_IOS=1` la rend active dès le démarrage (captures d'écran, recette) ; l'écran développeur reste
 * maître ensuite, et peut la couper.
 */
let actif = process.env.EXPO_PUBLIC_SIMULER_IOS === '1';

export function iosSimule(): boolean {
  return modeDeveloppement() && actif;
}

export function definirIosSimule(valeur: boolean): void {
  if (!modeDeveloppement()) return;
  actif = valeur;
}
