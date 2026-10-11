import { modeDeveloppement } from './developpement';

/**
 * Solde de crédits SIMULÉ (page « Paramètres développeur »), côté client uniquement : aucun appel serveur, aucune
 * écriture dans le registre. Sert à tester la feuille « Crédits épuisés », les boutons payants et les refus sans
 * vider un vrai compte (un pass rend d'ailleurs la dépense illimitée côté serveur).
 *
 * Inactif hors build de développement ou canal « preview » : `soldeSimule()` y renvoie toujours `null`.
 */
let simule: number | null = null;
const ecouteurs = new Set<() => void>();

export function soldeSimule(): number | null {
  return modeDeveloppement() ? simule : null;
}

export function ecouterSoldeSimule(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/** Fixe le solde simulé (jamais négatif) ; `null` rend la main au solde réel. */
export function definirSoldeSimule(valeur: number | null): void {
  if (!modeDeveloppement()) return;
  simule = valeur === null ? null : Math.max(0, Math.round(valeur));
  for (const ecouteur of ecouteurs) ecouteur();
}

/** Ajoute (ou retire) des crédits au solde simulé, à partir de `base` quand aucune simulation n'est en cours. */
export function ajusterSoldeSimule(delta: number, base: number): void {
  definirSoldeSimule((simule ?? base) + delta);
}
