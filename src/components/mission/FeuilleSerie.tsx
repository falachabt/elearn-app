import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { SerieMission } from './SerieMission';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Série affichée (nombre de jours d'affilée). */
  serie: number;
  /** Jours joués (AAAA-MM-JJ), pour la bande de la semaine. */
  joues: readonly string[];
  /** Mission du jour pas encore faite : la feuille montre ce que coûte une journée ratée et propose de la faire. */
  enDanger: boolean;
  onFaireMission: () => void;
};

/**
 * Feuille de la série (bottom sheet) : ouverte par le badge de la série à l'accueil, et tout seul à l'ouverture de
 * l'app quand la série est en danger (mission du jour pas faite). En danger : simulation « maintenant / si tu rates »
 * et CTA « Faire ma mission du jour ».
 */
export function FeuilleSerie({ ouverte, onFermer, serie, joues, enDanger, onFaireMission }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const fermer = { libelle: t('offres.fermer'), onPress: onFermer, variante: 'secondaire' as const };

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      icone="flame"
      titre={enDanger ? t('mission.feuilleSerieTitreDanger') : t('mission.feuilleSerieTitre')}
      texte={enDanger ? t('mission.feuilleSerieTexteDanger') : t('mission.feuilleSerieTexte')}
      actions={enDanger ? [{ libelle: t('mission.feuilleSerieFaire'), onPress: onFaireMission }, fermer] : [fermer]}
    >
      <SerieMission serie={serie} joues={joues} compact />
      {enDanger ? (
        <View style={styles.simulation} accessible accessibilityLabel={`${t('mission.feuilleSerieMaintenant')} : ${serie}. ${t('mission.feuilleSerieSiRates')} : 0`}>
          <View style={styles.colonne}>
            <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>{serie}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('mission.feuilleSerieMaintenant')}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={theme.texte.secondaire} />
          <View style={styles.colonne}>
            <Text style={[typo.chiffreL, { color: theme.etat.alerte }]}>0</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('mission.feuilleSerieSiRates')}</Text>
          </View>
        </View>
      ) : null}
    </Feuille>
  );
}

const styles = StyleSheet.create({
  simulation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[5] },
  colonne: { alignItems: 'center', gap: espace[1] },
});
