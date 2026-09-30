import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

type Etat = 'neutre' | 'choisie' | 'bonne' | 'fausse';

/**
 * Choix de réponse. Corrigé, la lettre laisse place à une coche ou une croix dans un cadre plein plus foncé, à gauche
 * (maquette Figma) : la couleur n'est jamais le seul signal.
 */
export function OptionReponse({ lettre, texte, etat = 'neutre', onPress }: { lettre: string; texte: string; etat?: Etat; onPress?: () => void }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const fond = etat === 'bonne' ? theme.etat.succesDoux : etat === 'fausse' ? theme.etat.erreurDoux : etat === 'choisie' ? theme.marque.douce : theme.fond.surface;
  const corrige = etat === 'bonne' || etat === 'fausse';
  const plein = etat === 'bonne' ? theme.etat.succes : theme.etat.erreur;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: etat === 'choisie' }}
      accessibilityLabel={corrige ? `${texte}. ${t(etat === 'bonne' ? 'parametres.moments.success' : 'parametres.moments.error')}` : texte}
      onPress={onPress}
      style={[styles.zone, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: etat === 'neutre' ? bord.normal : bord.epais }]}
    >
      {corrige ? (
        <View testID={`marque-${etat}`} style={[styles.marque, { backgroundColor: plein, borderColor: theme.bord.fort }]}>
          <Ionicons name={etat === 'bonne' ? 'checkmark' : 'close'} size={20} color={theme.texte.surCouleur} />
        </View>
      ) : (
        <View style={[styles.marque, { borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{lettre}</Text>
        </View>
      )}
      <Text style={[typo.texte, styles.texte, { color: theme.texte.principal }]}>{texte}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { minHeight: cibleMin + 8, flexDirection: 'row', alignItems: 'center', gap: espace[4], paddingHorizontal: espace[5], borderRadius: rayon.m },
  marque: { width: 32, height: 32, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1 },
});
