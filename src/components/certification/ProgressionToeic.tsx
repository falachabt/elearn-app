import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerAccueil } from '@/services/certification/accueil';
import { lirePlan } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { Tuile } from './ui';
import { useChargement } from './useChargement';

/** « Progression vers ton objectif » : visé et estimé, à la place de la carte XP de Moi (maquette TOEIC-N2). */
export function ProgressionToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat } = useChargement(lirePlan);
  const accueil = useChargement(chargerAccueil);
  const plage = accueil.etat.phase === 'ok' ? accueil.etat.valeur.plage : null;
  const plan = etat.phase === 'ok' ? etat.valeur : null;
  return (
    <Carte>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionEtiquette')}</Text>
      <View style={styles.grille}>
        <Tuile titre={t('certification.moiToeic.progressionVise')} aide={plan?.objectif ? String(plan.objectif) : t('certification.moiToeic.objectifVide')} />
        <Tuile titre={t('certification.moiToeic.progressionEstime')} aide={plage ?? t('certification.moiToeic.progressionPas')} />
      </View>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionNote')}</Text>
    </Carte>
  );
}

const styles = StyleSheet.create({ grille: { flexDirection: 'row', gap: espace[2] } });
