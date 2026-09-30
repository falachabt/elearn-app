import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

/** Ligne cliquable : icône, titre, détail éventuel et chevron. */
export function LigneLien({ icone, titre, detail, onPress }: { icone: keyof typeof Ionicons.glyphMap; titre: string; detail?: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={detail ? `${titre}. ${detail}` : titre} onPress={onPress} rayon={rayon.l} ombre={3} decalage={2} couleurOmbre={theme.ombre}>
      <View style={[styles.entree, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Ionicons name={icone} size={22} color={theme.texte.principal} />
        <View style={styles.flex}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          {detail ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.texte.secondaire} />
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entree: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
