import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE, numeroDansPartie } from '@/services/certification/listesTests';
import { lancerDefTest } from '@/services/certification/miniTest';
import { lancerAutreTest } from '@/services/certification/passerAutreTest';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirReglages } from '@/services/certification/etat';
import type { Reglages } from '@/services/certification/reglages';
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

const TYPES: TypeDefTest[] = ['listening', 'reading', 'full', 'mini', 'mixed'];

/**
 * Détail d'un test fait (maquette v39, TOEIC-V34-DETAIL) : score en gros, tentatives, date, et trois actions. Le meilleur
 * score est conservé : refaire un test ne le retire jamais.
 *
 * Tous les types de la liste aboutissent ici (un test fini s'ouvre, un test à faire se lance) : le type lu dans la
 * route est donc celui de la liste, mini-tests par partie et mixtes compris. Le ramener à « listening » par défaut
 * chargeait la mauvaise liste pour un mini ou un mixte : la définition n'y était pas, et l'écran affichait
 * l'erreur générique de chargement (constat terrain du 27 octobre 2026).
 */
export function DetailTest() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind, id, partie: partieParam } = useLocalSearchParams<{ kind?: string; id?: string; partie?: string }>();
  const type: TypeDefTest = TYPES.includes(kind as TypeDefTest) ? (kind as TypeDefTest) : 'listening';
  const { garde, banniere } = useGardeReseau();
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);

  const { etat } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages] = await Promise.all([obtenirApi().listerDefsTests(exam, type), obtenirReglages().catch(() => null)]);
    // Échelle du score, comme au bilan de fin : le test complet et le mixte se lisent sur le total (990),
    // un demi-test sur sa section (la moitié), un mini par partie n'a pas de score (un compte de bonnes réponses).
    const max = reglages
      ? type === 'full' || type === 'mixed'
        ? reglages.objectifMax
        : type === 'mini'
          ? null
          : reglages.objectifMax / 2
      : null;
    return { exam, max, tests, reglages, test: tests.find((x) => x.id === id) ?? null };
  });

  const autre = async () => {
    const res = await lancerAutreTest(exam, type);
    if (res?.statut === 'demarre') router.replace('/certification/mini-test' as never);
    else if (res?.statut === 'compte_requis') router.push('/compte/creer');
    else router.replace({ pathname: '/certification/liste-tests', params: { kind: type } } as never);
  };
  const refaire = async (test: DefTest, exam: string, reglages: Reglages | null) => {
    if (enCours) return;
    setEnCours(true);
    setCodeEchec(null);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind, test.meilleurScoreMax, test.part, reglages))) ?? null;
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
  const reglagesOk = etat.phase === 'ok' ? etat.valeur.reglages : null;
  const tousTests = etat.phase === 'ok' ? etat.valeur.tests : [];
  // Numéro affiché : celui de la définition, sauf pour un mini, numéroté dans sa partie comme dans la liste.
  const numero = test ? (type === 'mini' ? numeroDansPartie(tousTests, test) : test.numero) : 1;
  const partieTitre = test?.part ?? (Number(partieParam) >= 1 && Number(partieParam) <= 7 ? Number(partieParam) : 0);
  const titre = test ? t(CLE_NUMERO_LIGNE[type], { numero }) : t(CLE_TITRE_LISTE[type], { partie: partieTitre });

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}>
      {banniere}
      {etat.phase === 'chargement' ? <Squelette lignes={3} /> : null}
      {etat.phase === 'erreur' || (etat.phase === 'ok' && !test) ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {test ? (
        <>
          <Carte style={{ gap: espace[2] }}>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t(CLE_TITRE_LISTE[type], { partie: test.part ?? 0 })}</Text>
            <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>
              {test.meilleurScoreMax === null
                ? t('certification.tests.listes.pasDeScore')
                : type === 'mini'
                  ? t('certification.tests.listes.meilleurSur', { score: test.meilleurScoreMax, max: test.questions })
                  : t('certification.tests.detail.meilleur', { score: test.meilleurScoreMax, max: max ?? '' })}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              {t('certification.tests.listes.tentatives', { n: test.tentatives })}
              {test.derniereDate ? ` · ${t('certification.tests.detail.derniere', { date: new Date(test.derniereDate).toLocaleDateString('fr-FR') })}` : ''}
            </Text>
          </Carte>
          <View style={styles.actions}>
            <Bouton libelle={t('certification.tests.detail.voirNote')} variante="secondaire" onPress={() => router.push('/certification/tentatives' as never)} />
            <Bouton libelle={t('certification.tests.detail.refaire')} desactive={enCours} onPress={() => void refaire(test, exam, reglagesOk)} />
            <Bouton
              libelle={t('certification.tests.detail.autre')}
              variante="secondaire"
              onPress={() => void autre()}
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
