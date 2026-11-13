/**
 * X2 · Signaler une erreur (cahier §5.X). Trois motifs affichés ; le serveur range chaque signalement dans
 * `cert_error_reports` avec un type parmi `reponse`, `enonce`, `audio`, `autre` (contrainte de la table).
 * « L'explication est fausse » n'a pas de type dédié côté serveur : il part en `autre`, la question et la notion
 * suffisent à la relecture.
 */
export type TypeSignalement = 'reponse' | 'enonce' | 'audio' | 'autre';

export type MotifSignalement = 'reponse' | 'explication' | 'audio';

export const TYPE_DU_MOTIF: Record<MotifSignalement, TypeSignalement> = {
  reponse: 'reponse',
  explication: 'autre',
  audio: 'audio',
};

/** Le motif « Le son ne correspond pas » n'a de sens que pour les parties d'écoute (1 à 4). */
export function motifsPour(partie: number): MotifSignalement[] {
  return partie >= 1 && partie <= 4 ? ['reponse', 'explication', 'audio'] : ['reponse', 'explication'];
}
