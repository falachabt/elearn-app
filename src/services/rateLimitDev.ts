import { modeDeveloppement } from './developpement';

/**
 * Simulation du Rate-Limiting (code HTTP 429) pour tester sans spammer le serveur.
 * Inactif hors build de développement ou canal « preview ».
 */
type Simulation429 = {
  photo: boolean;
  paiement: boolean;
  connexion: boolean;
};

let simule: Simulation429 = {
  photo: false,
  paiement: false,
  connexion: false,
};

let snapshotCourant: Simulation429 = { ...simule };
const SNAPSHOT_INACTIF: Simulation429 = { photo: false, paiement: false, connexion: false };

const ecouteurs = new Set<() => void>();

export function rateLimitSimule(): Simulation429 {
  return modeDeveloppement() ? snapshotCourant : SNAPSHOT_INACTIF;
}

export function ecouterRateLimitSimule(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

export function basculerRateLimitSimule(cle: keyof Simulation429, valeur?: boolean): void {
  if (!modeDeveloppement()) return;
  simule[cle] = valeur !== undefined ? valeur : !simule[cle];
  snapshotCourant = { ...simule };
  for (const ecouteur of ecouteurs) ecouteur();
}

export function reinitialiserRateLimitSimule(): void {
  if (!modeDeveloppement()) return;
  simule = { photo: false, paiement: false, connexion: false };
  snapshotCourant = { ...simule };
  for (const ecouteur of ecouteurs) ecouteur();
}
