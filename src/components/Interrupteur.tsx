import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { cibleMin, espace, typo } from '@/theme/theme';

type Props = { libelle: string; aide?: string; valeur: boolean; onChange: (valeur: boolean) => void };

/** Interrupteur avec libellé et phrase d'aide. Couleurs du thème ; rôle « switch » pour les lecteurs d'écran. */
export function Interrupteur({ libelle, aide, valeur, onChange }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.ligne}>
      <View style={styles.texte}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{libelle}</Text>
        {aide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text> : null}
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={libelle}
        accessibilityState={{ checked: valeur }}
        value={valeur}
        onValueChange={onChange}
        trackColor={{ false: theme.bord.doux, true: theme.marque.principale }}
        thumbColor={theme.fond.surface}
        ios_backgroundColor={theme.bord.doux}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[5], minHeight: cibleMin },
  texte: { flex: 1, gap: espace[1] },
});
