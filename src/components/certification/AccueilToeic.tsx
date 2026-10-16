import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerAccueil, type DonneesAccueil } from '@/services/certification/accueil';
import { afficherJour } from '@/services/certification/format';
import { avancement, pourquoiDeLaSeance } from '@/services/certification/seanceJour';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { CompteurCredits } from '../credits/CompteurCredits';
import { Ecran } from '../Ecran';
import { BarreProgression, EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
import { useChargement } from './useChargement';

/** N1 · Accueil du profil TOEIC : objectif, séance du jour, score estimé, mots, reprise d'une série, accès rapides. */
export function AccueilToeic() {
  const { t } = useTraduction();
  const { etat, recharger } = useChargement(chargerAccueil);
  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.accueilToeic.entete')} droite={<CompteurCredits />} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={5} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.accueilToeic.erreurTitre')} texte={t('certification.accueilToeic.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? <Contenu d={etat.valeur} recharger={recharger} /> : null}
    </Ecran>
  );
}

function Contenu({ d, recharger }: { d: DonneesAccueil; recharger: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const objectif = d.plan?.objectif;
  const ligneObjectif = !objectif
    ? null
    : d.joursRestants === null || d.joursRestants < 0
      ? t('certification.accueilToeic.objectif', { score: objectif })
      : d.joursRestants === 0
        ? t('certification.accueilToeic.objectifAujourdhui', { score: objectif })
        : d.joursRestants === 1
          ? t('certification.accueilToeic.objectifJour', { score: objectif })
          : t('certification.accueilToeic.objectifJours', { score: objectif, n: d.joursRestants });
  const compte = d.plan?.dateTest && d.joursRestants !== null && d.joursRestants >= 0
    ? d.joursRestants === 0
      ? t('certification.accueilToeic.compteAujourdhui')
      : d.joursRestants === 1
        ? t('certification.accueilToeic.compteJour')
        : t('certification.accueilToeic.compteJours', { n: d.joursRestants })
    : null;
  const seance = d.seance;
  const p = seance ? pourquoiDeLaSeance(seance.seance.pourquoi) : null;
  const av = seance ? avancement(seance) : null;
  const commencee = !!av && av.faits > 0;
  const mots = d.motsAReviser === 1 ? t('certification.accueilToeic.motsUn') : t('certification.accueilToeic.motsN', { n: d.motsAReviser });
  const serie = d.serie;
  const aideSerie = serie
    ? serie.perimetre.rejeu
      ? t('certification.accueilToeic.serieAideRejeu', { k: serie.index, n: serie.questions.length })
      : t('certification.accueilToeic.serieAide', { partie: serie.perimetre.part ?? '', k: serie.index, n: serie.questions.length })
    : '';
  const aller = (chemin: string) => router.push(chemin as never);

  return (
    <View style={styles.groupe}>
      {ligneObjectif ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{ligneObjectif}</Text> : null}
      {compte && d.plan?.dateTest ? (
        <Carte>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteEtiquette')}</Text>
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{compte}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteDate', { date: afficherJour(d.plan.dateTest) })}</Text>
        </Carte>
      ) : null}
      {d.revision.depuisCopie ? <Banniere ton="info" titre={t('certification.reviser.copie')} /> : null}
      {seance ? (
        <Carte>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.seanceEtiquette', { minutes: seance.seance.minutes })}</Text>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.accueilToeic.seanceTitre')}</Text>
          {p ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t(`certification.accueilToeic.${p.cle}`, p.params)}</Text> : null}
          {av && av.total > 0 ? <BarreProgression pourcent={(av.faits / av.total) * 100} libelle={t('certification.seanceJour.avancement', { k: av.faits, b: av.total })} /> : null}
        </Carte>
      ) : d.seanceErreur ? (
        <Banniere ton="alerte" titre={t('certification.accueilToeic.erreurTitre')} texte={t('certification.accueilToeic.erreurTexte')} />
      ) : null}
      <View style={styles.grille}>
        <Tuile titre={t('certification.accueilToeic.score')} aide={d.plage ? t('certification.accueilToeic.scorePlage', { min: d.plage.split(' à ')[0], max: d.plage.split(' à ')[1] }) : t('certification.accueilToeic.scorePas')} />
        <Tuile titre={t('certification.accueilToeic.mots')} aide={mots} onPress={() => aller('/reviser?onglet=carnet')} />
      </View>
      {serie ? (
        <View style={styles.groupe}>
          <EtiquetteSection texte={t('certification.accueilToeic.reprendre')} />
          <LigneChoix icone={RotateCcw} titre={t('certification.accueilToeic.serieInterrompue')} aide={aideSerie} onPress={() => router.push({ pathname: '/certification/serie', params: { ...(serie.perimetre.part ? { part: String(serie.perimetre.part) } : {}), ...(serie.perimetre.notion ? { notion: serie.perimetre.notion } : {}), ...(serie.perimetre.rejeu ? { rejeu: '1' } : {}), ...(serie.origine ? { origine: serie.origine } : {}) } } as never)} />
        </View>
      ) : null}
      <EtiquetteSection texte={t('certification.accueilToeic.acces')} />
      <View style={styles.grille}>
        <Tuile titre={t('certification.accueilToeic.parties')} aide={t('certification.accueilToeic.partiesAide')} onPress={() => aller('/certification/carte')} />
        <Tuile titre={t('certification.accueilToeic.cours')} aide={t('certification.accueilToeic.coursAide')} onPress={() => aller('/reviser?onglet=cours')} />
        <Tuile titre={t('certification.accueilToeic.carnet')} aide={t('certification.accueilToeic.carnetAide', { n: d.revision.carnet.filter((m) => m.boite === 1).length })} onPress={() => aller('/reviser?onglet=carnet')} />
      </View>
      {seance ? (
        <Bouton libelle={commencee ? t('certification.accueilToeic.continuer') : t('certification.accueilToeic.commencer')} onPress={() => aller('/certification/seance')} />
      ) : d.seanceErreur ? (
        <Bouton variante="secondaire" libelle={t('certification.reessayer')} onPress={recharger} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
});
