import { router } from 'expo-router';
import { Layers, Target } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { PARTIES, synthesesParties } from '@/services/certification/listesTests';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { stylePartie } from './partiesStyle';
import { BarreProgression, EnteteCase, EnteteToeic, GrilleCollee, Squelette, type CaseGrille } from './ui';
import { useChargement } from './useChargement';

/**
 * Choix de la partie d'un mini-test (maquette v39, TOEIC-V34-CHOIX-PARTIE) : grille de deux colonnes P1 à P7 (et le mixte),
 * un statut en mots par partie, « Conseillé » sur la partie qui a le plus de questions nouvelles, et un bouton collant
 * « Ouvrir la liste · Partie n » vers la partie conseillée.
 */
export function ChoixPartie() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { etat, recharger } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    return { exam, tests: await obtenirApi().listerDefsTests(exam, 'mini') };
  });
  const tests = etat.phase === 'ok' ? etat.valeur.tests : [];
  const parties = etat.phase === 'ok' ? synthesesParties(tests) : [];
  const styleDes = stylePartie(theme, sombre);
  const conseillee = parties.find((p) => p.conseillee && p.total > 0) ?? null;
  const ouvrir = (partie: number) => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mini', partie: String(partie) } } as never);

  const cases: CaseGrille[] = etat.phase === 'ok' ? [
    ...PARTIES.map((partie): CaseGrille => {
      const ligne = parties.find((p) => p.partie === partie)!;
      // Une partie sans test reste visible (P1 à P7) avec « Pas encore de test » : elle ne s'ouvre pas.
      const vide = ligne.total === 0;
      const { couleur, icone: Icone, cle } = styleDes[partie]!;
      const libelleFaits = vide
        ? t('certification.tests.listes.choixPartie.pasEncore')
        : t('certification.tests.listes.choixPartie.faits', { faits: ligne.faits, total: ligne.total });
      return {
        cle: String(partie),
        testID: `partie-${partie}`,
        fond: ligne.conseillee ? theme.accent.soleilTresDoux : undefined,
        accessibilityLabel: `${t('certification.tests.listes.choixPartie.partie', { partie })}. ${t(cle)}. ${libelleFaits}`,
        disabled: vide,
        onPress: () => ouvrir(partie),
        contenu: (
          <>
            <EnteteCase
              pastille={
                <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                  <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                </View>
              }
            />
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.partie', { partie })}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t(cle)}</Text>
            {vide ? (
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{libelleFaits}</Text>
            ) : (
              <View style={styles.barre}>
                <BarreProgression pourcent={(ligne.faits / ligne.total) * 100} hauteur={8} libelle={libelleFaits} />
              </View>
            )}
            {/* Place du badge « Conseillé » réservée, même quand il est absent : toutes les cartes gardent la même hauteur. */}
            <View style={styles.placeConseille}>
              {ligne.conseillee ? (
                <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
                  <Target size={12} color={theme.texte.surCouleur} strokeWidth={2} />
                  <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('certification.tests.listes.choixPartie.conseille')}</Text>
                </View>
              ) : null}
            </View>
          </>
        ),
      };
    }),
    {
      cle: 'mixte',
      testID: 'mixte',
      accessibilityLabel: t('certification.tests.listes.choixPartie.mixte'),
      onPress: () => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } } as never),
      contenu: (
        <>
          <EnteteCase
            pastille={
              <View style={[styles.pastille, { backgroundColor: styleDes[5]!.couleur, borderColor: theme.bord.fort }]}>
                <Layers size={18} color={theme.texte.surCouleur} strokeWidth={2} />
              </View>
            }
          />
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.mixte')}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.choixPartie.mixteSous')}</Text>
        </>
      ),
    },
  ] : [];

  return (
    <Ecran
      insetBas={false}
      entete={<EnteteToeic titre={t('certification.tests.listes.choixPartie.titre')} onRetour={() => router.back()} />}
      pied={conseillee ? <Bouton libelle={t('certification.tests.listes.choixPartie.ouvrir', { partie: conseillee.partie })} onPress={() => ouvrir(conseillee.partie)} retour /> : undefined}
    >
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.choixPartie.intro')}</Text>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {etat.phase === 'erreur' ? <Bouton libelle={t('certification.reessayer')} onPress={recharger} /> : null}
      {cases.length > 0 ? <GrilleCollee cases={cases} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pastille: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  statut: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: 1, alignSelf: 'flex-start' },
  barre: { marginTop: espace[2] },
  placeConseille: { minHeight: 24, marginTop: espace[2], justifyContent: 'center' },
});
