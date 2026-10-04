import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

/** Étiquette mono en capitales (ex. « GRATUIT », « PASS »). */
export function Etiquette({ texte, jaune }: { texte: string; jaune?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.zone, { backgroundColor: jaune ? theme.accent.soleil : theme.fond.creux, borderColor: theme.bord.fort }]}>
      <Text style={[typo.etiquette, { color: jaune ? theme.texte.surCouleur : theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
});
