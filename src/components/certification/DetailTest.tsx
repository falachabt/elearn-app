import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE } from '@/services/certification/listesTests';
import { lancerDefTest } from '@/services/certification/miniTest';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirReglages } from '@/services/certification/etat';
import { lireProfil } from '@/services/profil';
import type { DefTest, TypeDefTest } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

/**
 * Détail d'un test fait (maquette v39, TOEIC-V34-DETAIL) : score en gros, tentatives, date, et trois actions. Le meilleur
 * score est conservé : refaire un test ne le retire jamais.
 */
export function DetailTest() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const type: TypeDefTest = kind === 'reading' || kind === 'full' ? kind : 'listening';
  const { garde, banniere } = useGardeReseau();
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);

  const { etat } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages] = await Promise.all([obtenirApi().listerDefsTests(exam, type), obtenirReglages().catch(() => null)]);
    // Même échelle que la liste : moitié du total, sauf le test complet (990).
    const max = reglages ? (type === 'full' ? reglages.objectifMax : reglages.objectifMax / 2) : null;
    return { exam, max, test: tests.find((x) => x.id === id) ?? null };
  });

  const refaire = async (test: DefTest, exam: string) => {
    if (enCours) return;
    setEnCours(true);
    setCodeEchec(null);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind, test.meilleurScoreMax))) ?? null;
      if (!res) return;
      if (res.statut === 'compte_requis') router.push('/compte/creer');
      else if (res.statut === 'insuffisant') setCodeEchec('insuffisant');
      else router.replace('/certification/mini-test' as never);
    } catch (erreur) {
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(false);
    }
  };

  const test = etat.phase === 'ok' ? etat.valeur.test : null;
  const exam = etat.phase === 'ok' ? etat.valeur.exam : 'toeic';
  const max = etat.phase === 'ok' ? etat.valeur.max : null;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t(CLE_NUMERO_LIGNE[type], { numero: test?.numero ?? 1 })} onRetour={() => router.back()} />}>
      {banniere}
      {etat.phase === 'chargement' ? <Squelette lignes={3} /> : null}
      {etat.phase === 'erreur' || (etat.phase === 'ok' && !test) ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {test ? (
        <>
          <Carte style={{ gap: espace[2] }}>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t(CLE_TITRE_LISTE[type])}</Text>
            <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>
              {test.meilleurScoreMax === null ? t('certification.tests.listes.pasDeScore') : t('certification.tests.detail.meilleur', { score: test.meilleurScoreMax, max: max ?? '' })}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('certification.tests.listes.tentatives', { n: test.tentatives })}
              {test.derniereDate ? ` · ${t('certification.tests.detail.derniere', { date: new Date(test.derniereDate).toLocaleDateString('fr-FR') })}` : ''}
            </Text>
          </Carte>
          <View style={styles.actions}>
            <Bouton libelle={t('certification.tests.detail.voirNote')} variante="secondaire" onPress={() => router.push('/certification/tentatives' as never)} />
            <Bouton libelle={t('certification.tests.detail.refaire')} desactive={enCours} onPress={() => void refaire(test, exam)} />
            <Bouton
              libelle={t('certification.tests.detail.autre')}
              variante="secondaire"
              onPress={() => router.replace({ pathname: '/certification/liste-tests', params: { kind: type } } as never)}
            />
          </View>
          {codeEchec === 'insuffisant' ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.creditsInsuffisants')}</Text> : null}
          {codeEchec && codeEchec !== 'insuffisant' ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.mini.erreurCode', { code: codeEchec })}</Text> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  actions: { gap: espace[2] },
});
