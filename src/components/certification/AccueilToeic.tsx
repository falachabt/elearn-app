import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireProfil, type Profil } from '@/services/profil';
import { chargerAccueil, type DonneesAccueil } from '@/services/certification/accueil';
import { chargerPageStats } from '@/services/certification/stats';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { CompteurCredits } from '../credits/CompteurCredits';
import { Ecran } from '../Ecran';
import { SelecteurClasse } from '../mission/Accueil';
import { Cloche } from '../notifications/Cloche';
import { AnneauObjectif } from './AnneauObjectif';
import { ParcoursDuJour, PiedFrise, useFrise } from './FriseParcours';
import { PreparationDiagnostic } from './PreparationDiagnostic';
import { BarreProgression, EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';
import { useChargement } from './useChargement';

/** N1 · Accueil du profil TOEIC : séance du jour, compteur avant le test, parcours du jour, reprise d'une série. */
export function AccueilToeic() {
  const { t } = useTraduction();
  const { etat, recharger } = useChargement(chargerAccueil);
  // Le cercle lit le même score que l'écran Statistiques (période « Tout »), pas le score du diagnostic.
  const statistiques = useChargement(chargerScoreAccueil);
  const frise = useFrise();
  // Chip changeur de profil en haut à gauche, comme sur les accueils élève et concours
  // (demande de Benny du 25/10/2026) : le profil local donne le libellé (l'examen en cours).
  // Relu à chaque retour sur l'onglet : le retour de `/profil/changer` met le chip à jour.
  const [profil, setProfil] = useState<Profil | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void lireProfil()
        .then((p) => vivant && setProfil(p))
        .catch(() => {});
      return () => {
        vivant = false;
      };
    }, []),
  );
  // Avant le diagnostic, le bouton reste fixé en bas (maquette TOEIC-S7), au-dessus de la barre d'onglets.
  const avantDiagnostic = etat.phase === 'ok' && !etat.valeur.diagnosticFait;
  const commencerDiagnostic = () => {
    suivre('cert_diagnostic_started', {});
    router.push('/certification/diagnostic');
  };
  return (
    <Ecran piedBordure
      insetBas={false}
      entete={
        <EnteteToeic
          titre={t('certification.accueilToeic.entete')}
          gauche={profil ? <SelecteurClasse profil={profil} /> : <View />}
          droite={
            <View style={styles.droite}>
              <Cloche pourInvite />
              <CompteurCredits />
            </View>
          }
        />
      }
      pied={avantDiagnostic ? <Bouton libelle={t('certification.arrivee.commencer')} onPress={commencerDiagnostic} /> : etat.phase === 'ok' && frise.etat.phase === 'ok' ? <PiedFrise donnees={frise.etat.valeur} /> : undefined}
    >
      {etat.phase === 'chargement' ? <Squelette lignes={5} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.accueilToeic.erreurTitre')} texte={t('certification.accueilToeic.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? <Contenu d={etat.valeur} recharger={recharger} frise={frise} score={(statistiques.etat.phase === 'ok' ? statistiques.etat.valeur : null) ?? etat.valeur.score} /> : null}
    </Ecran>
  );
}

