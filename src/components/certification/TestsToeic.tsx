import { router } from 'expo-router';
import { BookOpen, Clock, Layers, RotateCcw, Target, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { minutesSecondes } from '@/services/certification/format';
import { progressionDemi } from '@/services/certification/suivi';
import type { ProgressionTest } from '@/services/certification/types';
import { abandonnerMini, tempsRestantMs } from '@/services/certification/miniTest';
import { chargerTests, derniereEstimation, testsFaits, type DonneesTests } from '@/services/certification/testsAccueil';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { BarreProgression, EnteteToeic, EtiquetteSection, LigneChoix, Squelette, Tuile } from './ui';
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

/** Statut d'un test sur sa carte (maquette v33) : en mots, jamais seulement une couleur. */
function ligneSuivi(t: ReturnType<typeof useTraduction>['t'], p: ProgressionTest, total: number): string {
  if (p.statut === 'en_cours') return t('certification.tests.suivi.enCours');
  if (p.statut === 'interrompu') return t('certification.tests.suivi.interrompu');
  if (p.statut === 'pas_fait' || p.dernierScore === null) return t('certification.tests.suivi.pasFait');
  return t('certification.tests.suivi.fait', { dernier: p.dernierScore, total, meilleur: p.meilleurScore ?? p.dernierScore, n: p.tentatives });
}

function avecSuivi(t: ReturnType<typeof useTraduction>['t'], detail: string, p: ProgressionTest | undefined, total: number) {
  return p ? `${ligneSuivi(t, p, total)} · ${detail}` : detail;
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
  const suiviDemi = donnees.progression ? progressionDemi(donnees.progression) : undefined;
  const suiviComplet = donnees.progression?.find((p) => p.kind === 'full');
  const corrigeQ = couts.cert_mock_review;
  const detail = (base: string, c: number | undefined) => (c === undefined || pass ? base : t('certification.tests.avecCout', { detail: base, cout: cout(c) }));
  const estimation = donnees.tentatives ? derniereEstimation(donnees.tentatives) : null;
  const faits = donnees.tentatives ? testsFaits(donnees.tentatives) : null;

  return (
    <>
      <EtiquetteSection texte={t('certification.tests.etiquetteMini')} />
      <LigneChoix icone={Target} titre={t('certification.tests.miniPartie')} aide={detail(t('certification.tests.detailMiniPartie'), dixQ)} onPress={() => router.push({ pathname: '/certification/mini', params: { mode: 'partie' } } as never)} />
      <LigneChoix icone={Layers} titre={t('certification.tests.miniMixte')} aide={detail(t('certification.tests.detailMiniMixte'), vingtQ)} onPress={() => router.push({ pathname: '/certification/mini', params: { mode: 'mixte' } } as never)} />
      <EtiquetteSection texte={t('certification.tests.etiquetteComplets')} />
      <LigneChoix icone={Trophy} titre={t('certification.tests.demi')} aide={avecSuivi(t, detail(t('certification.tests.detailDemi'), demiQ), suiviDemi, total / 2)} onPress={() => router.push({ pathname: '/certification/test-bientot', params: { kind: 'half' } } as never)} />
      <LigneChoix icone={Trophy} titre={t('certification.tests.complet')} aide={avecSuivi(t, detail(t('certification.tests.detailComplet'), completQ), suiviComplet, total)} onPress={() => router.push({ pathname: '/certification/test-bientot', params: { kind: 'full' } } as never)} />
      <LigneChoix icone={BookOpen} titre={t('certification.tests.corrige')} aide={detail(t('certification.tests.detailCorrige'), corrigeQ)} />
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
