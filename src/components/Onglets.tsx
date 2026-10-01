import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

type Props<T extends string> = { valeurs: readonly { valeur: T; libelle: string }[]; valeur: T; onChange: (v: T) => void };

/** Sélecteur segmenté (Réviser, rythme de la mission, entraînement d'un chapitre). */
export function Onglets<T extends string>({ valeurs, valeur, onChange }: Props<T>) {
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.cadre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {valeurs.map((o) => {
        const actif = valeur === o.valeur;
        return (
          <Appui key={o.valeur} style={styles.flex} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(o.valeur)} decalage={0} rayon={rayon.s}>
            <View style={[styles.segment, actif && { backgroundColor: theme.texte.principal }]}>
              <Text style={[typo.boutonPetit, { color: actif ? theme.fond.app : theme.texte.principal }]}>{o.libelle}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cadre: { flexDirection: 'row', padding: espace[1], gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.m },
  segment: { alignItems: 'center', justifyContent: 'center', paddingVertical: espace[3], borderRadius: rayon.s },
});
