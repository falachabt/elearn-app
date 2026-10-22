import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { obtenirReglages } from '@/services/certification/etat';
import { signalerErreurDemarrage } from '@/services/certification/erreurDemarrage';
import { lancerDefTest } from '@/services/certification/miniTest';
import { CLE_NUMERO_LIGNE, CLE_TITRE_LISTE, meilleurDeSection, nombreFaits, statutLigne, testConseille } from '@/services/certification/listesTests';
import type { DefTest, TypeDefTest } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { BookOpen, Headphones, Trophy, type LucideIcon } from 'lucide-react-native';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Appui } from '../Appui';
import { stylePartie } from './partiesStyle';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

const TYPES: TypeDefTest[] = ['listening', 'reading', 'full'];

/** Icône et couleur de chaque type (maquette v37) : crème et casque, corail et livre, vert foncé et trophée. */
function styleType(type: TypeDefTest, theme: ReturnType<typeof useTheme>['theme'], sombre: boolean): { icone: LucideIcon; couleur: string } {
  if (type === 'listening') return { icone: Headphones, couleur: stylePartie(theme, sombre)[3]!.couleur };
  if (type === 'reading') return { icone: BookOpen, couleur: stylePartie(theme, sombre)[4]!.couleur };
  return { icone: Trophy, couleur: theme.marque.forte };
}

/** Liste des tests composés d'un type (maquette v38, écoute et lecture ; v39, complet). Un test non fini se lance d'ici. */
export function ListeTests() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const type: TypeDefTest = TYPES.includes(kind as TypeDefTest) ? (kind as TypeDefTest) : 'listening';
  const { garde, banniere } = useGardeReseau();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [codeEchec, setCodeEchec] = useState<string | null>(null);
  const [manque, setManque] = useState(false);

  const { etat, recharger } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    const [tests, reglages] = await Promise.all([obtenirApi().listerDefsTests(exam, type), obtenirReglages().catch(() => null)]);
    return { exam, tests, reglages };
  });

  const lancer = async (test: DefTest, exam: string) => {
    if (enCours) return;
    setEnCours(test.id);
    setCodeEchec(null);
    setManque(false);
    try {
      const res = (await garde(() => lancerDefTest(exam, test.id, test.kind))) ?? null;
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
  const tests = etat.phase === 'ok' ? etat.valeur.tests : [];
  const exam = etat.phase === 'ok' ? etat.valeur.exam : 'toeic';
  const meilleur = meilleurDeSection(tests);
  // Une moitié se lit sur la moitié du total (495 sur 990) ; le test complet se lit sur le total.
  const sectionMax = etat.phase === 'ok' && etat.valeur.reglages
    ? (type === 'full' ? etat.valeur.reglages.objectifMax : etat.valeur.reglages.objectifMax / 2)
    : null;
  const conseille = testConseille(tests);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t(CLE_TITRE_LISTE[type])} onRetour={() => router.back()} />}>
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
                  {meilleur === null || sectionMax === null
                    ? t('certification.tests.listes.pasDeScore')
                    : t('certification.tests.listes.meilleurSection', { score: meilleur, max: sectionMax })}
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
                onPress={() => (test.fini ? router.push({ pathname: '/certification/test-detail', params: { kind: type, id: test.id } } as never) : void lancer(test, exam))}
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
                        {t(CLE_NUMERO_LIGNE[type], { numero: test.numero })}
                      </Text>
                      <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelleStatut}</Text>
                    </View>
                    {estConseille ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.conseille')}</Text> : null}
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                      {test.meilleurScoreMax === null
                        ? t('certification.tests.listes.pasDeScoreLigne')
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
