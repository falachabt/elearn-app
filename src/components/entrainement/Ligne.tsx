import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

type Props = {
  icone: ComponentProps<typeof Ionicons>['name'];
  titre: string;
  details?: string;
  fait?: boolean;
  /** Quiz et exercices se reconnaissent partout : pastille de couleur et étiquette propres à chacun. */
  genre?: { type: 'quiz' | 'exercice'; libelle: string };
  onPress: () => void;
};

export const COULEUR_GENRE = { quiz: matiere.maths, exercice: matiere.francais } as const;

/** Ligne d'entraînement : quiz, exercice ou chapitre, avec une coche verte quand c'est déjà fait. */
export function Ligne({ icone, titre, details, fait, genre, onPress }: Props) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={details ? `${titre}. ${details}` : titre} onPress={onPress} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre}>
      <View style={[styles.ligne, { backgroundColor: fait ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort }]}>
        {genre ? (
          <View style={[styles.pastille, { backgroundColor: COULEUR_GENRE[genre.type], borderColor: theme.bord.fort }]}>
            <Ionicons name={icone} size={20} color={theme.texte.surCouleur} />
          </View>
        ) : (
          <Ionicons name={fait ? 'checkmark-circle' : icone} size={22} color={fait ? theme.marque.principale : theme.texte.principal} />
        )}
        <View style={styles.flex}>
          {genre ? (
            <Text style={[typo.legende, styles.etiquette, { color: theme.texte.secondaire }]}>
              {genre.libelle}
              {fait ? '  ✓' : ''}
            </Text>
          ) : null}
          <Text numberOfLines={3} style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          {details ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{details}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.texte.secondaire} />
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pastille: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  etiquette: { textTransform: 'uppercase', letterSpacing: 0.5 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
