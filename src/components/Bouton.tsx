import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, rayon, typo } from '@/theme/theme';

type Variante = 'primaire' | 'secondaire' | 'accent' | 'danger' | 'texte';

type Props = {
  libelle: string;
  onPress: () => void;
  variante?: Variante;
  petit?: boolean;
  desactive?: boolean;
};

const DECALAGE = 4;

/** Un seul bouton primaire par écran, en bas, pleine largeur. Accent (jaune) réservé au pass. */
export function Bouton({ libelle, onPress, variante = 'primaire', petit, desactive }: Props) {
  const { theme } = useTheme();
  const fond =
    variante === 'primaire' ? theme.marque.principale
    : variante === 'accent' ? theme.accent.soleil
    : variante === 'danger' ? theme.etat.erreur
    : variante === 'secondaire' ? theme.fond.surface
    : 'transparent';
  const couleurTexte = variante === 'texte' ? theme.texte.lien : theme.texte.surCouleur;
  const plat = variante === 'texte';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desactive }}
      disabled={desactive}
      onPress={onPress}
      style={({ pressed }) => [styles.zone, { opacity: desactive ? 0.4 : 1, transform: [{ translateY: pressed && !plat ? DECALAGE : 0 }] }]}
    >
      {({ pressed }) => (
        <View>
          {!plat && <View style={[styles.ombre, { backgroundColor: theme.ombre, opacity: pressed ? 0 : 1 }]} />}
          <View
            style={[
              styles.corps,
              { minHeight: petit ? cibleMin - 8 : 52, backgroundColor: fond, borderColor: plat ? 'transparent' : theme.bord.fort },
            ]}
          >
            <Text style={[petit ? typo.boutonPetit : typo.bouton, { color: couleurTexte }]}>{libelle}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: { alignSelf: 'stretch', paddingBottom: DECALAGE, paddingRight: DECALAGE },
  ombre: { position: 'absolute', left: DECALAGE, top: DECALAGE, right: -DECALAGE, bottom: -DECALAGE, borderRadius: rayon.m },
  corps: { borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
