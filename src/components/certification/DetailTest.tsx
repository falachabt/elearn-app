import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE, numeroDansPartie, scoreBorne } from '@/services/certification/listesTests';
import { lancerDefTest } from '@/services/certification/miniTest';
import { lancerAutreTest } from '@/services/certification/passerAutreTest';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { obtenirReglages } from '@/services/certification/etat';
import type { Reglages } from '@/services/certification/reglages';
import { lireProfil } from '@/services/profil';
import type { DefTest, TypeDefTest } from '@/services/certification/types';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Check, Circle } from 'lucide-react-native';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { FeuilleCompteRequis, FeuilleCreditsInsuffisants, FeuilleErreurDemarrage } from './FeuillesDemarrageTest';
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
  const { garde, banniere, horsLigne } = useGardeReseau();
  const { couts } = useCredits();
  const [enCours, setEnCours] = useState(false);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [compteRequis, setCompteRequis] = useState(false);
  const [insuffisant, setInsuffisant] = useState<{ cout: number | null; solde: number | null } | null>(null);

  const { etat } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages] = await Promise.all([obtenirApi().listerDefsTests(exam, type), obtenirReglages().catch(() => null)]);
    return { exam, tests, reglages, test: tests.find((x) => x.id === id) ?? null };
  });

  const autre = async () => {
    if (enCours) return;
    setEnCours(true);
    setCodeEchec(null);
    setInsuffisant(null);
    try {
      const res = await garde(() => lancerAutreTest(exam, type));
      if (!res) {
        // Coupé par la garde réseau : la bannière explique, on ne bouge pas. En ligne, un résultat
        // vide dit qu'aucun autre test du type n'est à faire : la liste du type fait foi.
        if (!horsLigne) router.replace({ pathname: '/certification/liste-tests', params: { kind: type } } as never);
        return;
      }
      if (res.statut === 'ecran_lancement') router.replace({ pathname: '/certification/lancement-complet', params: { id: res.id, numero: String(res.numero) } } as never);
      else if (res.statut === 'demarre') router.replace('/certification/mini-test' as never);
      else if (res.statut === 'compte_requis') setCompteRequis(true);
      else if (res.statut === 'insuffisant') setInsuffisant({ cout: res.cout, solde: res.solde });
    } catch (erreur) {
      // Avant ce correctif, l'échec du lancement remontait sans être attrapé : le bouton semblait
      // mort (terrain du 27 octobre 2026 — le test conseillé, un mixte non fait, était refusé par
      // le serveur et rien ne s'affichait). Un blocage s'explique, par la feuille du bas.
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(false);
    }
  };
  const refaire = async (test: DefTest, exam: string, reglages: Reglages | null) => {
    if (enCours) return;
    if (test.kind === 'full') {
      router.push({ pathname: '/certification/lancement-complet', params: { id: test.id, numero: String(test.numero) } } as never);
      return;
    }
    setEnCours(true);
    setCodeEchec(null);
    setInsuffisant(null);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind, test.meilleurScoreMax, test.part, reglages))) ?? null;
      if (!res) return;
      if (res.statut === 'compte_requis') setCompteRequis(true);
      else if (res.statut === 'insuffisant') setInsuffisant({ cout: res.cout, solde: res.solde });
      else router.replace('/certification/mini-test' as never);
    } catch (erreur) {
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(false);
    }
  };

  const test = etat.phase === 'ok' ? etat.valeur.test : null;
  const exam = etat.phase === 'ok' ? etat.valeur.exam : 'toeic';
  const reglagesOk = etat.phase === 'ok' ? etat.valeur.reglages : null;
  const tousTests = etat.phase === 'ok' ? etat.valeur.tests : [];
  // Numéro affiché : celui de la définition, sauf pour un mini, numéroté dans sa partie comme dans la liste.
  const numero = test ? (type === 'mini' ? numeroDansPartie(tousTests, test) : test.numero) : 1;
  const partieTitre = test?.part ?? (Number(partieParam) >= 1 && Number(partieParam) <= 7 ? Number(partieParam) : 0);
  // « Partie 5 n° 1 » (maquette v39) pour un mini ; « Écoute n° 2 », « Mixte n° 1 » pour les autres.
  const titre = test
    ? type === 'mini'
      ? `${t('certification.tests.listes.choixPartie.partie', { partie: partieTitre })} ${t(CLE_NUMERO_LIGNE.mini, { numero })}`
      : t(CLE_NUMERO_LIGNE[type], { numero })
    : t(CLE_TITRE_LISTE[type], { partie: partieTitre });
  // Jamais au-dessus du maximum de son échelle (D-55, D-58) : « 8 sur 10 », « 410 sur 495 », « 13 sur 20 ».
  const borne = test ? scoreBorne(type, test.meilleurScoreMax, test.questions, reglagesOk?.objectifMax ?? null) : null;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}>
      {banniere}
      {etat.phase === 'chargement' ? <Squelette lignes={3} /> : null}
      {etat.phase === 'erreur' || (etat.phase === 'ok' && !test) ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {test ? (
        <>
          <Carte style={{ gap: espace[3] }}>
            <View style={styles.ligneStatut}>
              <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: test.fini ? theme.accent.soleil : theme.fond.surface }]}>
                {test.fini ? <Check size={12} color={theme.texte.surCouleur} strokeWidth={2} /> : <Circle size={12} color={theme.texte.principal} strokeWidth={2} />}
                <Text style={[typo.legende, { color: test.fini ? theme.texte.surCouleur : theme.texte.principal }]}>
                  {t(`certification.tests.listes.statut.${test.fini ? 'fait' : test.tentatives > 0 ? 'commence' : 'pas_fait'}`)}
                </Text>
              </View>
              {test.derniereDate ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{new Date(test.derniereDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text> : null}
            </View>
            {borne === null ? (
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.pasDeScore')}</Text>
            ) : (
              <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>
                {borne.valeur}
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{` ${t('certification.tests.detail.meilleurSur', { max: borne.max })}`}</Text>
              </Text>
            )}
            <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.tentatives', { n: test.tentatives })}</Text>
          </Carte>
          <View style={styles.actions}>
            <Bouton libelle={t('certification.tests.detail.voirNote')} variante="secondaire" onPress={() => router.push('/certification/tentatives' as never)} />
            <Bouton libelle={t('certification.tests.detail.refaire')} desactive={enCours} onPress={() => void refaire(test, exam, reglagesOk)} />
            <Bouton
              libelle={t('certification.tests.detail.autre')}
              variante="secondaire"
              desactive={enCours}
              onPress={() => void autre()}
            />
          </View>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.detail.aide')}</Text>
          {/* Un démarrage refusé s'explique par une feuille du bas, pas par un petit texte sous les
              boutons (terrain du 27 octobre 2026 : boutons du détail d'un mixte perçus comme morts). */}
          <FeuilleErreurDemarrage code={codeEchec} onFermer={() => setCodeEchec(null)} />
          <FeuilleCompteRequis ouverte={compteRequis} onFermer={() => setCompteRequis(false)} />
          <FeuilleCreditsInsuffisants
            blocage={insuffisant}
            coutRepli={(type === 'mixed' ? couts.cert_mock_mini_twenty : type === 'mini' ? couts.cert_mock_mini_ten : type === 'full' ? couts.cert_mock_full : couts.cert_mock_half) ?? 0}
            onFermer={() => setInsuffisant(null)}
          />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  actions: { gap: espace[3] },
  ligneStatut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statut: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: 1 },
});
