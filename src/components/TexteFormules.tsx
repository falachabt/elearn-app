import { useMemo } from 'react';
import type { TextStyle } from 'react-native';

import { blocsDepuisTexte } from '@/services/blocs';

import { Blocs } from './reviser/Blocs';

/**
 * Texte avec des formules LaTeX entre $…$ (commentaires de l'IA, énoncés, réponses) : affiché comme les leçons, avec le
 * rendu des formules choisi dans Paramètres, jamais en LaTeX brut.
 */
export function TexteFormules({ texte, style, couleur, surCouleur }: { texte: string; style?: TextStyle; couleur?: string; surCouleur?: boolean }) {
  const blocs = useMemo(() => blocsDepuisTexte(texte), [texte]);
  return <Blocs blocs={blocs} texteStyle={style} couleurTexte={couleur} surCouleur={surCouleur} />;
}
