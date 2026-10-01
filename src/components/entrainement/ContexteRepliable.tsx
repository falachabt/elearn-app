import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import type { Bloc } from '@/services/blocs';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, mouvement, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Blocs } from '../reviser/Blocs';
import { useFeedback } from '../useFeedback';

/** Début du texte du contexte, sur une ligne : le premier bloc qui a du texte. */
export function apercuContexte(blocs: readonly Bloc[]): string {
  for (const b of blocs) {
    const segments = 'segments' in b ? b.segments : null;
    const texte = segments?.map((s) => s.texte).join('').replace(/\s+/g, ' ').trim();
    if (texte) return texte;
  }
  return '';
}

/**
 * Contexte d'un exercice (spec 5 ter, demande de Benny du 01/10) : replié par défaut sur une ligne, pour que l'énoncé
 * soit visible tout de suite ; un appui sur la ligne le déplie (texte et formules), un autre le referme. Replié à chaque
 * nouvel exercice : l'état n'est pas mémorisé.
 */
export function ContexteRepliable({ blocs }: { blocs: Bloc[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { reduit } = useFeedback();
  const [ouvert, setOuvert] = useState(false);
  const Chevron = ouvert ? ChevronUp : ChevronDown;
  return (
    <Animated.View
      layout={reduit ? undefined : LinearTransition.duration(mouvement.standard)}
      style={[styles.carte, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
    >
      <Appui
        accessibilityRole="button"
        accessibilityLabel={t('entrainement.contexte')}
        accessibilityState={{ expanded: ouvert }}
        onPress={() => setOuvert((o) => !o)}
        decalage={0}
        rayon={rayon.m}
      >
        <View style={styles.entete}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('entrainement.contexte').toUpperCase()}</Text>
          {ouvert ? <View style={styles.flex} /> : <Text numberOfLines={1} style={[typo.petit, styles.flex, { color: theme.texte.principal }]}>{apercuContexte(blocs)}</Text>}
          <View style={[styles.chevron, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <Chevron size={20} strokeWidth={2.5} color={theme.texte.principal} />
          </View>
        </View>
      </Appui>
      {ouvert ? (
        <View style={styles.corps}>
          <Blocs blocs={blocs} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  entete: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], paddingVertical: espace[2] },
  flex: { flex: 1 },
  chevron: { width: 32, height: 32, borderRadius: rayon.s, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  corps: { paddingHorizontal: espace[4], paddingBottom: 10, paddingTop: 2 },
});
