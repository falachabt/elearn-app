import { CircleHelp, PencilLine } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, palette, rayon, typo } from '@/theme/theme';

/** Compteur en pilule : quiz (bleu) ou exercices (orange), faits / total. */
export function PiluleCompteur({ type, faits, total, fini }: { type: 'quiz' | 'exercice'; faits: number; total: number; fini: boolean }) {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const fond = fini ? theme.marque.douce : type === 'quiz' ? (sombre ? palette.bleu[900] : palette.bleu[100]) : sombre ? palette.orange[900] : palette.orange[100];
  const Icone = type === 'quiz' ? CircleHelp : PencilLine;
  return (
    <View
      accessibilityLabel={t(type === 'quiz' ? 'entrainement.compteurQuiz' : 'entrainement.compteurExercices', { n: Math.min(faits, total), total })}
      style={[styles.compteur, { backgroundColor: fond, borderColor: theme.bord.fort }]}
    >
      <Icone size={11} strokeWidth={2.5} color={theme.texte.principal} />
      <Text style={[typo.donnee, styles.compteurTexte, { color: theme.texte.principal }]}>{`${Math.min(faits, total)}/${total}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compteur: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: espace[2], paddingVertical: 1, borderWidth: 1.5, borderRadius: rayon.pilule },
  compteurTexte: { fontFamily: 'SpaceMono-Bold', fontSize: 11, lineHeight: 14 },
});
