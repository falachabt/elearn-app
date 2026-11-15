import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerAccueil } from '@/services/certification/accueil';
import { lirePlan } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { BarreScoreObjectif } from './ui';
import { useChargement } from './useChargement';

/** Échelle du TOEIC et repères de la barre (retouche de novembre 2026, maquette TOEIC-N2 : même barre que dans les tests). */
const SCORE_MAX = 990;
const BORNES = [0, 200, 400, 600, 800];

/**
 * « Progression vers ton objectif » : un seul chiffre (le score moyen) et une barre avec repères verticaux vers l'objectif.
 * Plus de petites cartes Visé / Estimé / Écart ni de phrase sur le score estimé : le chiffre et la barre disent tout.
 */
export function ProgressionToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat } = useChargement(lirePlan);
  const accueil = useChargement(chargerAccueil);
  const score = accueil.etat.phase === 'ok' ? accueil.etat.valeur.score : null;
  const objectif = etat.phase === 'ok' ? (etat.valeur?.objectif ?? null) : null;
  return (
    <Carte>
      <View style={styles.contenu}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionEtiquette')}</Text>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.scoreMoyen')}</Text>
        <View style={styles.ligne}>
          {score !== null ? (
            <Text accessibilityRole="header" style={[typo.h1, styles.chiffre, { color: theme.texte.principal }]}>
              {score}
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{` ${t('certification.tests.listes.surMax', { max: SCORE_MAX })}`}</Text>
            </Text>
          ) : (
            <Text style={[typo.texteFort, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionPas')}</Text>
          )}
          {objectif !== null ? <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.accueilToeic.objectif', { score: objectif })}</Text> : null}
        </View>
        <BarreScoreObjectif valeur={score} max={SCORE_MAX} objectif={objectif} bornes={BORNES} libelle={t('certification.moiToeic.progressionEtiquette')} />
        <Bouton petit variante="texte" libelle={t('certification.moiToeic.progressionStatistiques')} onPress={() => router.push('/statistiques')} />
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[3] },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: espace[3] },
  chiffre: { fontSize: 40, lineHeight: 46 },
});
