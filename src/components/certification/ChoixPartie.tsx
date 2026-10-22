import { router } from 'expo-router';
import { Layers } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Banniere } from '@/components/Banniere';
import { Appui } from '@/components/Appui';
import { Bouton } from '@/components/Bouton';
import { Ecran } from '@/components/Ecran';
import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { PARTIES, synthesesParties } from '@/services/certification/listesTests';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { stylePartie } from './partiesStyle';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

/**
 * Choix de la partie d'un mini-test (maquette v39, TOEIC-V34-CHOIX-PARTIE) : P1 à P7, avec le fait et « Conseillé » sur la
 * partie qui a le plus de questions nouvelles. Le mixte, sans partie, s'ouvre directement depuis cette même liste.
 */
export function ChoixPartie() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const styles = stylesEcran(theme);
  const { etat, recharger } = useChargement(async () => {
    const exam = (await lireProfil())?.exam ?? 'toeic';
    return { exam, tests: await obtenirApi().listerDefsTests(exam, 'mini') };
  });
  const parties = etat.phase === 'ok' ? synthesesParties(etat.valeur.tests) : [];
  const styleDes = stylePartie(theme, sombre);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.tests.listes.choixPartie.titre')} onRetour={() => router.back()} />}>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.choixPartie.intro')}</Text>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <Banniere ton="erreur" titre={t('certification.tests.erreurTitre')} texte={t('certification.tests.erreurTexte')} />
      ) : null}
      {etat.phase === 'erreur' ? <Bouton libelle={t('certification.reessayer')} onPress={recharger} /> : null}
      {etat.phase === 'ok' ? (
        <>
          {PARTIES.map((partie) => {
            const ligne = parties.find((p) => p.partie === partie)!;
            // Une partie sans test n'a rien à proposer : elle ne s'affiche pas.
            if (ligne.total === 0) return null;
            const { couleur, icone: Icone } = styleDes[partie]!;
            return (
              <Appui
                key={partie}
                accessibilityRole="button"
                accessibilityLabel={`${t('certification.tests.listes.choixPartie.partie', { partie })}. ${t('certification.tests.listes.choixPartie.faits', { faits: ligne.faits, total: ligne.total })}`}
                onPress={() => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mini', partie: String(partie) } } as never)}
                decalage={3}
                rayon={rayon.l}
              >
                <View style={styles.ligne} testID={`partie-${partie}`}>
                  <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                    <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                  </View>
                  <View style={styles.texte}>
                    <View style={styles.haut}>
                      <Text style={[typo.texteFort, { color: theme.texte.principal, flex: 1 }]}>
                        {t('certification.tests.listes.choixPartie.partie', { partie })}
                      </Text>
                      {ligne.conseillee ? (
                        <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.conseille')}</Text>
                      ) : null}
                    </View>
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                      {t('certification.tests.listes.choixPartie.faits', { faits: ligne.faits, total: ligne.total })}
                    </Text>
                  </View>
                </View>
              </Appui>
            );
          })}
          <Appui
            accessibilityRole="button"
            accessibilityLabel={t('certification.tests.listes.choixPartie.mixte')}
            onPress={() => router.push({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } } as never)}
            decalage={3}
            rayon={rayon.l}
          >
            <View style={styles.ligne} testID="mixte">
              <View style={[styles.pastille, { backgroundColor: styleDes[5]!.couleur, borderColor: theme.bord.fort }]}>
                <Layers size={18} color={theme.texte.surCouleur} strokeWidth={2} />
              </View>
              <View style={styles.texte}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.listes.choixPartie.mixte')}</Text>
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tests.listes.choixPartie.mixteSous')}</Text>
              </View>
            </View>
          </Appui>
        </>
      ) : null}
    </Ecran>
  );
}

const stylesEcran = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[3], gap: espace[3], minHeight: 78, backgroundColor: theme.fond.surface, borderColor: theme.bord.fort },
  pastille: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: 2 },
  haut: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
});
