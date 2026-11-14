import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { detailParPartie } from '@/services/certification/bilanMini';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { DetailParties } from './DetailParties';

type Props = {
  score: number | null;
  meilleurAvant: number | null;
  max: number | null;
  perPart?: Record<string, { answered: number; correct: number }>;
  compte?: { bonnes: number; total: number };
  /** Ligne de contexte sous le score (« Partie 5 n° 1 · tentative 2 »). */
  contexte?: string;
};

/**
 * Bilan d'un test composé (maquette v39, TOEIC-V34-BILAN). Quand le test bat le meilleur précédent (ou premier test),
 * la carte est verte : le gros chiffre est ce score, avec « ancien meilleur X ». Sinon la carte est blanche, le gros chiffre
 * est la tentative, et dessous « Ton meilleur reste X sur Y » : le meilleur ne baisse jamais.
 * `score` est le score de la tentative (valeur exacte du serveur) — jamais la borne haute d'une fourchette.
 * Sous la carte, le bloc « Détail par partie » du parcours « Fin de test » (maquette validée par Benny le 27/10/2026,
 * issue #128) quand `perPart` est fourni ; sans détail à montrer, la carte seule reste centrée comme en v39.
 * Variante mini-test par partie (`compte` fourni) : ce format n'a pas de score, le gros chiffre est le compte de bonnes
 * réponses, « sur n » et l'ancien meilleur se lisent comme pour un test composé — jamais « Pas encore de score ».
 */
export function BilanDefinition({ score, meilleurAvant, max, perPart, compte, contexte }: Props) {
  const avecDetail = perPart !== undefined && detailParPartie(perPart).length > 0;
  const { t } = useTraduction();
  const { theme } = useTheme();
  const valeur = compte ? compte.bonnes : score;
  const echelle = compte ? compte.total : max;
  const nouveau = valeur !== null && (meilleurAvant === null || valeur > meilleurAvant);
  const titre = nouveau
    ? t(meilleurAvant === null ? 'certification.tests.bilanDef.premier' : 'certification.tests.bilanDef.nouveau')
    : t('certification.tests.bilanDef.tentative');
  const reste =
    meilleurAvant === null
      ? null
      : echelle !== null
        ? t('certification.tests.bilanDef.reste', { score: meilleurAvant, max: echelle })
        : t('certification.tests.bilanDef.resteSansMax', { score: meilleurAvant });
  // Carte verte quand le meilleur est battu (maquette v34), texte noir sur surface colorée ; blanche sinon.
  const fond = nouveau ? theme.marque.principale : theme.fond.surface;
  const encre = nouveau ? theme.texte.surCouleur : theme.texte.principal;
  const encreDouce = nouveau ? theme.texte.surCouleur : theme.texte.secondaire;
  return (
    <View style={[styles.zone, avecDetail ? styles.zoneAvecDetail : null]}>
      <Carte testID="bilan-carte" style={{ gap: espace[2], backgroundColor: fond }}>
        <Text style={[typo.h2, { color: encre }]}>{titre}</Text>
        <View style={styles.scoreLigne}>
          <Text style={[typo.chiffreL, { color: encre, fontSize: 52, lineHeight: 58 }]}>
            {valeur === null ? t('certification.tests.listes.pasDeScore') : String(valeur)}
          </Text>
          {valeur !== null && echelle !== null ? (
            <Text style={[typo.petit, { color: encreDouce }]}>{t('certification.tests.bilanDef.surMax', { max: echelle })}</Text>
          ) : null}
          {nouveau && meilleurAvant !== null ? (
            <Text style={[typo.petit, { color: encreDouce }]}>{t('certification.tests.bilanDef.ancien', { score: meilleurAvant })}</Text>
          ) : null}
        </View>
        {!nouveau && reste ? <Text style={[typo.petit, { color: encreDouce }]}>{reste}</Text> : null}
        {contexte ? <Text style={[typo.donnee, { color: encreDouce }]}>{contexte}</Text> : null}
        {compte ? <Text style={[typo.petit, { color: encreDouce }]}>{t('certification.bilanMini.sansEstimation')}</Text> : null}
      </Carte>
      {perPart ? <DetailParties perPart={perPart} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreLigne: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espace[2] },
  // Centre le bilan dans la zone libre au-dessus des boutons, comme la maquette v39 — sauf quand le bloc de
  // détail suit la carte (parcours « Fin de test ») : la zone ne grandit plus et le contenu part du haut,
  // comme la maquette validée, en laissant la suite de l'écran (grille d'un mini, par exemple) s'enchaîner.
  zone: { flexGrow: 1, justifyContent: 'center', minHeight: 240, gap: espace[5] },
  zoneAvecDetail: { flexGrow: 0, minHeight: 0, justifyContent: 'flex-start' },
});
