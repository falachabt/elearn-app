import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

type Etat = 'neutre' | 'choisie' | 'bonne' | 'fausse';

/** La couleur n'est jamais le seul signal : coche ou croix en plus. */
export function OptionReponse({ lettre, texte, etat = 'neutre', onPress }: { lettre: string; texte: string; etat?: Etat; onPress?: () => void }) {
  const { theme } = useTheme();
  const fond = etat === 'bonne' ? theme.etat.succesDoux : etat === 'fausse' ? theme.etat.erreurDoux : etat === 'choisie' ? theme.marque.douce : theme.fond.surface;
  const marque = etat === 'bonne' ? '✓' : etat === 'fausse' ? '✕' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: etat === 'choisie' }}
      onPress={onPress}
      style={[styles.zone, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: etat === 'neutre' ? bord.normal : bord.epais }]}
    >
      <View style={[styles.lettre, { borderColor: theme.bord.fort }]}>
        <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{lettre}</Text>
      </View>
      <Text style={[typo.texte, styles.texte, { color: theme.texte.principal }]}>{texte}</Text>
      {marque ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{marque}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { minHeight: cibleMin + 8, flexDirection: 'row', alignItems: 'center', gap: espace[4], paddingHorizontal: espace[5], borderRadius: rayon.m },
  lettre: { width: 28, height: 28, borderRadius: rayon.pilule, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1 },
});
