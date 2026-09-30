import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from './Appui';

export type Variante = 'primaire' | 'secondaire' | 'accent' | 'danger' | 'texte';

type Props = {
  libelle: string;
  onPress: () => void;
  variante?: Variante;
  petit?: boolean;
  desactive?: boolean;
  /** Léger retour (vibration de sélection + tap) à l'appui. */
  retour?: boolean;
};

const DECALAGE = 4;

/** Couleurs d'une variante (texte, fond, bord, ombre), toutes issues des jetons du thème. Testées en contraste WCAG AA. */
export function couleursBouton(theme: Theme, variante: Variante, desactive = false) {
  if (desactive) {
    return { fond: theme.fond.creux, texte: theme.texte.secondaire, bord: theme.bord.doux, ombre: theme.bord.doux };
  }
  const fond =
    variante === 'primaire' ? theme.marque.principale
    : variante === 'accent' ? theme.accent.soleil
    : variante === 'danger' ? theme.etat.erreur
    : variante === 'secondaire' ? theme.fond.surface
    : 'transparent';
  const texte = variante === 'texte' ? theme.texte.lien : variante === 'secondaire' ? theme.texte.principal : theme.texte.surCouleur;
  return { fond, texte, bord: variante === 'texte' ? 'transparent' : theme.bord.fort, ombre: theme.ombre };
}

/** Un seul bouton primaire par écran, en bas, pleine largeur. Accent (jaune) réservé au pass. */
export function Bouton({ libelle, onPress, variante = 'primaire', petit, desactive, retour }: Props) {
  const { theme } = useTheme();
  const { fond, texte, bord: couleurBord, ombre } = couleursBouton(theme, variante, desactive);
  const plat = variante === 'texte';

  return (
    <Appui
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desactive }}
      disabled={desactive}
      retour={retour}
      onPress={onPress}
      decalage={plat ? 0 : DECALAGE}
      ombre={plat ? 0 : DECALAGE}
      couleurOmbre={ombre}
      rayon={rayon.m}
      style={styles.zone}
    >
      <View
        style={[
          styles.corps,
          { minHeight: petit ? cibleMin - 8 : 52, backgroundColor: fond, borderColor: couleurBord },
        ]}
      >
        <Text style={[petit ? typo.boutonPetit : typo.bouton, { color: texte }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  zone: { alignSelf: 'stretch' },
  corps: { borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
