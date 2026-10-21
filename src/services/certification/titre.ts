/**
 * Titre d'une notion ou d'un cours tel qu'il s'affiche. Les contenus de démonstration gardent « (démo) » en base, mais
 * l'élève ne doit pas le voir : on le retire à l'affichage seulement, le contenu reste actif.
 */
export const titreAffiche = (titre: string): string => titre.replace(/\s*\(démo\)\s*$/i, '');
