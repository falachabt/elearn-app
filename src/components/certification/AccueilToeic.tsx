import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { chargerAccueil, type DonneesAccueil } from '@/services/certification/accueil';
import { afficherJour } from '@/services/certification/format';
import { avancement } from '@/services/certification/seanceJour';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { CompteurCredits } from '../credits/CompteurCredits';
import { Ecran } from '../Ecran';
import { Cloche } from '../notifications/Cloche';
import { PreparationDiagnostic } from './PreparationDiagnostic';
import { BarreProgression, EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
import { useChargement } from './useChargement';

/** N1 · Accueil du profil TOEIC : objectif, séance du jour, score estimé, mots, reprise d'une série, accès rapides. */
export function AccueilToeic() {
  const { t } = useTraduction();
  const { etat, recharger } = useChargement(chargerAccueil);
  // Avant le diagnostic, le bouton reste fixé en bas (maquette TOEIC-S7), au-dessus de la barre d'onglets.
  const avantDiagnostic = etat.phase === 'ok' && !etat.valeur.diagnosticFait;
  const commencerDiagnostic = () => {
    suivre('cert_diagnostic_started', {});
    router.push('/certification/diagnostic');
  };
  return (
    <Ecran
      insetBas={false}
      entete={
        <EnteteToeic
          titre={t('certification.accueilToeic.entete')}
          droite={
            <View style={styles.droite}>
              <Cloche />
              <CompteurCredits />
            </View>
          }
        />
      }
      pied={avantDiagnostic ? <Bouton libelle={t('certification.arrivee.commencer')} onPress={commencerDiagnostic} /> : undefined}
    >
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
  const compte = d.plan?.dateTest && d.joursRestants !== null && d.joursRestants >= 0
    ? d.joursRestants === 0
      ? t('certification.accueilToeic.compteAujourdhui')
      : d.joursRestants === 1
        ? t('certification.accueilToeic.compteJour')
        : t('certification.accueilToeic.compteJours', { n: d.joursRestants })
    : null;
  const seance = d.seance;
  const commencee = !!seance && avancement(seance).faits > 0;
  const progressionSemaine = Math.min(100, (d.seancesSemaine.faites / Math.max(d.seancesSemaine.prevues, 1)) * 100);
  const partieSeance = seance?.seance.blocs.find((b) => b.type === 'serie')?.partie;
  const motsSeance = seance?.seance.blocs.find((b) => b.type === 'mots')?.nombre;
  const mots = d.motsAReviser === 1 ? t('certification.accueilToeic.motsUn') : t('certification.accueilToeic.motsN', { n: d.motsAReviser });
  const serie = d.serie;
  const aideSerie = serie
    ? serie.perimetre.rejeu
      ? t('certification.accueilToeic.serieAideRejeu', { k: serie.index, n: serie.questions.length })
      : t('certification.accueilToeic.serieAide', { partie: serie.perimetre.part ?? '', k: serie.index, n: serie.questions.length })
    : '';
  const aller = (chemin: string) => router.push(chemin as never);

  if (!d.diagnosticFait) return <PreparationDiagnostic complet={false} />;

  return (
    <View style={styles.groupe}>
      {d.revision.depuisCopie ? <Banniere ton="info" titre={t('certification.reviser.copie')} /> : null}
      {seance ? (
        // Carte verte comme la mission du jour du secondaire : le bouton reste à l'intérieur (maquette TOEIC-N1).
        <Carte style={{ backgroundColor: theme.marque.principale, gap: espace[2] }}>
          <View style={styles.ligne}>
            <View style={[styles.pastille, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.accueilToeic.seanceEtiquette', { minutes: seance.seance.minutes })}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.surCouleur }]}>{seance.seance.pourquoi.notion ?? t('certification.accueilToeic.seanceTitre')}</Text>
          {partieSeance !== undefined || motsSeance !== undefined ? (
            <View style={styles.ligneBadges}>
              {partieSeance !== undefined ? <Pastille texte={t('certification.diagnostic.partie', { n: partieSeance })} /> : null}
              {motsSeance !== undefined ? <Pastille texte={t('certification.accueilToeic.motsN', { n: motsSeance })} /> : null}
            </View>
          ) : null}
          <Bouton variante="secondaire" libelle={commencee ? t('certification.accueilToeic.continuer') : t('certification.accueilToeic.commencer')} onPress={() => aller('/certification/seance')} />
        </Carte>
      ) : d.seanceErreur ? (
        <Banniere ton="alerte" titre={t('certification.accueilToeic.erreurTitre')} texte={t('certification.accueilToeic.erreurTexte')} />
      ) : null}
      {compte && d.plan?.dateTest ? (
        <Carte>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteEtiquette')}</Text>
          <View style={styles.ligne}>
            <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{compte}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteDate', { date: afficherJour(d.plan.dateTest) })}</Text>
          </View>
          <BarreProgression pourcent={progressionSemaine} libelle={t('certification.accueilToeic.planBarre')} />
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.accueilToeic.planSemaine', { prevues: d.seancesSemaine.prevues, faites: d.seancesSemaine.faites })}</Text>
        </Carte>
      ) : null}
      <View style={styles.grille}>
        <Tuile titre={t('certification.accueilToeic.score')} aide={d.score !== null ? t('certification.accueilToeic.scoreExact', { score: d.score }) : t('certification.accueilToeic.scorePas')} />
        <Tuile titre={t('certification.accueilToeic.mots')} aide={mots} onPress={() => aller('/reviser?onglet=carnet')} />
      </View>
      {serie ? (
        <View style={styles.groupe}>
          <EtiquetteSection texte={t('certification.accueilToeic.reprendre')} />
          <LigneChoix icone={RotateCcw} titre={t('certification.accueilToeic.serieInterrompue')} aide={aideSerie} onPress={() => router.push({ pathname: '/certification/serie', params: { ...(serie.perimetre.part ? { part: String(serie.perimetre.part) } : {}), ...(serie.perimetre.notion ? { notion: serie.perimetre.notion } : {}), ...(serie.perimetre.rejeu ? { rejeu: '1' } : {}), ...(serie.origine ? { origine: serie.origine } : {}) } } as never)} />
        </View>
      ) : null}
      {!seance && d.seanceErreur ? <Bouton variante="secondaire" libelle={t('certification.reessayer')} onPress={recharger} /> : null}
    </View>
  );
}

/** Étiquette de la carte verte (maquette TOEIC-N1 : badges « Partie 5 », « 6 mots »). */
function Pastille({ texte }: { texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.pastille, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  droite: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  ligneBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espace[2] },
  pastille: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
});
