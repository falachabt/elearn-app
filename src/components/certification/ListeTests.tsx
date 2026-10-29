import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { lirePlan, obtenirReglages } from '@/services/certification/etat';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { lancerDefTest, longueurMiniServie } from '@/services/certification/miniTest';
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
import { GroupeColle } from '../liste/ListeCollee';
import { FeuilleCreditsInsuffisants, FeuilleErreurDemarrage } from './FeuillesDemarrageTest';
import { stylePartie } from './partiesStyle';
import { BarreScoreObjectif, EnteteToeic, Squelette } from './ui';
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
  const [insuffisant, setInsuffisant] = useState<{ cout: number | null; solde: number | null } | null>(null);

  useEffect(() => {
    if (choixManquant) router.replace('/certification/choix-partie' as never);
  }, [choixManquant]);

  const { etat, recharger } = useChargement(async () => {
    if (choixManquant) return { exam: 'toeic', tests: [], reglages: null, plan: null };
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages, plan] = await Promise.all([
      obtenirApi().listerDefsTests(exam, type),
      obtenirReglages().catch(() => null),
      // Le plan de l'élève porte son objectif (le repère des barres) ; lecture locale, jamais bloquante.
      lirePlan().catch(() => null),
    ]);
    return { exam, tests, reglages, plan };
  });

  const lancer = async (test: DefTest, exam: string, reglages: Pick<Reglages, 'miniMinutesPour10'> | null) => {
    if (enCours) return;
    setEnCours(test.id);
    setCodeEchec(null);
    setInsuffisant(null);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind, test.meilleurScoreMax, test.part, reglages))) ?? null;
      if (!res) return;
      if (res.statut === 'compte_requis') router.push('/compte/creer');
      else if (res.statut === 'insuffisant') setInsuffisant({ cout: res.cout, solde: res.solde });
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
  const tousTests = etat.phase === 'ok' ? etat.valeur.tests : [];
  const tests = type === 'mini' && partie !== null ? testsDeLaPartie(tousTests, partie) : tousTests;
  const exam = etat.phase === 'ok' ? etat.valeur.exam : 'toeic';
  const reglagesOk = etat.phase === 'ok' ? etat.valeur.reglages : null;
  const planOk = etat.phase === 'ok' ? etat.valeur.plan : null;
  // Objectif de l'élève, un score total posé à l'arrivée ; null s'il a passé l'étape : aucun repère n'est inventé.
  const objectifTotal = planOk?.objectif ?? null;
  // Nombre de questions annoncé pour un mini par partie : celui des définitions listées quand elles s'accordent
  // (la donnée réelle — 12 pour les parties 3, 4 et 6) ; à défaut, la longueur que le serveur sert pour la partie.
  const comptesMini = new Set(tests.map((x) => x.questions));
  const nombreQuestionsMini = tests.length > 0 && comptesMini.size === 1 ? tests[0]!.questions : longueurMiniServie(partie, reglagesOk);
  const libelleMini = type === 'mixed' ? t('certification.tests.detailMiniMixte') : t('certification.tests.detailMiniPartie', { n: nombreQuestionsMini });
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
          {/* Les lignes vivent en un seul bloc collé (patron ListeCollee, comme les listes du
              Secondaire) : un seul contour, un trait fin entre les lignes, la ligne conseillée en
              fond soleil très doux — la bordure jaune individuelle des cartes séparées disparaît. */}
          <GroupeColle>
            {tests.map((test, index) => {
              const statut = statutLigne(test);
              const estConseille = conseille?.id === test.id;
              const libelleStatut = t(`certification.tests.listes.statut.${statut}`);
              // Échelle de la barre du meilleur, par type : un mini se lit sur ses questions (un compte
              // de bonnes réponses) ; un mixte et un complet sur le total — le nombre de questions pris
              // pour échelle donnait « Meilleur : 550 sur 20 » (terrain du 27 octobre 2026) ; un
              // demi-test sur sa section, la moitié du total. Sans réglages, pas d'échelle connue :
              // la ligne garde alors son texte seul, sans barre.
              const echelle = type === 'mini'
                ? test.questions
                : reglagesOk
                  ? type === 'listening' || type === 'reading'
                    ? reglagesOk.objectifMax / 2
                    : reglagesOk.objectifMax
                  : null;
              // Repère de l'objectif ramené à l'échelle de la barre (l'objectif est un score total,
              // donc sa moitié sur un demi-test) ; jamais sur un mini : un compte de questions ne se
              // compare pas à un score TOEIC.
              const repere = echelle !== null && objectifTotal !== null && type !== 'mini'
                ? type === 'listening' || type === 'reading'
                  ? objectifTotal / 2
                  : objectifTotal
                : null;
              // Le libellé d'accessibilité de la barre dit tout en mots (valeur, échelle, position par
              // rapport à l'objectif total) : la carte visible, elle, ne porte aucun texte d'objectif.
              const libelleBarre = echelle === null
                ? ''
                : test.meilleurScoreMax === null
                  ? repere !== null && objectifTotal !== null
                    ? t('certification.tests.listes.barreVideObjectif', { objectif: objectifTotal })
                    : t('certification.tests.listes.pasDeScoreLigne')
                  : repere === null || objectifTotal === null
                    ? t('certification.tests.listes.meilleurSur', { score: test.meilleurScoreMax, max: echelle })
                    : test.meilleurScoreMax > repere
                      ? t('certification.tests.listes.barreAuDessus', { score: test.meilleurScoreMax, max: echelle, objectif: objectifTotal })
                      : test.meilleurScoreMax < repere
                        ? t('certification.tests.listes.barreEnDessous', { score: test.meilleurScoreMax, max: echelle, objectif: objectifTotal })
                        : t('certification.tests.listes.barreObjectifAtteint', { score: test.meilleurScoreMax, max: echelle, objectif: objectifTotal });
              return (
                <Pressable
                  key={test.id}
                  testID={`ligne-${test.kind}-${test.numero}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(CLE_NUMERO_LIGNE[type], { numero: test.numero })}. ${libelleStatut}`}
                  disabled={enCours !== null}
                  onPress={() => (test.fini ? router.push({ pathname: '/certification/test-detail', params: { kind: type, id: test.id, ...(type === 'mini' && test.part ? { partie: String(test.part) } : {}) } } as never) : void lancer(test, exam, reglagesOk))}
                  style={[
                    styles.ligneCollee,
                    index > 0 ? { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux } : null,
                    { backgroundColor: estConseille ? theme.accent.soleilTresDoux : theme.fond.surface },
                  ]}
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
                    {echelle !== null ? (
                      <>
                        {/* Le nombre reste écrit, en compact (« 980 sur 990 ») : jamais la barre seule. */}
                        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                          {test.meilleurScoreMax === null ? t('certification.tests.listes.pasDeScoreLigne') : null}
                          {test.meilleurScoreMax !== null ? <Text style={[styles.scoreNombre, { color: theme.texte.principal }]}>{test.meilleurScoreMax}</Text> : null}
                          {test.meilleurScoreMax !== null ? ` ${t('certification.tests.listes.surMax', { max: echelle })}` : null}
                        </Text>
                        <BarreScoreObjectif valeur={test.meilleurScoreMax} max={echelle} objectif={repere} libelle={libelleBarre} />
                        {/* Tentatives et total réel du test sous la barre : le total, toujours — la
                            nouveauté (« questions nouvelles ») n'est plus présentée comme le nombre de
                            questions (décision de Benny du 25 octobre 2026) ; elle ne sert plus qu'à la
                            recommandation « Conseillé » (listesTests.ts). */}
                        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                          {t('certification.tests.listes.tentatives', { n: test.tentatives })}
                          {' · '}
                          {t('certification.tests.listes.total', { n: test.questions })}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                          {test.meilleurScoreMax === null
                            ? t('certification.tests.listes.pasDeScoreLigne')
                            : t('certification.tests.listes.meilleur', { score: test.meilleurScoreMax })}
                          {' · '}
                          {t('certification.tests.listes.tentatives', { n: test.tentatives })}
                        </Text>
                        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                          {t('certification.tests.listes.total', { n: test.questions })}
                        </Text>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </GroupeColle>
          {/* Un démarrage refusé s'explique par une feuille du bas, jamais par un petit texte sous la
              liste que l'élève ne voit pas (mixtes non faits inertes au toucher, terrain du 27 octobre 2026). */}
          <FeuilleErreurDemarrage code={codeEchec} onFermer={() => setCodeEchec(null)} />
          <FeuilleCreditsInsuffisants blocage={insuffisant} coutRepli={coutListe ?? 0} onFermer={() => setInsuffisant(null)} />
        </>
      ) : null}
      {etat.phase === 'erreur' ? <Bouton libelle={t('certification.reessayer')} onPress={recharger} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  // Ligne du bloc collé : pas de contour propre (celui du GroupeColle), le séparateur fin est posé en ligne.
  ligneCollee: { flexDirection: 'row', alignItems: 'flex-start', padding: espace[4], gap: espace[4] },
  scoreNombre: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, lineHeight: 20 },
  pastilleLigne: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  pastille: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: 2 },
  haut: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
});
