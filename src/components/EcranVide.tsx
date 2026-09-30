import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Etiquette } from '@/components/Etiquette';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

/** Écran provisoire d'un onglet, remplacé au fil des phases. */
export function EcranVide({ titre, phrase }: { titre: string; phrase: string }) {
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.zone, { backgroundColor: theme.fond.app, paddingTop: top + espace[7] }]}>
      <Etiquette texte="Bientôt" />
      <Text style={[typo.h1, { color: theme.texte.principal }]}>{titre}</Text>
      <Text style={[typo.texteGrand, { color: theme.texte.secondaire }]}>{phrase}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flex: 1, paddingHorizontal: espace[6], gap: espace[5] },
});
