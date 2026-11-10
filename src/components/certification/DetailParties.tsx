import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { detailParPartie } from '@/services/certification/bilanMini';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, typo } from '@/theme/theme';

import { BarreProgression } from './ui';

/**
 * Bloc « Détail par partie » du bilan de fin de test (parcours « Fin de test », maquette validée par Benny le
 * 27/10/2026) : une ligne par partie du test, bonnes réponses sur répondues. La géométrie reprend les barres du
 * bloc maîtrise du résultat du diagnostic (A7) — bordure forte, piste à bordure, remplissage de marque — mais la
 * valeur est le compte « bonnes sur répondues », comme le détail d'historique T7 : aucune pastille d'état de
 * maîtrise ici, elle reste propre au diagnostic.
 */
export function DetailParties({ perPart }: { perPart: Record<string, { answered: number; correct: number }> }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const lignes = detailParPartie(perPart);
  if (lignes.length === 0) return null;
  return (
    <View style={[styles.bloc, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.bilanMini.detailParties')}</Text>
      {lignes.map((l) => (
        <View key={l.partie} style={styles.ligne}>
          <Text style={[typo.donnee, styles.libelle, { color: theme.texte.principal }]}>{t('certification.bilanMini.partieCourte', { n: l.partie })}</Text>
          <View style={styles.barre}>
            <BarreProgression pourcent={l.answered > 0 ? (l.correct / l.answered) * 100 : 0} hauteur={8} libelle={t('certification.bilanMini.partieCourte', { n: l.partie })} />
          </View>
          <Text style={[typo.donnee, styles.valeur, { color: theme.texte.principal }]}>{t('certification.bilanMini.sur', { c: l.correct, n: l.answered })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: 14 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  libelle: { width: 30 },
  barre: { flex: 1 },
  valeur: { width: 74, textAlign: 'right' },
});
