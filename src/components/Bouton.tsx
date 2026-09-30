import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

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
  const couleurTexte = variante === 'texte' ? theme.texte.lien : variante === 'secondaire' ? theme.texte.principal : theme.texte.surCouleur;
  const plat = variante === 'texte';

  return (
    <Appui
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desactive }}
      disabled={desactive}
      onPress={onPress}
      decalage={plat ? 0 : DECALAGE}
      ombre={plat ? 0 : DECALAGE}
      couleurOmbre={theme.ombre}
      rayon={rayon.m}
      style={[styles.zone, { opacity: desactive ? 0.4 : 1 }]}
    >
      <View
        style={[
          styles.corps,
          { minHeight: petit ? cibleMin - 8 : 52, backgroundColor: fond, borderColor: plat ? 'transparent' : theme.bord.fort },
        ]}
      >
        <Text style={[petit ? typo.boutonPetit : typo.bouton, { color: couleurTexte }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  zone: { alignSelf: 'stretch' },
  corps: { borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
