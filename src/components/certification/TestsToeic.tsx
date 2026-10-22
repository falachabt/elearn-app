import { router } from 'expo-router';
import { BookOpen, Clock, Headphones, Layers, NotebookPen, RotateCcw, Target, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { minutesSecondes } from '@/services/certification/format';
import { suiviDe, type SuiviTest } from '@/services/certification/suivi';
import { abandonnerMini, tempsRestantMs } from '@/services/certification/miniTest';
import { chargerTests, derniereEstimation, testsFaits, type DonneesTests } from '@/services/certification/testsAccueil';
import type { ProgressionTest } from '@/services/certification/types';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { stylePartie } from './partiesStyle';
import { BarreProgression, EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
import { CarteTest, type ProprietesCarteTest } from './CarteTest';
import { useChargement } from './useChargement';

/**
 * T1 · Onglet Tests : mini-tests (par partie, mixte), tests complets à venir, score estimé et tests faits. Quand un test
 * est gardé sur l'appareil, l'écran devient T3 (reprise). Les coûts viennent de `credit_actions`, jamais du code.
 */
export function TestsToeic() {
  const { t } = useTraduction();
  const { etat, recharger } = useChargement(chargerTests);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (etat.phase === 'ok') suivre('cert_tests_tab_viewed', {});
  }, [etat.phase]);

  // Un test périmé abandonné au chargement : on le dit une fois.
  const abandonAuto = etat.phase === 'ok' ? etat.valeur.abandonAuto : null;
  useEffect(() => {
    if (abandonAuto) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage(abandonAuto.rembourse ? t('certification.tests.abandonneRendu') : t('certification.tests.abandonne'));
    }
  }, [abandonAuto, t]);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.tests.entete')} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? (
        <>
          {message ? <Banniere ton="info" titre={message} /> : null}
          {etat.valeur.reprise ? (
            <Reprise donnees={etat.valeur} onAbandon={(rembourse) => { setMessage(rembourse ? t('certification.tests.abandonneRendu') : t('certification.tests.abandonne')); recharger(); }} />
          ) : (
            <Accueil donnees={etat.valeur} />
          )}
        </>
      ) : null}
    </Ecran>
  );
}

