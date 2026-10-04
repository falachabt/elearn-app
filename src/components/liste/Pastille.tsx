import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

/** Petite pastille d'état à droite d'une carte : « 80 % », « Fait », « Gratuit », « Pass »… Vert = réussi ou disponible. */
export function Pastille({ texte, vert }: { texte: string; vert?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.zone, { backgroundColor: vert ? theme.marque.principale : theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.boutonPetit, styles.texte, { color: vert ? theme.texte.surCouleur : theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  texte: { fontSize: 13 },
});
