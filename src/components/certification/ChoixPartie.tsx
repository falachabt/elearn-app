import { router } from 'expo-router';
import { Check, Circle, Layers, RotateCcw, Target } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banniere } from '@/components/Banniere';
import { Appui } from '@/components/Appui';
import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { PARTIES, synthesesParties, testsDeLaPartie } from '@/services/certification/listesTests';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { stylePartie } from './partiesStyle';
import { EnteteToeic, Squelette } from './ui';
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

  const cellules: ReactNode[] = etat.phase === 'ok' ? [
    ...PARTIES.map((partie) => {
      const ligne = parties.find((p) => p.partie === partie)!;
      // Une partie sans test reste visible (P1 à P7) avec « Pas encore de test » : elle ne s'ouvre pas.
      const vide = ligne.total === 0;
      const { couleur, icone: Icone, cle } = styleDes[partie]!;
      const deLaPartie = testsDeLaPartie(tests, partie);
      const toutFait = !vide && ligne.faits === ligne.total;
      const commence = !vide && !toutFait && deLaPartie.some((x) => x.tentatives > 0);
      const statut = toutFait
        ? { Icone: Check, libelle: t('certification.tests.statut.fait'), fond: theme.accent.soleil, texte: theme.texte.surCouleur }
        : commence
          ? { Icone: RotateCcw, libelle: t('certification.tests.statut.enCours'), fond: theme.marque.principale, texte: theme.texte.surCouleur }
          : { Icone: Circle, libelle: t('certification.tests.statut.pasFait'), fond: theme.fond.surface, texte: theme.texte.principal };
      const libelleFaits = vide
        ? t('certification.tests.listes.choixPartie.pasEncore')
        : t('certification.tests.listes.choixPartie.faits', { faits: ligne.faits, total: ligne.total });
      return (
        <Appui
          key={partie}
          style={styles.cellule}
          accessibilityRole="button"
          accessibilityLabel={`${t('certification.tests.listes.choixPartie.partie', { partie })}. ${t(cle)}. ${libelleFaits}`}
          disabled={vide}
          onPress={() => ouvrir(partie)}
          decalage={3}
          ombre={ombre.carte}
          couleurOmbre={theme.ombre}
          rayon={rayon.m}
        >
          <View
            testID={`partie-${partie}`}
            style={[styles.carte, { backgroundColor: ligne.conseillee ? theme.accent.soleilTresDoux : theme.fond.surface, borderColor: theme.bord.fort }]}
          >
            <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
              <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
            </View>
            <View style={styles.texte}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.partie', { partie })}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t(cle)}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{libelleFaits}</Text>
            </View>
            {!vide ? (
              <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: statut.fond }]}>
                <statut.Icone size={12} color={statut.texte} strokeWidth={2} />
                <Text style={[typo.legende, { color: statut.texte }]}>{statut.libelle}</Text>
              </View>
            ) : null}
            {ligne.conseillee ? (
              <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
                <Target size={12} color={theme.texte.surCouleur} strokeWidth={2} />
                <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('certification.tests.listes.choixPartie.conseille')}</Text>
              </View>
            ) : null}
          </View>
        </Appui>
      );
    }),
    <Appui
      key="mixte"
      style={styles.cellule}
      accessibilityRole="button"
      accessibilityLabel={t('certification.tests.listes.choixPartie.mixte')}
      onPress={() => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } } as never)}
      decalage={3}
      ombre={ombre.carte}
      couleurOmbre={theme.ombre}
      rayon={rayon.m}
    >
      <View testID="mixte" style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.pastille, { backgroundColor: styleDes[5]!.couleur, borderColor: theme.bord.fort }]}>
          <Layers size={18} color={theme.texte.surCouleur} strokeWidth={2} />
        </View>
        <View style={styles.texte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.mixte')}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.choixPartie.mixteSous')}</Text>
        </View>
      </View>
    </Appui>,
  ] : [];
  const rangees: ReactNode[][] = [];
  for (let i = 0; i < cellules.length; i += 2) rangees.push(cellules.slice(i, i + 2));

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
      {rangees.map((rangee, i) => (
        <View key={i} style={styles.rangee}>
          {rangee}
          {rangee.length === 1 ? <View style={styles.cellule} /> : null}
        </View>
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: espace[3] },
  cellule: { flex: 1, minWidth: 0 },
  carte: { flex: 1, borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[4], gap: espace[3], minHeight: 176, alignItems: 'flex-start' },
  pastille: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { gap: 2, alignSelf: 'stretch' },
  statut: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: 1, alignSelf: 'flex-start' },
});
