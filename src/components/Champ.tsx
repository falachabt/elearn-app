import { useRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useRendreVisible } from '@/components/Ecran';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

/** `prefixe` : élément collé à gauche du champ (indicatif téléphonique), aligné sur lui même quand l'erreur s'affiche. */
type Props = TextInputProps & { libelle: string; erreur?: string; prefixe?: ReactNode };

/** Libellé toujours visible au-dessus du champ. L'erreur dit comment corriger. */
export function Champ({ libelle, erreur, prefixe, style, onFocus, ...reste }: Props) {
  const { theme } = useTheme();
  const rendreVisible = useRendreVisible();
  const zone = useRef<View>(null);
  return (
    <View ref={zone} style={styles.zone}>
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{libelle}</Text>
      <View style={styles.ligne}>
        {prefixe}
        <TextInput
          {...reste}
          onFocus={(e) => {
            rendreVisible?.(zone.current);
            onFocus?.(e);
          }}
          accessibilityLabel={libelle}
          placeholderTextColor={theme.texte.secondaire}
          style={[
            typo.texte,
            styles.champ,
            styles.flex,
            { color: theme.texte.principal, backgroundColor: theme.fond.surface, borderColor: erreur ? theme.etat.erreur : theme.bord.fort },
            style,
          ]}
        />
      </View>
      {erreur ? <Text style={[typo.petit, { color: theme.etat.erreurTexte }]}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: espace[2] },
  ligne: { flexDirection: 'row', alignItems: 'stretch', gap: espace[3] },
  flex: { flex: 1 },
  champ: { minHeight: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[5] },
});
