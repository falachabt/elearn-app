import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

type Props<T extends string> = {
  valeurs: readonly { valeur: T; libelle: string }[];
  valeur: T;
  onChange: (v: T) => void;
  /** Valeur dont le segment actif est jaune (onglet « Corrigé » d'un exercice). */
  jaune?: T;
};

/** Sélecteur segmenté (revue design, écran 1) : coins 10/6 (Benny préfère moins arrondi), segment actif en `fond.inverse`, 40 px. Réviser, rythme, entraînement d'un chapitre. */
export function Onglets<T extends string>({ valeurs, valeur, onChange, jaune }: Props<T>) {
  const { theme, sombre } = useTheme();
  const doux = sombre ? corrige.dark : corrige.light;
  return (
    <View accessibilityRole="tablist" style={[styles.cadre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {valeurs.map((o) => {
        const actif = valeur === o.valeur;
        const enJaune = actif && o.valeur === jaune;
        return (
          <Appui key={o.valeur} style={styles.flex} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(o.valeur)} decalage={0} rayon={rayon.s}>
            <View style={[styles.segment, actif && (enJaune ? { backgroundColor: doux.fond, borderWidth: bord.normal, borderColor: theme.bord.fort } : { backgroundColor: theme.fond.inverse })]}>
              <Text style={[typo.boutonPetit, { color: enJaune ? doux.texte : actif ? theme.texte.inverse : theme.texte.principal }]}>{o.libelle}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cadre: { height: 40, flexDirection: 'row', padding: 3, gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.m },
  // Hauteur fixe : sur Android, un segment en flex dans le corps animé d'Appui s'écrase à 0 et son texte est rogné.
  segment: { height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.s },
});
