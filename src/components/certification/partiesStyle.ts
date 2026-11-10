import { BookOpen, Headphones, Image, Layers, NotebookPen, Pen, type LucideIcon } from 'lucide-react-native';

import type { Theme } from '@/theme/theme';
import { matiere } from '@/theme/theme';

/**
 * Identité de chaque partie du TOEIC (maquette v30 et v32) : une couleur et une icône propres, une fiche par partie.
 * Les couleurs viennent des tokens de matière ; elles se répètent d'une partie à l'autre, l'icône et le nom les distinguent.
 */
type ClePartie = 'certification.reviser.partieNom1' | 'certification.reviser.partieNom2' | 'certification.reviser.partieNom3' | 'certification.reviser.partieNom4'
  | 'certification.reviser.partieNom5' | 'certification.reviser.partieNom6' | 'certification.reviser.partieNom7';

/** `cle` : clé de traduction du nom de la partie (littérale, pour le contrôle de types). */
export type StylePartie = { couleur: string; icone: LucideIcon; cle: ClePartie };

/**
 * Couleurs de la maquette v30 et v32 : P1 vert, P2 jaune, P3 crème, P4 corail, P5 jaune, P6 vert, P7 crème. Vert et corail
 * viennent des tokens de matière et d'état, jaune du thème. Le crème est le papier clair en thème clair ; en thème sombre,
 * le papier clair du texte (le fond sombre rendrait l'icône invisible).
 */
export const stylePartie = (theme: Theme, sombre: boolean): Record<number, StylePartie> => {
  const creme = sombre ? theme.texte.principal : theme.fond.app;
  return {
    1: { couleur: matiere.svt, icone: Image, cle: 'certification.reviser.partieNom1' },
    2: { couleur: theme.accent.soleil, icone: NotebookPen, cle: 'certification.reviser.partieNom2' },
    3: { couleur: creme, icone: Headphones, cle: 'certification.reviser.partieNom3' },
    4: { couleur: theme.etat.erreur, icone: BookOpen, cle: 'certification.reviser.partieNom4' },
    5: { couleur: theme.accent.soleil, icone: Layers, cle: 'certification.reviser.partieNom5' },
    6: { couleur: matiere.svt, icone: Pen, cle: 'certification.reviser.partieNom6' },
    7: { couleur: creme, icone: BookOpen, cle: 'certification.reviser.partieNom7' },
  };
};
