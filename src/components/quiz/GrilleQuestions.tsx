import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { StatutQuestion } from '@/services/correction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

const ICONES = { juste: 'checkmark', faux: 'close', passe: 'remove' } as const;

/**
 * Grille des questions d'un quiz terminé (M5-10) : vert = juste, rouge = faux, orange = sans réponse, avec une icône
 * en plus de la couleur. Un appui ouvre la question et son explication.
 */
export function GrilleQuestions({ statuts, actuelle, onChoisir }: { statuts: StatutQuestion[]; actuelle?: number; onChoisir: (i: number) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const fond = { juste: theme.etat.succes, faux: theme.etat.erreur, passe: theme.etat.alerte };
  return (
    <View style={styles.grille}>
      {statuts.map((s, i) => (
        <Appui
          key={i}
          accessibilityRole="button"
          accessibilityLabel={t('correction.case', { n: i + 1, statut: t(`correction.${s}`) })}
          accessibilityState={{ selected: actuelle === i }}
          onPress={() => onChoisir(i)}
          rayon={rayon.s}
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
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  case: { width: 44, height: 44, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
});
