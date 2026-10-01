import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

type Props<T extends string> = { valeurs: readonly { valeur: T; libelle: string }[]; valeur: T; onChange: (v: T) => void };

/** Sélecteur segmenté (revue design, écran 1) : pilule, segment actif en `fond.inverse`, 40 px. Réviser, rythme, entraînement d'un chapitre. */
export function Onglets<T extends string>({ valeurs, valeur, onChange }: Props<T>) {
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.cadre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {valeurs.map((o) => {
        const actif = valeur === o.valeur;
        return (
          <Appui key={o.valeur} style={styles.flex} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(o.valeur)} decalage={0} rayon={rayon.pilule}>
            <View style={[styles.segment, actif && { backgroundColor: theme.fond.inverse }]}>
              <Text style={[typo.boutonPetit, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{o.libelle}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cadre: { height: 40, flexDirection: 'row', padding: 3, gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.pilule },
  // Hauteur fixe : sur Android, un segment en flex dans le corps animé d'Appui s'écrase à 0 et son texte est rogné.
  segment: { height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.pilule },
});
