import { contenuHorsLigneValide, ecouterConnectivite, ecouterSimulation } from './connectivite';

/**
 * Le contenu hors ligne a-t-il dépassé sa validité (7 jours sans contact serveur) ? Drapeau synchrone pour
 * l'interface : les messages d'erreur de contenu disent alors « contenu expiré, reconnecte-toi » au lieu d'un
 * générique « vérifie ta connexion » qui laisserait croire que l'élève n'a rien téléchargé.
 *
 * Recalculé à chaque changement d'état réseau et de simulation (page développeur), jamais par minuterie.
 */
let expire = false;
let demarre = false;
const ecouteurs = new Set<() => void>();

async function recalculer(): Promise<void> {
  try {
    const suivant = !(await contenuHorsLigneValide());
    if (suivant === expire) return;
    expire = suivant;
    for (const ecouteur of ecouteurs) ecouteur();
  } catch {
    // Sans réponse fiable, on garde l'état précédent : un message générique vaut mieux qu'un faux « expiré ».
  }
}

function demarrer(): void {
  if (demarre) return;
  demarre = true;
  try {
    ecouterConnectivite(() => void recalculer());
    ecouterSimulation(() => void recalculer());
  } catch {
    // Module de connectivité remplacé (tests) : l'expiration restera à faux.
  }
  void recalculer();
}

export function contenuExpire(): boolean {
  return expire;
}

export function ecouterExpiration(ecouteur: () => void): () => void {
  demarrer();
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/** Recalcul immédiat (tests, retour au premier plan). */
export function actualiserExpiration(): Promise<void> {
  return recalculer();
}
