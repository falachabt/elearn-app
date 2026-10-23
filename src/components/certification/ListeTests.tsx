import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { obtenirReglages } from '@/services/certification/etat';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { lancerDefTest } from '@/services/certification/miniTest';
import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE, PARTIES, meilleurDeSection, nombreFaits, numeroDansPartie, statutLigne, testConseille, testsDeLaPartie } from '@/services/certification/listesTests';
import type { Reglages } from '@/services/certification/reglages';
import type { DefTest, TypeDefTest } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { BookOpen, Headphones, Layers, Target, Trophy, type LucideIcon } from 'lucide-react-native';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Appui } from '../Appui';
import { stylePartie } from './partiesStyle';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

const TYPES: TypeDefTest[] = ['listening', 'reading', 'full', 'mini', 'mixed'];

/** Icône et couleur de chaque type (maquette v37, v39) : crème et casque, corail et livre, vert foncé et trophée ; mini-tests par partie et mixte. */
function styleType(type: TypeDefTest, theme: ReturnType<typeof useTheme>['theme'], sombre: boolean): { icone: LucideIcon; couleur: string } {
  if (type === 'listening') return { icone: Headphones, couleur: stylePartie(theme, sombre)[3]!.couleur };
  if (type === 'reading') return { icone: BookOpen, couleur: stylePartie(theme, sombre)[4]!.couleur };
  // Couleurs du type (maquette v39, TOEIC-V34-TESTS-TYPES) : mini-test vert et cible, mixte jaune et couches.
  if (type === 'mini') return { icone: Target, couleur: theme.etat.succes };
  if (type === 'mixed') return { icone: Layers, couleur: theme.accent.soleil };
  return { icone: Trophy, couleur: theme.marque.forte };
}

/** Une partie valide (1 à 7) ou null, lue dans les paramètres de la route. */
function lirePartie(valeur: string | undefined): number | null {
  const n = Number(valeur);
  return PARTIES.some((p) => p === n) ? n : null;
}

/**
 * Liste des tests composés d'un type (maquette v38, écoute et lecture ; v39, complet, mini-tests par partie et mixte).
 * Un mini-test demande d'abord sa partie (écran de choix) ; un test non fini se lance d'ici.
 */
