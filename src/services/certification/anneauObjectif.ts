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
};

const borne = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * État du cercle « score moyen par rapport à l'objectif ».
 * Sous l'objectif : rouge avec le score au centre. À l'objectif ou au-dessus (égalité comprise) : vert avec un tiret.
 */
export function etatAnneau(score: number | null, objectif: number): EtatAnneau {
  const tiret = borne(objectif / ECHELLE_ANNEAU);
  if (score === null) return { remplissage: 0, tiret, atteint: false, sansScore: true };
  return {
    remplissage: borne(score / ECHELLE_ANNEAU),
    tiret,
    atteint: score >= objectif,
    sansScore: false,
  };
}
