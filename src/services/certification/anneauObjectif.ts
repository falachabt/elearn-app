/** Échelle du score TOEIC : l'anneau de l'accueil va de 0 à 990 (maquette 4-accueil-test-cercle-objectif). */
export const ECHELLE_ANNEAU = 990;

export type EtatAnneau = {
  /** Part du cercle remplie par le score moyen, de 0 à 1. */
  remplissage: number;
  /** Position du petit tiret qui marque l'objectif, de 0 à 1. */
  tiret: number;
  /** Score atteint ou dépassé : le cercle devient vert et affiche un tiret au centre. */
  atteint: boolean;
  /** Pas encore de score estimé : pas de remplissage, pas de chiffre au centre. */
  sansScore: boolean;
  /** Rouge sous 75 % de l'objectif, orange de 75 % à moins de 100 %, vert à 100 % et au-delà (demande de Benny, 18/11). */
  couleur: 'rouge' | 'orange' | 'vert';
};

/** Seuil du passage du rouge à l'orange, en part de l'objectif. */
export const SEUIL_ORANGE = 0.75;

const borne = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * État du cercle « score moyen par rapport à l'objectif ».
 * Sous l'objectif : rouge avec le score au centre. À l'objectif ou au-dessus (égalité comprise) : vert avec un tiret.
 */
export function etatAnneau(score: number | null, objectif: number): EtatAnneau {
  const tiret = borne(objectif / ECHELLE_ANNEAU);
  if (score === null) return { remplissage: 0, tiret, atteint: false, sansScore: true, couleur: 'rouge' };
  const atteint = score >= objectif;
  const couleur = atteint ? 'vert' : score >= objectif * SEUIL_ORANGE ? 'orange' : 'rouge';
  return { remplissage: borne(score / ECHELLE_ANNEAU), tiret, atteint, sansScore: false, couleur };
}
