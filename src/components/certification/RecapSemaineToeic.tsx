import { router } from 'expo-router';
import { BookOpen, CalendarDays, Clock3, MessagesSquare } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerPageStats } from '@/services/certification/stats';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';
import { useChargement } from './useChargement';

/** Récapitulatif TOEIC basé exclusivement sur les indicateurs serveur de la période glissante de 7 jours. */
export function RecapSemaineToeic() {
  const { t, langue } = useTraduction();
  const lire = useCallback(() => chargerPageStats(7), []);
  const { etat, recharger } = useChargement(lire);
  const { theme } = useTheme();
  const donnees = etat.phase === 'ok' ? etat.valeur : null;
  const stats = donnees?.stats;
  const copie = donnees?.depuisCopie && stats?.calculeLe
    ? t('certification.stats.horsLigne', { date: new Date(stats.calculeLe).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) })
    : null;
  const tendance = stats?.tendance === 'up'
    ? t('certification.stats.tendanceHausse')
    : stats?.tendance === 'down'
      ? t('certification.stats.tendanceBaisse')
      : stats?.tendance === 'stable'
        ? t('certification.stats.tendanceStable')
        : null;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.recapSemaine.entete')} onRetour={() => router.back()} />}>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.recapSemaine.periode')}</Text>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.stats.erreurTitre')} texte={t('certification.stats.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {donnees?.expire ? <Banniere ton="alerte" titre={t('certification.stats.expire.titre')} texte={t('certification.stats.expire.texte')} /> : null}
      {copie ? <Banniere ton="info" titre={copie} /> : null}
      {stats?.status === 'guest' ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.stats.invite.titre')} texte={t('certification.stats.invite.texte')} />
          <Bouton libelle={t('certification.stats.invite.action')} onPress={() => router.push('/compte/creer')} />
        </View>
      ) : null}
      {stats?.status === 'empty' && !donnees?.expire ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.stats.vide.titre')} texte={t('certification.stats.vide.texte')} />
          <Bouton libelle={t('certification.stats.vide.action')} onPress={() => router.push('/certification/seance' as never)} />
        </View>
      ) : null}
      {stats?.status === 'first_week' ? <Banniere ton="info" titre={t('certification.stats.premiere.titre')} texte={t('certification.stats.premiere.texte')} /> : null}
      {stats && (stats.status === 'ok' || stats.status === 'first_week') && !donnees?.expire ? (
        <>
          <Carte style={styles.score}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.stats.score')}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>
              {stats.score?.valeur !== null && stats.score?.valeur !== undefined ? String(stats.score.valeur) : t('certification.stats.courbe.pasEncore')}
            </Text>
            {stats.score?.min !== null && stats.score?.min !== undefined && stats.score.max !== null
              ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.stats.scorePlage', { min: stats.score.min, max: stats.score.max, total: donnees.scoreMax })}</Text>
              : null}
            {tendance ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{tendance}</Text> : null}
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.stats.mention')}</Text>
          </Carte>
          <EtiquetteSection texte={t('certification.recapSemaine.activite')} />
          <View style={styles.groupe}>
            <LigneChoix icone={MessagesSquare} titre={t('certification.recapSemaine.reponses')} aide={t('certification.recapSemaine.reponsesAide', { n: stats.reponsesTotal })} />
            <LigneChoix
              icone={CalendarDays}
              titre={t('certification.stats.seances')}
              aide={stats.seances === 1
                ? t('certification.recapSemaine.seancesAideUne', { min: stats.minutesSeances })
                : t('certification.recapSemaine.seancesAide', { n: stats.seances, min: stats.minutesSeances })}
            />
            <LigneChoix icone={BookOpen} titre={t('certification.stats.lecture')} aide={t('certification.stats.lectureAide', { min: stats.minutesLecture })} />
            <LigneChoix
              icone={Clock3}
              titre={t('certification.recapSemaine.regularite')}
              aide={stats.joursSur7 === 1 ? t('certification.stats.joursUn') : t('certification.stats.jours', { n: stats.joursSur7 })}
            />
          </View>
          <Bouton variante="secondaire" libelle={t('certification.recapSemaine.toutesStats')} onPress={() => router.push('/statistiques')} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  score: { gap: espace[2] },
});
