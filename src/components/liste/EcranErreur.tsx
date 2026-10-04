import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';

type Props = { titre: string; phrase: string; reessayer: string; onReessayer: () => void; secours?: { libelle: string; onPress: () => void } };

/** Erreur en plein écran (revue design, règle 7) : pastille corail, une phrase, « Réessayer », et ce qui marche hors ligne. */
export function EcranErreur({ titre, phrase, reessayer, onReessayer, secours }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.zone} accessibilityRole="alert">
      <View style={[styles.pastille, { backgroundColor: theme.etat.erreur, borderColor: theme.bord.fort }]}>
        <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>!</Text>
      </View>
      <Text style={[typo.h3, styles.centre, { color: theme.texte.principal }]}>{titre}</Text>
      <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{phrase}</Text>
      <View style={styles.boutons}>
        <Bouton libelle={reessayer} onPress={onReessayer} />
        {secours ? <Bouton variante="secondaire" libelle={secours.libelle} onPress={secours.onPress} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: espace[4], paddingVertical: espace[9] },
  pastille: { width: 64, height: 64, borderRadius: 32, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  centre: { textAlign: 'center' },
  boutons: { alignSelf: 'stretch', gap: espace[4], marginTop: espace[4] },
});
