import { BookOpen, Calculator, Dumbbell, FlaskConical, Globe, Languages, Laptop, Leaf, Lightbulb, Palette, PenLine, TrendingUp, Users } from 'lucide-react-native';

import { iconeMatiere } from '@/services/reviser';

const LUCIDE = {
  'calculator-outline': Calculator,
  'leaf-outline': Leaf,
  'flask-outline': FlaskConical,
  'create-outline': PenLine,
  'language-outline': Languages,
  'earth-outline': Globe,
  'bulb-outline': Lightbulb,
  'laptop-outline': Laptop,
  'trending-up-outline': TrendingUp,
  'football-outline': Dumbbell,
  'color-palette-outline': Palette,
  'people-outline': Users,
  'library-outline': BookOpen,
} as const;

/** Icône Lucide d'une matière (revue design, règle 5 : Lucide uniquement, trait 2). */
export function IconeMatiere({ nom, taille = 18, couleur }: { nom: string; taille?: number; couleur: string }) {
  const Icone = LUCIDE[iconeMatiere(nom)];
  return <Icone size={taille} strokeWidth={2} color={couleur} />;
}
