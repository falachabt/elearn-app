import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/** Puce de filtre : active en `fond.inverse` (revue design, écran 8), avec un point de couleur en option (matière). */
export function Puce({ libelle, choisie, onPress, pastille }: { libelle: string; choisie: boolean; onPress: () => void; pastille?: string }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityState={{ selected: choisie }} accessibilityLabel={libelle} onPress={onPress} rayon={rayon.pilule} decalage={0}>
      <View style={[styles.puce, { borderColor: theme.bord.fort, backgroundColor: choisie ? theme.fond.inverse : theme.fond.surface }]}>
        {pastille ? <View style={[styles.point, { backgroundColor: pastille, borderColor: theme.bord.fort }]} /> : null}
        <Text style={[typo.boutonPetit, { color: choisie ? theme.texte.inverse : theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  point: { width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
  puce: { height: 36, flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.pilule },
});
