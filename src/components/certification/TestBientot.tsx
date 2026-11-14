import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Layers } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { etapeDemarrage, signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirApi } from '@/services/certification/api';
import { lancerTest } from '@/services/certification/miniTest';
import type { ProgressionTest, TestFixe, TypeTestFixe } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { avecSuivi } from './suiviLignes';
import { EnteteToeic, LigneChoix } from './ui';

/** T5 · Demi-test (écoute ou lecture, 100 questions) et test complet (200 questions). Le serveur tire les questions et débite au lancement. */
export function TestBientot() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const { garde, banniere } = useGardeReseau();
  const { couts } = useCredits();
  const { cout } = useTextesCredits();
  const demiCout = couts.cert_mock_half;
  const completCout = couts.cert_mock_full;
  const vingtCout = couts.cert_mock_mini_twenty;
  const suiviMoitie = (kind: 'half_listening' | 'half_reading') => (totalDemi === null ? undefined : progression?.find((p) => p.kind === kind));
  const avecCout = (base: string) => (demiCout === undefined ? base : `${base} · ${cout(demiCout)}`);
  const [test, setTest] = useState<TestFixe | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [manque, setManque] = useState(false);
  // Suivi des moitiés (maquette v33, DEMI-SUIVI) : le score se lit sur la moitié du total (495 sur 990).
  const [progression, setProgression] = useState<ProgressionTest[] | null>(null);
  const [totalDemi, setTotalDemi] = useState<number | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const exam = (await lireProfil())?.exam ?? 'toeic';
        const tests = await obtenirApi().listerTests(exam);
        if (vivant) setTest(tests[0] ?? null);
        const [suivi, reglages] = await Promise.all([obtenirApi().lireProgressionTests().catch(() => null), obtenirReglages().catch(() => null)]);
        if (vivant) {
          setProgression(suivi);
          setTotalDemi(reglages ? reglages.objectifMax / 2 : null);
        }
      } catch (erreur) {
        if (vivant) setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const lancer = async (type: TypeTestFixe) => {
    if (!test || enCours) return;
    setEnCours(true);
    setCodeEchec(null);
    setManque(false);
    try {
      const exam = await etapeDemarrage('profil', async () => (await lireProfil())?.exam ?? 'toeic');
      const demo = __DEV__ && process.env.EXPO_PUBLIC_CERT_DEMO === '1';
      const res = demo ? await lancerTest(exam, test.id, type) : await garde(() => lancerTest(exam, test.id, type));
      if (!res) return;
      if (res.statut === 'compte_requis') router.push('/compte/creer');
      else if (res.statut === 'insuffisant') setManque(true);
      else {
        suivre('cert_mock_started', { kind: type });
        router.replace('/certification/mini-test' as never);
      }
    } catch (erreur) {
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(false);
    }
  };

  const demi = kind === 'half';

  return (
    <Ecran
      entete={<EnteteToeic titre={demi ? t('certification.tests.demi') : t('certification.tests.bientotEntete')} onRetour={() => router.back()} />}
      pied={
        demi ? null : (
          <View style={styles.pied}>
            {/* Test complet : « Bientôt » (maquette T6), bouton désactivé, aucun départ. */}
            <Bouton libelle={t('certification.tests.bientotLancer')} desactive onPress={() => {}} />
          </View>
        )
      }
    >
      {banniere}
      {demi ? (
        <Carte style={{ gap: espace[2] }}>
          <View style={styles.titre}>
            <Clock size={20} color={theme.texte.principal} strokeWidth={2} />
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.tests.demiTitre')}</Text>
          </View>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.demiTexte')}</Text>
          {chargement ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.chargement')}</Text> : null}
          {!chargement && test === null ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.indisponible')}</Text> : null}
          {manque ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.creditsInsuffisants')}</Text> : null}
          {codeEchec ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.mini.erreurCode', { code: codeEchec })}</Text> : null}
        </Carte>
      ) : (
        <Carte style={{ gap: espace[3] }}>
          <View style={[styles.pastille, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <Clock size={14} color={theme.texte.surCouleur} strokeWidth={2} />
            <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('certification.tests.bientotTitre')}</Text>
          </View>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.tests.bientotSousTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.bientotTexte')}</Text>
        </Carte>
      )}
      {demi ? (
        <>
          <LigneChoix icone={Layers} titre={t('certification.tests.ecouteTitre')} aide={avecSuivi(t, avecCout(t('certification.tests.ecouteAide')), suiviMoitie('half_listening'), totalDemi ?? 0)} onPress={() => void lancer('half_listening')} />
          <LigneChoix icone={Layers} titre={t('certification.tests.lectureTitre')} aide={avecSuivi(t, avecCout(t('certification.tests.lectureAide')), suiviMoitie('half_reading'), totalDemi ?? 0)} onPress={() => void lancer('half_reading')} />
        </>
      ) : (
        <>
          <LigneChoix
            icone={Layers}
            titre={t('certification.tests.bientotMixteTitre')}
            aide={vingtCout === undefined ? t('certification.tests.bientotMixteAide') : t('certification.tests.bientotMixteAideCout', { cout: cout(vingtCout) })}
            onPress={() => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } } as never)}
          />
          {completCout !== undefined ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.bientotCoutPrevu', { cout: cout(completCout) })}</Text> : null}
        </>
      )}
      <Bouton variante="secondaire" libelle={t('certification.tests.voirTentatives')} onPress={() => router.push({ pathname: '/certification/tentatives', params: { kind: demi ? 'half' : 'full' } } as never)} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[2] },
  titre: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: espace[2], alignSelf: 'flex-start', borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: 1 },
});
