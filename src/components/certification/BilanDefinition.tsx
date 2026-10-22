import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';

/**
 * Bilan d'un test composé (maquette v39, TOEIC-V34-BILAN). Quand le test bat le meilleur précédent (ou premier test),
 * le gros chiffre est ce score, avec « ancien meilleur X ». Sinon le gros chiffre est la tentative, et dessous
 * « Ton meilleur reste X sur Y » : le meilleur ne baisse jamais.
 */
export function BilanDefinition({ scoreMax, meilleurAvant, max }: { scoreMax: number | null; meilleurAvant: number | null; max: number | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const nouveau = scoreMax !== null && (meilleurAvant === null || scoreMax > meilleurAvant);
  const titre = nouveau
    ? t(meilleurAvant === null ? 'certification.tests.bilanDef.premier' : 'certification.tests.bilanDef.nouveau')
    : t('certification.tests.bilanDef.tentative');
  const reste =
    meilleurAvant === null
      ? null
      : max !== null
        ? t('certification.tests.bilanDef.reste', { score: meilleurAvant, max })
        : t('certification.tests.bilanDef.resteSansMax', { score: meilleurAvant });
  return (
    <View style={styles.zone}>
      <Carte style={{ gap: espace[1] }}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{titre}</Text>
        <Text style={[typo.donnee, { color: theme.texte.principal, fontSize: 52, lineHeight: 58 }]}>
          {scoreMax === null ? t('certification.tests.listes.pasDeScore') : String(scoreMax)}
        </Text>
        {nouveau && scoreMax !== null && max !== null ? (
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.bilanDef.surMax', { max })}</Text>
        ) : null}
        {nouveau && meilleurAvant !== null ? (
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.bilanDef.ancien', { score: meilleurAvant })}</Text>
        ) : null}
        {!nouveau && reste ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{reste}</Text> : null}
      </Carte>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centre le bilan dans la zone libre au-dessus des boutons, comme la maquette v39.
  zone: { flexGrow: 1, justifyContent: 'center', minHeight: 240 },
});