function Accueil({ donnees }: { donnees: DonneesTests }) {
  const { t } = useTraduction();
  const { solde, couts } = useCredits();
  const { cout } = useTextesCredits();
  const pass = !!solde?.illimite;
  const dixQ = couts.cert_mock_mini_ten;
  const vingtQ = couts.cert_mock_mini_twenty;
  const demiQ = couts.cert_mock_half;
  const completQ = couts.cert_mock_full;
  const total = donnees.reglages.objectifMax;
  const { theme, sombre } = useTheme();
  const minis = donnees.tentatives ?? [];
  const suiviMiniPartie = suiviDe(minis.filter((x) => x.part !== null), 'mini');
  const suiviMiniMixte = suiviDe(minis.filter((x) => x.part === null), 'mini');
  const progression = (kind: ProgressionTest['kind']) => donnees.progression?.find((p) => p.kind === kind);
  const pEcoute = progression('half_listening');
  const pLecture = progression('half_reading');
  const pComplet = progression('full');
  const corrigeQ = couts.cert_mock_review;
  const detail = (base: string, c: number | undefined) => (c === undefined || pass ? base : t('certification.tests.avecCout', { detail: base, cout: cout(c) }));
  const estimation = donnees.tentatives ? derniereEstimation(donnees.tentatives) : null;
  const faits = donnees.tentatives ? testsFaits(donnees.tentatives) : null;
  const couleurs = stylePartie(theme, sombre);

  // Statut en mots (maquette v37) : jamais la couleur seule.
  const statutProgression = (p: ProgressionTest | undefined): Pick<ProprietesCarteTest, 'statut' | 'libelleStatut'> => {
    const s = p?.statut ?? 'pas_fait';
    if (s === 'en_cours') return { statut: 'en_cours', libelleStatut: t('certification.tests.statut.enCours') };
    if (s === 'interrompu') return { statut: 'interrompu', libelleStatut: t('certification.tests.statut.interrompu') };
    if (s === 'fait') return { statut: 'fait', libelleStatut: t('certification.tests.statut.fait') };
    return { statut: 'vide', libelleStatut: t('certification.tests.statut.pasFait') };
  };
  const statutMini = (suivi: SuiviTest): Pick<ProprietesCarteTest, 'statut' | 'libelleStatut' | 'score'> => {
    const derniere = suivi.derniere;
    if (!derniere) return { statut: 'vide', libelleStatut: t('certification.tests.statut.pasFait') };
    // Un mini-test se lit en bonnes réponses sur le nombre de questions (« 8 sur 10 »), pas en score exact.
    const bonnes = Object.values(derniere.perPart ?? {}).reduce((somme, p) => somme + p.correct, 0);
    return { statut: 'fait', libelleStatut: t('certification.tests.statut.fait'), score: `${bonnes} sur ${derniere.length}` };
  };
  const scoreSur = (p: ProgressionTest | undefined, total: number) => (p?.meilleurScore !== null && p?.meilleurScore !== undefined ? `${p.meilleurScore} sur ${total}` : undefined);

  return (
    <>
      <EtiquetteSection texte={t('certification.tests.etiquetteMini')} />
      <CarteTest icone={Target} couleur={couleurs[1]!.couleur} titre={t('certification.tests.miniPartie')} sous={detail(t('certification.tests.detailMiniPartie'), dixQ)} {...statutMini(suiviMiniPartie)} onPress={() => router.push('/certification/choix-partie' as never)} />
      <CarteTest icone={Layers} couleur={couleurs[5]!.couleur} titre={t('certification.tests.miniMixte')} sous={detail(t('certification.tests.detailMiniMixte'), vingtQ)} {...statutMini(suiviMiniMixte)} onPress={() => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } } as never)} />
      <EtiquetteSection texte={t('certification.tests.etiquetteComplets')} />
      <CarteTest icone={Headphones} couleur={couleurs[3]!.couleur} titre={t('certification.tests.demiEcoute')} sous={detail(t('certification.tests.detailDemi'), demiQ)} {...statutProgression(pEcoute)} score={scoreSur(pEcoute, total / 2)} onPress={() => router.push({ pathname: '/certification/test-bientot', params: { kind: 'half' } } as never)} />
      <CarteTest icone={BookOpen} couleur={couleurs[4]!.couleur} titre={t('certification.tests.demiLecture')} sous={detail(t('certification.tests.detailDemi'), demiQ)} {...statutProgression(pLecture)} score={scoreSur(pLecture, total / 2)} onPress={() => router.push({ pathname: '/certification/test-bientot', params: { kind: 'half' } } as never)} />
      <CarteTest icone={Trophy} couleur={theme.marque.forte} titre={t('certification.tests.complet')} sous={detail(t('certification.tests.detailComplet'), completQ)} {...statutProgression(pComplet)} score={scoreSur(pComplet, total)} onPress={() => router.push({ pathname: '/certification/test-bientot', params: { kind: 'full' } } as never)} />
      <CarteTest icone={NotebookPen} couleur={sombre ? theme.texte.principal : theme.fond.surface} titre={t('certification.tests.corrige')} sous={detail(t('certification.tests.detailCorrige'), corrigeQ)} statut="vide" libelleStatut="" />
      <View style={styles.tuiles}>
        <Tuile
          titre={estimation ? t('certification.tests.scorePlage', { min: estimation.min, max: estimation.max, total }) : t('certification.tests.scoreVide')}
          aide={t('certification.tests.score')}
          onPress={() => router.push('/certification/historique' as never)}
        />
        <Tuile titre={faits === null ? '–' : String(faits)} aide={t('certification.tests.faits')} onPress={() => router.push('/certification/historique' as never)} />
      </View>
      {pass ? <Text style={[typo.petit, styles.centre]}>{t('certification.tests.inclus')}</Text> : null}
      <Bouton libelle={t('certification.tests.choisir')} onPress={() => router.push('/certification/mini' as never)} retour />
    </>
  );
}

