import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { detailParPartie } from '@/services/certification/bilanMini';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { DetailParties } from './DetailParties';

/**
 * Bilan d'un test composé (maquette v39, TOEIC-V34-BILAN). Quand le test bat le meilleur précédent (ou premier test),
 * le gros chiffre est ce score, avec « ancien meilleur X ». Sinon le gros chiffre est la tentative, et dessous
 * « Ton meilleur reste X sur Y » : le meilleur ne baisse jamais.
 * `score` est le score de la tentative (valeur exacte du serveur) — jamais la borne haute d'une fourchette.
 * Sous la carte, le bloc « Détail par partie » du parcours « Fin de test » (maquette validée par Benny le 27/10/2026,
 * issue #128) quand `perPart` est fourni ; sans détail à montrer, la carte seule reste centrée comme en v39.
 * Variante mini-test par partie (`compte` fourni, écran 5 de la même maquette) : ce format n'a pas de score, la
 * carte montre le compte « bonnes sur total » et son aide, comme le bilan simple — jamais « Pas encore de score ».
 */
export function BilanDefinition({ score, meilleurAvant, max, perPart, compte }: { score: number | null; meilleurAvant: number | null; max: number | null; perPart?: Record<string, { answered: number; correct: number }>; compte?: { bonnes: number; total: number } }) {
  const avecDetail = perPart !== undefined && detailParPartie(perPart).length > 0;
  const { t } = useTraduction();
  const { theme } = useTheme();
  const nouveau = score !== null && (meilleurAvant === null || score > meilleurAvant);
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
    <View style={[styles.zone, avecDetail ? styles.zoneAvecDetail : null]}>
      {compte ? (
        <Carte style={{ gap: espace[2] }}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.scorePartie')}</Text>
          <Text style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.bilanMini.sur', { c: compte.bonnes, n: compte.total })}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.sansEstimation')}</Text>
        </Carte>
      ) : (
        <Carte style={{ gap: espace[1] }}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{titre}</Text>
          <Text style={[typo.donnee, { color: theme.texte.principal, fontSize: 52, lineHeight: 58 }]}>
            {score === null ? t('certification.tests.listes.pasDeScore') : String(score)}
          </Text>
          {nouveau && score !== null && max !== null ? (
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.bilanDef.surMax', { max })}</Text>
          ) : null}
          {nouveau && meilleurAvant !== null ? (
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.bilanDef.ancien', { score: meilleurAvant })}</Text>
          ) : null}
          {!nouveau && reste ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{reste}</Text> : null}
        </Carte>
      )}
      {perPart ? <DetailParties perPart={perPart} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Centre le bilan dans la zone libre au-dessus des boutons, comme la maquette v39 — sauf quand le bloc de
  // détail suit la carte (parcours « Fin de test ») : la zone ne grandit plus et le contenu part du haut,
  // comme la maquette validée, en laissant la suite de l'écran (grille d'un mini, par exemple) s'enchaîner.
  zone: { flexGrow: 1, justifyContent: 'center', minHeight: 240, gap: espace[5] },
  zoneAvecDetail: { flexGrow: 0, minHeight: 0, justifyContent: 'flex-start' },
});
