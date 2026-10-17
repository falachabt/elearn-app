import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerAccueil } from '@/services/certification/accueil';
import { lirePlan } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { BarreProgression, Tuile } from './ui';
import { useChargement } from './useChargement';

/** « Progression vers ton objectif » : visé, estimé et écart, à la place de la carte XP de Moi (maquette TOEIC-N2). */
export function ProgressionToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat } = useChargement(lirePlan);
  const accueil = useChargement(chargerAccueil);
  const score = accueil.etat.phase === 'ok' ? accueil.etat.valeur.score : null;
  const plan = etat.phase === 'ok' ? etat.valeur : null;
  const objectif = plan?.objectif ?? null;
  // L'écart n'existe que si le score estimé et l'objectif sont connus : sinon pas de chiffre inventé.
  const ecart = score !== null && objectif !== null ? score - objectif : null;
  const pourcent = score !== null && objectif ? (score / objectif) * 100 : 0;
  return (
    <Carte>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionEtiquette')}</Text>
      <View style={styles.grille}>
        <Tuile titre={t('certification.moiToeic.progressionVise')} aide={objectif !== null ? String(objectif) : t('certification.moiToeic.objectifVide')} />
        <Tuile titre={t('certification.moiToeic.progressionEstime')} aide={score !== null ? t('certification.accueilToeic.scoreExact', { score }) : t('certification.moiToeic.progressionPas')} />
        <Tuile titre={t('certification.moiToeic.progressionEcart')} aide={ecart !== null ? t('certification.moiToeic.progressionEcartAide', { n: ecart }) : t('certification.moiToeic.progressionPas')} />
      </View>
      <BarreProgression pourcent={pourcent} libelle={t('certification.moiToeic.progressionEtiquette')} />
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionNote')}</Text>
      <Bouton petit variante="texte" libelle={t('certification.moiToeic.progressionStatistiques')} onPress={() => router.push('/statistiques')} />
    </Carte>
  );
}

const styles = StyleSheet.create({ grille: { flexDirection: 'row', gap: espace[2] } });
