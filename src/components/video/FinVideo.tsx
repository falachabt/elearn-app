import { RotateCcw } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon } from '@/theme/theme';

type Props = {
  testID?: string;
  etiquette: string;
  /** Action principale (verte) : « M'entraîner sur cette notion », « Faire le quiz du cours ». */
  principal?: { libelle: string; onPress: () => void };
  /** Action secondaire (contour) : « Partie suivante ». */
  secondaire?: { libelle: string; onPress: () => void };
  revoir: { libelle: string; onPress: () => void };
};

/** Écran de fin posé sur l'image d'une vidéo (maquettes v6 et VIDEO-COURS) : étiquette, jusqu'à deux choix et « Revoir la vidéo ». */
export function FinVideo({ testID, etiquette, principal, secondaire, revoir }: Props) {
  const { theme } = useTheme();
  return (
    <View testID={testID} style={styles.fin}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      {principal ? (
        <Pressable accessibilityRole="button" onPress={principal.onPress} style={[styles.principal, { backgroundColor: theme.marque.principale }]}>
          <Text style={styles.principalTexte}>{principal.libelle}</Text>
        </Pressable>
      ) : null}
      {secondaire ? (
        <Pressable accessibilityRole="button" onPress={secondaire.onPress} style={styles.secondaire}>
          <Text style={styles.secondaireTexte}>{secondaire.libelle}</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={revoir.onPress} style={styles.revoir}>
        <RotateCcw size={16} color={palette.papier[50]} strokeWidth={2.4} />
        <Text style={styles.revoirTexte}>{revoir.libelle}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fin: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,10,0.78)', alignItems: 'center', justifyContent: 'center', gap: espace[2], padding: espace[4] },
  etiquette: { fontFamily: 'SpaceMono-Bold', fontSize: 11, letterSpacing: 0.8, color: palette.papier[50] },
  principal: { alignSelf: 'stretch', minHeight: 44, borderWidth: bord.normal, borderColor: palette.encre[1000], borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  principalTexte: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, color: palette.encre[1000] },
  secondaire: { alignSelf: 'stretch', minHeight: 40, borderWidth: bord.normal, borderColor: palette.papier[50], borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  secondaireTexte: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: palette.papier[50] },
  revoir: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4] },
  revoirTexte: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: palette.papier[50] },
});
