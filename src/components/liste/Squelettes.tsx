import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon } from '@/theme/theme';

/** Cartes grises le temps du chargement (revue design, règle 7 : le squelette d'abord). */
export function Squelettes({ nombre = 4 }: { nombre?: number }) {
  const { theme } = useTheme();
  return (
    <View testID="squelettes" accessibilityLabel="…" style={styles.groupe}>
      {Array.from({ length: nombre }, (_, i) => (
        <View key={i} style={[styles.carte, { borderColor: theme.bord.doux, backgroundColor: theme.fond.surface }]}>
          <View style={[styles.pastille, { backgroundColor: theme.fond.creux }]} />
          <View style={styles.lignes}>
            <View style={[styles.ligne, { width: '70%', backgroundColor: theme.fond.creux }]} />
            <View style={[styles.ligne, { width: '35%', backgroundColor: theme.fond.creux }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  carte: { height: 66, flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  pastille: { width: 34, height: 34, borderRadius: 9 },
  lignes: { flex: 1, gap: espace[3] },
  ligne: { height: 10, borderRadius: rayon.s },
});
