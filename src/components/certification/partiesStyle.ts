import { BookOpen, Headphones, Image, Layers, MessageCircleQuestion, Pen, type LucideIcon } from 'lucide-react-native';

import { matiere } from '@/theme/theme';

/**
 * Identité de chaque partie du TOEIC (maquette v30 et v32) : une couleur et une icône propres, une fiche par partie.
 * Les couleurs viennent des tokens de matière ; elles se répètent d'une partie à l'autre, l'icône et le nom les distinguent.
 */
type ClePartie = 'certification.reviser.partieNom1' | 'certification.reviser.partieNom2' | 'certification.reviser.partieNom3' | 'certification.reviser.partieNom4'
  | 'certification.reviser.partieNom5' | 'certification.reviser.partieNom6' | 'certification.reviser.partieNom7';

/** `cle` : clé de traduction du nom de la partie (littérale, pour le contrôle de types). */
export const STYLE_PARTIE: Record<number, { couleur: string; icone: LucideIcon; cle: ClePartie }> = {
  1: { couleur: matiere.svt, icone: Image, cle: 'certification.reviser.partieNom1' },
  2: { couleur: matiere.histoireGeo, icone: MessageCircleQuestion, cle: 'certification.reviser.partieNom2' },
  3: { couleur: matiere.francais, icone: Headphones, cle: 'certification.reviser.partieNom3' },
  4: { couleur: matiere.anglais, icone: BookOpen, cle: 'certification.reviser.partieNom4' },
  5: { couleur: matiere.histoireGeo, icone: Layers, cle: 'certification.reviser.partieNom5' },
  6: { couleur: matiere.svt, icone: Pen, cle: 'certification.reviser.partieNom6' },
  7: { couleur: matiere.francais, icone: BookOpen, cle: 'certification.reviser.partieNom7' },
};
