import type { NiveauNote } from '@/services/travailSujet';
import type { Theme } from '@/theme/theme';

/** Fond de la carte de note : vert dès 60 %, jaune dès 40 %, orange sous 40 %, rouge sous 20 % (jetons du thème, clair et sombre). */
export function couleurNiveauNote(theme: Theme, niveau: NiveauNote): string {
  switch (niveau) {
    case 'bonne':
      return theme.marque.principale;
    case 'moyenne':
      return theme.accent.soleil;
    case 'faible':
      return theme.etat.alerte;
    default:
      return theme.etat.erreur;
  }
}
