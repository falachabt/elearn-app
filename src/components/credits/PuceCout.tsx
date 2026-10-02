import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { espace, rayon, typo } from '@/theme/theme';

import { useTextesCredits } from './textes';

export type EtatCout = 'payant' | 'inclus' | 'deja';

/** Puce du coût (K2b, K4) : « 2 crédits » en jaune, « Inclus dans ton pass » en vert, « Déjà ouvert » en neutre. */
export function PuceCout({ cout, etat = 'payant' }: { cout: number; etat?: EtatCout }) {
  const { theme } = useTheme();
  const { t, cout: texteCout } = useTextesCredits();
  const fond = etat === 'inclus' ? theme.marque.douce : etat === 'deja' ? theme.fond.creux : theme.accent.soleil;
  const texte = etat === 'inclus' ? t('credits.inclus') : etat === 'deja' ? t('credits.dejaOuvert') : texteCout(cout);
  return (
    <View style={[styles.puce, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Text style={[typo.boutonPetit, styles.texte, { color: etat === 'payant' ? theme.texte.surCouleur : theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  puce: { borderWidth: 1.5, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 2 },
  texte: { fontSize: 12, lineHeight: 16 },
});