export function ListeTests() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { kind, partie: partieParam } = useLocalSearchParams<{ kind?: string; partie?: string }>();
  const type: TypeDefTest = TYPES.includes(kind as TypeDefTest) ? (kind as TypeDefTest) : 'listening';
  const partie = type === 'mini' ? lirePartie(partieParam) : null;
  const choixManquant = type === 'mini' && partie === null;
  const { garde, banniere } = useGardeReseau();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [manque, setManque] = useState(false);

  useEffect(() => {
    if (choixManquant) router.replace('/certification/choix-partie' as never);
  }, [choixManquant]);

  const { etat, recharger } = useChargement(async () => {
    if (choixManquant) return { exam: 'toeic', tests: [], reglages: null };
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages] = await Promise.all([obtenirApi().listerDefsTests(exam, type), obtenirReglages().catch(() => null)]);
    return { exam, tests, reglages };
  });

  const lancer = async (test: DefTest, exam: string, reglages: Pick<Reglages, 'miniMinutesPour10'> | null) => {
    if (enCours) return;
    setEnCours(test.id);
    setCodeEchec(null);
    setManque(false);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind, test.meilleurScoreMax, test.part, reglages))) ?? null;
      if (!res) return;
      if (res.statut === 'compte_requis') router.push('/compte/creer');
      else if (res.statut === 'insuffisant') setManque(true);
      else {
        suivre('cert_mock_started', { kind: test.kind });
        router.replace('/certification/mini-test' as never);
      }
    } catch (erreur) {
      setCodeEchec(signalerErreurDemarrage('test', 'TST', erreur));
    } finally {
      setEnCours(null);
    }
  };

  const { icone: Icone, couleur } = styleType(type, theme, sombre);
  const { solde, couts } = useCredits();
  const { cout } = useTextesCredits();
  const coutMini = type === 'mixed' ? couts.cert_mock_mini_twenty : couts.cert_mock_mini_ten;
  const libelleMini = type === 'mixed' ? t('certification.tests.detailMiniMixte') : t('certification.tests.detailMiniPartie');
  const tousTests = etat.phase === 'ok' ? etat.valeur.tests : [];
  const tests = type === 'mini' && partie !== null ? testsDeLaPartie(tousTests, partie) : tousTests;
  const exam = etat.phase === 'ok' ? etat.valeur.exam : 'toeic';
  const reglagesOk = etat.phase === 'ok' ? etat.valeur.reglages : null;
  const meilleur = meilleurDeSection(tests);
  // Une moitié se lit sur la moitié du total (495 sur 990) ; le test complet se lit sur le total. Mini-tests et mixte : pas de section.
  const sectionMax = reglagesOk && (type === 'listening' || type === 'reading' || type === 'full')
    ? (type === 'full' ? reglagesOk.objectifMax : reglagesOk.objectifMax / 2)
    : null;
  const conseille = testConseille(tests);
  const parMini = type === 'mini' || type === 'mixed';
  // Demi-test (écoute ou lecture) et test complet : coût du départ, comme pour les mini-tests.
  const coutListe = parMini ? coutMini : type === 'full' ? couts.cert_mock_full : (type === 'listening' || type === 'reading') ? couts.cert_mock_half : undefined;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t(CLE_TITRE_LISTE[type], { partie: partie ?? 0 })} onRetour={() => router.back()} />}>
      {banniere}
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {etat.phase === 'ok' ? (
        <>
          <Carte style={{ gap: espace[2] }}>
            <View style={styles.entete}>
              <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                <Icone size={20} color={theme.texte.surCouleur} strokeWidth={2} />
              </View>
              <View style={styles.texte}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                  {t('certification.tests.listes.fait', { faits: nombreFaits(tests), total: tests.length })}
                </Text>
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                  {(() => {
                    // Coût du type (crédits hors Pass), lu dans la configuration serveur : mini, demi-test ou complet.
                    const libelle = parMini
                      ? libelleMini
                      : meilleur === null || sectionMax === null
                        ? t('certification.tests.listes.pasDeScore')
                        : t('certification.tests.listes.meilleurSection', { score: meilleur, max: sectionMax });
                    return coutListe === undefined || solde?.illimite ? libelle : t('certification.tests.avecCout', { detail: libelle, cout: cout(coutListe) });
                  })()}
                </Text>
              </View>
            </View>
          </Carte>
          {tests.map((test) => {
            const statut = statutLigne(test);
            const estConseille = conseille?.id === test.id;
            const libelleStatut = t(`certification.tests.listes.statut.${statut}`);
            
            return (
              <Appui
                key={test.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(CLE_NUMERO_LIGNE[type], { numero: test.numero })}. ${libelleStatut}`}
                disabled={enCours !== null}
                onPress={() => (test.fini ? router.push({ pathname: '/certification/test-detail', params: { kind: type, id: test.id } } as never) : void lancer(test, exam, reglagesOk))}
                decalage={3}
                rayon={rayon.l}
              >
                <View
                  testID={`ligne-${test.kind}-${test.numero}`}
                  style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: estConseille ? theme.accent.soleil : theme.bord.fort }]}
                >
                  <View style={[styles.pastilleLigne, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                    <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                  </View>
                  <View style={styles.texte}>
                    <View style={styles.haut}>
                      <Text style={[typo.texteFort, { color: theme.texte.principal, flex: 1 }]}>
                        {t(CLE_NUMERO_LIGNE[type], { numero: type === 'mini' ? numeroDansPartie(tests, test) : test.numero })}
                      </Text>
                      <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelleStatut}</Text>
                    </View>
                    {estConseille ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.conseille')}</Text> : null}
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                      {test.meilleurScoreMax === null
                        ? t('certification.tests.listes.pasDeScoreLigne')
                        : parMini
                          ? t('certification.tests.listes.meilleurSur', { score: test.meilleurScoreMax, max: test.questions })
                          : t('certification.tests.listes.meilleur', { score: test.meilleurScoreMax })}
                      {' · '}
                      {t('certification.tests.listes.tentatives', { n: test.tentatives })}
                    </Text>
                    {test.nouvellesQuestions > 0 ? (
                      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                        {t('certification.tests.listes.nouvelles', { n: test.nouvellesQuestions })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Appui>
            );
          })}
          {manque ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.creditsInsuffisants')}</Text> : null}
          {codeEchec ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.mini.erreurCode', { code: codeEchec })}</Text> : null}
        </>
      ) : null}
      {etat.phase === 'erreur' ? <Bouton libelle={t('certification.reessayer')} onPress={recharger} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[3], gap: espace[3], minHeight: 78 },
  pastilleLigne: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  pastille: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: 2 },
  haut: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
});