function Reprise({ donnees, onAbandon }: { donnees: DonneesTests; onAbandon: (rembourse: boolean) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat, statut } = donnees.reprise!;
  const [confirme, setConfirme] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const total = etat.tentative.questions.length;
  const faites = etat.reponses.length;
  const reste = tempsRestantMs(etat);
  const r = donnees.reglages;
  const [maintenant] = useState(() => Date.now());
  const dansLaFenetre = maintenant <= etat.debutMs + r.fenetreRemboursementMin * 60_000;
  const gratuit = etat.tentative.credits_spent === 0;
  const sous = etat.partie === null ? t('certification.tests.reprise.sousMixte') : t('certification.tests.reprise.sousMini', { n: etat.partie });
  const avancement = faites === 0 ? t('certification.tests.reprise.avancementAucune') : faites === 1 ? t('certification.tests.reprise.avancementUne', { total }) : t('certification.tests.reprise.avancement', { faites, total });

  const reprendre = () => {
    suivre('cert_mock_resumed', { kind: etat.tentative.kind, minute: Math.floor((Date.now() - etat.debutMs) / 60_000) });
    router.push('/certification/mini-test' as never);
  };
  const abandonner = async () => {
    if (occupe) return;
    setOccupe(true);
    try {
      suivre('cert_mock_abandoned', { kind: etat.tentative.kind, minute: Math.floor((Date.now() - etat.debutMs) / 60_000) });
      const rep = await abandonnerMini(etat, 'user');
      setConfirme(false);
      onAbandon(rep.rembourse);
    } catch {
      // Sans réseau l'abandon n'est pas pris en compte : le test reste à reprendre.
      setConfirme(false);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <Carte style={{ gap: espace[3] }}>
        <View accessibilityRole="header" style={[styles.pastilleReprise, { backgroundColor: theme.etat.alerteDoux, borderColor: theme.bord.fort }]}>
          <RotateCcw size={14} color={theme.texte.principal} strokeWidth={2} />
          <Text style={[typo.legende, { color: theme.texte.principal }]}>{statut === 'a_rendre' ? t('certification.tests.reprise.termineTitre') : t('certification.tests.reprise.titre')}</Text>
        </View>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{sous}</Text>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{statut === 'a_rendre' ? t('certification.tests.reprise.termineTexte') : avancement}</Text>
        <BarreProgression pourcent={total ? (faites / total) * 100 : 0} libelle={avancement} />
      </Carte>
      {statut === 'en_cours' ? (
        <LigneChoix icone={Clock} titre={t('certification.tests.reprise.restant')} aide={minutesSecondes(reste)} />
      ) : null}
      {statut === 'en_cours' ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.reprise.aide')}</Text> : null}
      {statut === 'en_cours' ? (
        <Bouton libelle={t('certification.tests.reprise.reprendre')} onPress={reprendre} retour />
      ) : (
        <Bouton libelle={t('certification.tests.reprise.bilan')} onPress={() => router.push('/certification/mini-bilan' as never)} retour />
      )}
      <Bouton variante="secondaire" libelle={t('certification.tests.reprise.abandonner')} onPress={() => setConfirme(true)} />
      <Feuille
        ouverte={confirme}
        onFermer={() => setConfirme(false)}
        titre={t('certification.tests.reprise.confirmeTitre')}
        texte={gratuit ? t('certification.tests.reprise.confirmeGratuit') : dansLaFenetre ? t('certification.tests.reprise.confirmeRendu', { min: r.fenetreRemboursementMin }) : t('certification.tests.reprise.confirmeNonRendu', { min: r.fenetreRemboursementMin })}
        actions={[
          { libelle: t('certification.tests.reprise.confirmer'), onPress: () => void abandonner(), variante: 'secondaire' },
          { libelle: t('certification.tests.reprise.garder'), onPress: () => setConfirme(false), variante: 'texte' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  centre: { textAlign: 'center' },
  pastilleReprise: { flexDirection: 'row', alignItems: 'center', gap: espace[1], alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2 },
});
