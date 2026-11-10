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
  /** Valeur marquée d'un point soleil, distincte de l'onglet consulté (page de changement de parcours, #125 : la famille ACTIVE). */
  marque?: T;
};

/** Barre d'onglets segmentée (revue design, écran 1) : coins 10/6 (Benny préfère moins arrondi), les segments se partagent la largeur, segment actif en `fond.inverse`, 40 px. Réviser, rythme, entraînement d'un chapitre, changement de parcours. */
export function Onglets<T extends string>({ valeurs, valeur, onChange, jaune, marque }: Props<T>) {
  const { theme, sombre } = useTheme();
  const doux = sombre ? corrige.dark : corrige.light;
  return (
    <View accessibilityRole="tablist" style={[styles.cadre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {valeurs.map((o) => {
        const actif = valeur === o.valeur;
        const enJaune = actif && o.valeur === jaune;
        return (
          <Appui key={o.valeur} style={styles.flex} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(o.valeur)} decalage={0} rayon={rayon.aucun}>
            <View style={[styles.segment, actif && (enJaune ? { backgroundColor: doux.fond } : { backgroundColor: theme.fond.inverse })]}>
              <Text style={[typo.boutonPetit, { color: enJaune ? doux.texte : actif ? theme.texte.inverse : theme.texte.principal }]}>{o.libelle}</Text>
              {o.valeur === marque ? <View testID="onglets-point-marque" style={[styles.point, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]} /> : null}
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Pas de marge ni d'écart : le segment actif remplit le cadre, et le cadre (overflow hidden) donne ses coins aux segments d'extrémité.
  cadre: { height: 40, flexDirection: 'row', overflow: 'hidden', borderWidth: bord.normal, borderRadius: rayon.m },
  // Hauteur fixe : sur Android, un segment en flex dans le corps animé d'Appui s'écrase à 0 et son texte est rogné.
  segment: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2] },
  point: { width: 9, height: 9, borderRadius: rayon.pilule, borderWidth: bord.fin },
});
