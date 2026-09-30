import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

type Props = TextInputProps & { libelle: string; erreur?: string };

/** Libellé toujours visible au-dessus du champ. L'erreur dit comment corriger. */
export function Champ({ libelle, erreur, style, ...reste }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.zone}>
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{libelle}</Text>
      <TextInput
        {...reste}
        accessibilityLabel={libelle}
        placeholderTextColor={theme.texte.secondaire}
        style={[
          typo.texte,
          styles.champ,
          { color: theme.texte.principal, backgroundColor: theme.fond.surface, borderColor: erreur ? theme.etat.erreur : theme.bord.fort },
          style,
        ]}
      />
      {erreur ? <Text style={[typo.petit, { color: theme.etat.erreurTexte }]}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: espace[2] },
  champ: { minHeight: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[5] },
});
