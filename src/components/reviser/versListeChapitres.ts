import { router } from 'expo-router';

/**
 * Fin de chapitre : retour à la liste des chapitres de la matière, pas à la dernière leçon lue. `dismissTo` dépile
 * jusqu'à cette page si elle est dans la pile (elle l'est quand on vient d'un chapitre) ; sans matière connue
 * (ouverture depuis « Reprendre »), on revient à Réviser.
 */
export function versListeChapitres(matiere?: string | null) {
  if (matiere) router.dismissTo({ pathname: '/cours/matiere', params: { nom: matiere } });
  else router.replace('/reviser');
}
