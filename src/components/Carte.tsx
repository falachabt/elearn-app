import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon } from '@/theme/theme';

/** Carte : bordure 2, rayon 14, ombre dure 4. */
export function Carte({ style, children, ...reste }: ViewProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.zone}>
      <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
      <View
        {...reste}
        style={[styles.corps, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }, style]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { paddingBottom: ombre.m, paddingRight: ombre.m },
  ombre: { position: 'absolute', left: ombre.m, top: ombre.m, right: 0, bottom: 0, borderRadius: rayon.l },
  corps: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5] },
});
