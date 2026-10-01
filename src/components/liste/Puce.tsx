import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/** Puce de filtre : active en `fond.inverse` (revue design, écran 8). */
export function Puce({ libelle, choisie, onPress }: { libelle: string; choisie: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityState={{ selected: choisie }} accessibilityLabel={libelle} onPress={onPress} rayon={rayon.pilule} decalage={0}>
      <View style={[styles.puce, { borderColor: theme.bord.fort, backgroundColor: choisie ? theme.fond.inverse : theme.fond.surface }]}>
        <Text style={[typo.boutonPetit, { color: choisie ? theme.texte.inverse : theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  puce: { height: 36, justifyContent: 'center', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.pilule },
});