/** « 27 novembre 2026 » (maquette N1) : jour de l'examen en toutes lettres, dans la langue de l'app. */
function dateLongue(jour: string, langue: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(a!, m! - 1, j!).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Score estimé de la page Statistiques (période « Tout »), plafonné à l'échelle de l'examen ; `null` sans estimation. */
async function chargerScoreAccueil(): Promise<number | null> {
  const r = await chargerPageStats(0);
  const valeur = r.stats.score?.valeur ?? null;
  return valeur === null ? null : Math.min(valeur, r.scoreMax);
}

function Contenu({ d, recharger, frise, score }: { d: DonneesAccueil; recharger: () => void; frise: ReturnType<typeof useFrise>; score: number | null }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const compte = d.plan?.dateTest && d.joursRestants !== null && d.joursRestants >= 0
    ? d.joursRestants === 0
      ? t('certification.accueilToeic.compteAujourdhui')
      : d.joursRestants === 1
        ? t('certification.accueilToeic.compteJour')
        : t('certification.accueilToeic.compteJours', { n: d.joursRestants })
    : null;
  const progressionSemaine = Math.min(100, (d.seancesSemaine.faites / Math.max(d.seancesSemaine.prevues, 1)) * 100);
  const serie = d.serie;
  const aideSerie = serie
    ? serie.perimetre.rejeu
      ? t('certification.accueilToeic.serieAideRejeu', { k: serie.index, n: serie.questions.length })
      : serie.perimetre.part
        ? t('certification.accueilToeic.serieAide', { partie: serie.perimetre.part, k: serie.index, n: serie.questions.length })
        : t('certification.accueilToeic.serieAideSansPartie', { k: serie.index, n: serie.questions.length })
    : '';

  if (!d.diagnosticFait) return <PreparationDiagnostic complet={false} />;

  return (
    <View style={styles.groupe}>
      {d.revision.depuisCopie ? <Banniere ton="info" titre={t('certification.reviser.copie')} /> : null}
      {/* La carte à deux colonnes reste toujours là : sans date ou sans objectif, elle invite à les fixer (jamais masquée). */}
      <View style={styles.grille}>
        <View style={styles.grilleGauche}>
          <Appui
            accessibilityRole="button"
            accessibilityLabel={d.plan?.dateTest ? undefined : `${t('certification.accueilToeic.sansDateTitre')}. ${t('certification.accueilToeic.sansDateAide')}`}
            onPress={d.plan?.dateTest ? undefined : () => router.push({ pathname: '/certification/objectif', params: { modifier: '1' } } as never)}
            decalage={0}
            rayon={14}
          >
            <Carte style={[styles.carteGrille, { gap: espace[3], justifyContent: 'space-between' }]}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteEtiquette')}</Text>
              {compte && d.plan?.dateTest ? (
                <>
                  <View style={styles.colonne}>
                    <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{compte}</Text>
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.compteDate', { date: dateLongue(d.plan.dateTest, langue) })}</Text>
                  </View>
                  <BarreProgression pourcent={progressionSemaine} libelle={t('certification.accueilToeic.planBarre')} />
                </>
              ) : (
                <View style={styles.colonne}>
                  <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('certification.accueilToeic.sansDateTitre')}</Text>
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.accueilToeic.sansDateAide')}</Text>
                </View>
              )}
            </Carte>
          </Appui>
        </View>
        <View style={styles.grilleDroite}>
          <Carte style={[styles.carteGrille, { gap: espace[2], alignItems: 'center', justifyContent: 'center' }]}>
            {d.plan?.objectif != null ? (
              <>
                <AnneauObjectif score={score} objectif={d.plan.objectif} taille={84} />
                <Text style={[typo.petit, { color: theme.texte.secondaire, textAlign: 'center' }]}>{t('certification.accueilToeic.objectif', { score: d.plan.objectif })}</Text>
              </>
            ) : (
              <Appui
                accessibilityRole="button"
                accessibilityLabel={t('certification.accueilToeic.objectifFixer')}
                onPress={() => router.push({ pathname: '/certification/objectif', params: { modifier: '1' } } as never)}
                decalage={0}
                rayon={48}
              >
                <View style={[styles.anneauVide, { borderColor: theme.bord.fort }]}>
                  <Text style={[typo.petit, { color: theme.texte.secondaire, textAlign: 'center' }]}>{t('certification.accueilToeic.objectifFixer')}</Text>
                </View>
              </Appui>
            )}
          </Carte>
        </View>
      </View>
      <ParcoursDuJour frise={frise} />
      {serie ? (
        <View style={styles.groupe}>
          <EtiquetteSection texte={t('certification.accueilToeic.reprendre')} />
          <LigneChoix icone={RotateCcw} titre={t('certification.accueilToeic.serieInterrompue')} aide={aideSerie} onPress={() => router.push({ pathname: '/certification/serie', params: { ...(serie.perimetre.part ? { part: String(serie.perimetre.part) } : {}), ...(serie.perimetre.notion ? { notion: serie.perimetre.notion } : {}), ...(serie.perimetre.rejeu ? { rejeu: '1' } : {}), ...(serie.origine ? { origine: serie.origine } : {}) } } as never)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  grille: { flexDirection: 'row', gap: espace[3], alignItems: 'stretch' },
  grilleGauche: { flex: 3, minWidth: 0 },
  // Même hauteur pour les deux cartes de la grille (demande de Benny) : la plus haute fixe la hauteur.
  carteGrille: { minHeight: 136 },
  grilleDroite: { flex: 2, minWidth: 0 },
  colonne: { gap: 2 },
  anneauVide: { width: 96, height: 96, borderRadius: 48, borderWidth: bord.normal, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: espace[2] },
  // marginLeft auto : la cloche et les crédits restent à droite, même quand l'en-tête est étroit (web).
  droite: { flexDirection: 'row', alignItems: 'center', gap: espace[2], marginLeft: 'auto' },
  ligneBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espace[2] },
  pastille: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  invitation: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: 78, padding: espace[3], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: 14 },
  invitationIcone: { width: 40, height: 40, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  invitationTexte: { flex: 1, minWidth: 0, gap: 2 },
});
