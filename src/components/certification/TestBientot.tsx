import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Layers } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { etapeDemarrage, signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirApi } from '@/services/certification/api';
import { lancerTest } from '@/services/certification/miniTest';
import type { TestFixe, TypeTestFixe } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from './ui';

/** T5 · Demi-test (écoute ou lecture, 100 questions) et test complet (200 questions). Le serveur tire les questions et débite au lancement. */
export function TestBientot() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const { garde, banniere } = useGardeReseau();
  const [test, setTest] = useState<TestFixe | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [manque, setManque] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const exam = (await lireProfil())?.exam ?? 'toeic';
        const tests = await obtenirApi().listerTests(exam);
        if (vivant) setTest(tests[0] ?? null);
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
  const pret = !chargement && test !== null && !enCours;

  return (
    <Ecran
      entete={<EnteteToeic titre={demi ? t('certification.tests.demi') : t('certification.tests.bientotEntete')} onRetour={() => router.back()} />}
      pied={
        demi ? null : (
          <View style={styles.pied}>
            <Bouton libelle={t('certification.tests.bientotLancer')} desactive={!pret} onPress={() => void lancer('full')} />
          </View>
        )
      }
    >
      {banniere}
      <Carte style={{ gap: espace[2] }}>
        <View style={styles.titre}>
          <Clock size={20} color={theme.texte.principal} strokeWidth={2} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{demi ? t('certification.tests.demiTitre') : t('certification.tests.completTitre')}</Text>
        </View>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>
          {demi ? t('certification.tests.demiTexte') : t('certification.tests.completTexte')}
        </Text>
        {chargement ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.chargement')}</Text> : null}
        {!chargement && test === null ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.indisponible')}</Text> : null}
        {manque ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.creditsInsuffisants')}</Text> : null}
        {codeEchec ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.mini.erreurCode', { code: codeEchec })}</Text> : null}
      </Carte>
      {demi ? (
        <>
          <LigneChoix icone={Layers} titre={t('certification.tests.ecouteTitre')} aide={t('certification.tests.ecouteAide')} onPress={() => void lancer('half_listening')} />
          <LigneChoix icone={Layers} titre={t('certification.tests.lectureTitre')} aide={t('certification.tests.lectureAide')} onPress={() => void lancer('half_reading')} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ pied: { gap: espace[2] }, titre: { flexDirection: 'row', alignItems: 'center', gap: espace[2] } });
