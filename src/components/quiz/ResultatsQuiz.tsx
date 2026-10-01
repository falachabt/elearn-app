import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { StatutQuestion } from '@/services/correction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { GrilleQuestions } from './GrilleQuestions';

/** Ouvre la correction du dernier quiz terminé sur la question `i`. */
export const revoirQuestion = (i: number) => router.push({ pathname: '/quiz/correction', params: { i: String(i) } });

type Props = {
  statuts: StatutQuestion[];
  /** « Revoir les leçons ratées (n) » : seulement quand le quiz connaît les cours des questions ratées. */
  leconsRatees?: { nombre: number; onPress: () => void };
};

/**
 * Bloc commun de fin de quiz (M5-10, M4-03) : grille des questions, puis « Refaire mes erreurs » en premier,
 * « Revoir la correction », et « Revoir les leçons ratées » quand il y en a.
 */
export function ResultatsQuiz({ statuts, leconsRatees }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const nb = (s: StatutQuestion) => statuts.filter((x) => x === s).length;
  const erreurs = nb('faux') + nb('passe');
  const premiere = Math.max(0, statuts.findIndex((s) => s !== 'juste'));
  return (
    <View style={styles.groupe}>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('correction.aide')}</Text>
      <GrilleQuestions statuts={statuts} onChoisir={revoirQuestion} />
      <View style={styles.legende}>
        <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('correction.justes', { n: nb('juste') })}</Text>
        <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('correction.fausses', { n: nb('faux') })}</Text>
        {nb('passe') ? <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('correction.passees', { n: nb('passe') })}</Text> : null}
      </View>
      {erreurs ? <Bouton libelle={t('mission.refaireErreurs', { n: erreurs })} onPress={() => router.push('/mission/erreurs')} /> : null}
      <Bouton variante="secondaire" libelle={t('correction.revoir')} onPress={() => revoirQuestion(erreurs ? premiere : 0)} />
      {leconsRatees?.nombre ? <Bouton variante="secondaire" libelle={t('correction.leconsRatees', { n: leconsRatees.nombre })} onPress={leconsRatees.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[5] },
});
