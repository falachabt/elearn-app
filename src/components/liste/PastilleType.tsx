import { CircleHelp, FileText, GraduationCap, PencilLine } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, typeContenu } from '@/theme/theme';

export type TypeContenu = keyof typeof typeContenu;

const ICONES = { quiz: CircleHelp, exercice: PencilLine, lecon: GraduationCap, annale: FileText } as const;

/** Pastille qui dit le type d'un contenu (revue design, règle 5) : couleur `typeContenu`, icône Lucide noire. */
export function PastilleType({ type, taille = 34 }: { type: TypeContenu; taille?: number }) {
  const { theme } = useTheme();
  const Icone = ICONES[type];
  return (
    <View testID={`pastille-${type}`} style={[styles.pastille, { width: taille, height: taille, borderRadius: taille > 30 ? 9 : 7, backgroundColor: typeContenu[type], borderColor: theme.bord.fort }]}>
      <Icone size={taille > 30 ? 18 : 15} strokeWidth={2} color={theme.texte.surCouleur} />
    </View>
  );
}

const styles = StyleSheet.create({ pastille: { borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' } });
