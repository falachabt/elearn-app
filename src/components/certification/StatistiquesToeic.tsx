import { router } from 'expo-router';
import { Clock, History, Layers } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { chargerPageStats, PERIODES, type DonneesStats } from '@/services/certification/stats';
import type { PeriodeStats } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { CourbeTests } from './CourbeTests';
import { EncadrePointille, EnteteToeic, EtiquetteSection, LigneChoix, PastilleEtat, Squelette, Tuile } from './ui';
import { useChargement } from './useChargement';

const cle = (p: PeriodeStats) => `s${p}` as 's7' | 's30' | 's0';

/**
 * ST1 à ST4 · Statistiques : score estimé dans le temps, maîtrise par partie, temps passé, régularité, mots. Un seul
 * appel serveur par période ; la dernière réponse est gardée pour le hors ligne (ST4, datée). Les états vide (ST2) et
 * première semaine (ST3) sont des états de l'écran, pas des erreurs.
 */
export function StatistiquesToeic() {
  const { t } = useTraduction();
  const [periode, setPeriode] = useState<PeriodeStats>(7);
  const lire = useCallback(() => chargerPageStats(periode), [periode]);
  const { etat, recharger } = useChargement(lire);
  const vue = useRef<PeriodeStats | null>(null);

  const donnees = etat.phase === 'ok' ? etat.valeur : null;
  useEffect(() => {
    if (!donnees || vue.current === periode) return;
    vue.current = periode;
    suivre('cert_stats_viewed', { periode: cle(periode) });
  }, [donnees, periode]);

  const changer = (p: PeriodeStats) => {
    if (p === periode) return;
    suivre('cert_stats_period_changed', { periode: cle(p) });
    setPeriode(p);
  };

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.stats.entete')} />}>
      <Onglets valeurs={PERIODES.map((p) => ({ valeur: String(p), libelle: t(`certification.stats.periodes.${cle(p)}`) }))} valeur={String(periode)} onChange={(v) => changer(Number(v) as PeriodeStats)} />
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.stats.erreurTitre')} texte={t('certification.stats.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {donnees ? <Contenu donnees={donnees} /> : null}
    </Ecran>
  );
}

function Contenu({ donnees }: { donnees: DonneesStats }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { stats, depuisCopie } = donnees;
  const copie = depuisCopie && stats.calculeLe ? t('certification.stats.horsLigne', { date: new Date(stats.calculeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) }) : null;
  const masteryVue = useRef(false);
  const aDesParties = stats.status === 'ok' || stats.status === 'first_week';
  useEffect(() => {
    if (aDesParties && !masteryVue.current) {
      masteryVue.current = true;
      suivre('cert_mastery_viewed', { ecran: 'statistiques' });
    }
  }, [aDesParties]);

  if (donnees.expire) {
    return <Banniere ton="alerte" titre={t('certification.stats.expire.titre')} texte={t('certification.stats.expire.texte')} />;
  }
  if (stats.status === 'guest') {
    return (
      <View style={styles.groupe}>
        <Banniere ton="info" titre={t('certification.stats.invite.titre')} texte={t('certification.stats.invite.texte')} />
        <Bouton libelle={t('certification.stats.invite.action')} onPress={() => router.push('/compte/creer')} />
      </View>
    );
  }
  if (stats.status === 'empty') {
    return (
      <View style={styles.groupe}>
        {copie ? <Banniere ton="info" titre={copie} /> : null}
        <EncadrePointille texte={`${t('certification.stats.vide.titre')}. ${t('certification.stats.vide.texte')}`} />
        <Bouton libelle={t('certification.stats.vide.action')} onPress={() => router.push('/certification/seance' as never)} />
      </View>
    );
  }

  const tendance = stats.tendance === 'up' ? t('certification.stats.tendanceHausse') : stats.tendance === 'down' ? t('certification.stats.tendanceBaisse') : stats.tendance === 'stable' ? t('certification.stats.tendanceStable') : null;
  return (
    <>
      {copie ? <Banniere ton="info" titre={copie} /> : null}
      {stats.status === 'first_week' ? <Banniere ton="info" titre={t('certification.stats.premiere.titre')} texte={t('certification.stats.premiere.texte')} /> : null}
      <Carte style={{ gap: espace[2] }}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.stats.score')}</Text>
        <Text style={[typo.h1, { color: theme.texte.principal }]}>
          {stats.score && stats.score.valeur !== null ? String(stats.score.valeur) : t('certification.historique.pasEncore')}
        </Text>
        {tendance ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{tendance}</Text> : null}
        <CourbeTests />
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.stats.mention')}</Text>
      </Carte>
      <EtiquetteSection texte={t('certification.stats.maitrise')} />
      {stats.parties.map((p) => (
        <LigneChoix
          key={p.partie}
          icone={Layers}
          titre={t('certification.stats.partie', { n: p.partie })}
          aide={p.repondues === 0 ? t('certification.stats.partieAucune') : p.repondues === 1 ? t('certification.stats.partieAideUne') : t('certification.stats.partieAide', { n: p.repondues })}
          droite={<PastilleEtat etat={p.etat} libelle={t(`certification.resultat.etats.${p.etat}`)} />}
          onPress={() => router.push({ pathname: '/certification/partie', params: { n: String(p.partie) } } as never)}
        />
      ))}
      <EtiquetteSection texte={t('certification.stats.temps')} />
      <LigneChoix icone={Clock} titre={t('certification.stats.seances')} aide={t('certification.stats.seancesAide', { min: stats.minutesSeances })} />
      <LigneChoix icone={Clock} titre={t('certification.stats.lecture')} aide={t('certification.stats.lectureAide', { min: stats.minutesLecture })} />
      <EtiquetteSection texte={t('certification.stats.regularite')} />
      <View style={styles.tuiles}>
        <Tuile titre={stats.joursSur7 === 1 ? t('certification.stats.joursUn') : t('certification.stats.jours', { n: stats.joursSur7 })} aide={stats.serieJours === 1 ? t('certification.stats.serieUn') : t('certification.stats.serie', { n: stats.serieJours })} />
      </View>
      <EtiquetteSection texte={t('certification.stats.mots')} />
      <View style={styles.tuiles}>
        {/* Deux compteurs seulement, comme la maquette (« Connu » non dessiné, E-49) : même largeur pour les deux. */}
        <View style={styles.tuile}>
          <Tuile titre={String(stats.mots.aRevoir)} aide={t('certification.stats.motsRevoir')} onPress={() => router.push({ pathname: '/reviser', params: { onglet: 'carnet' } } as never)} />
        </View>
        <View style={styles.tuile}>
          <Tuile titre={String(stats.mots.enCours)} aide={t('certification.stats.motsProgres')} />
        </View>
      </View>
      <LigneChoix icone={History} titre={t('certification.stats.historique')} onPress={() => router.push('/certification/historique' as never)} />
    </>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  tuiles: { flexDirection: 'row', gap: espace[3] },
  tuile: { flex: 1 },
});
