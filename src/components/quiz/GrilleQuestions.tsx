import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { StatutQuestion } from '@/services/correction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, typo } from '@/theme/theme';

import { Appui } from '../Appui';

const ICONES = { juste: 'checkmark', faux: 'close', passe: 'remove' } as const;

/**
 * Grille des questions d'un quiz terminé (M5-10), 5 colonnes : vert = juste, corail = faux, orange = sans réponse, avec une icône
 * en plus de la couleur. Un appui ouvre la question et son explication.
 */
export function GrilleQuestions({ statuts, actuelle, onChoisir }: { statuts: StatutQuestion[]; actuelle?: number; onChoisir: (i: number) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const fond = { juste: theme.marque.principale, faux: theme.etat.erreur, passe: theme.etat.alerte };
  return (
    <View style={styles.grille}>
      {statuts.map((s, i) => (
        <Appui
          key={i}
          accessibilityRole="button"
          accessibilityLabel={t('correction.case', { n: i + 1, statut: t(`correction.${s}`) })}
          accessibilityState={{ selected: actuelle === i }}
          onPress={() => onChoisir(i)}
          style={styles.place}
          rayon={8}
          ombre={actuelle === i ? 0 : 2}
          decalage={2}
          couleurOmbre={theme.ombre}
        >
          <View style={[styles.case, { backgroundColor: fond[s], borderColor: theme.bord.fort, borderWidth: actuelle === i ? bord.epais : bord.normal }]}>
            <Text style={[typo.donnee, { color: theme.texte.surCouleur }]}>{i + 1}</Text>
            <Ionicons name={ICONES[s]} size={12} color={theme.texte.surCouleur} />
          </View>
        </Appui>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // 5 colonnes de cases carrées (revue design, écran 7).
  grille: { flexDirection: 'row', flexWrap: 'wrap', columnGap: '2.5%', rowGap: espace[4] },
  place: { width: '18%' },
  case: { aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
