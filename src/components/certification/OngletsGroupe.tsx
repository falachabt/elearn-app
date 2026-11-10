import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { QuestionServie } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

type Props = {
  membres: QuestionServie[];
  /** Réponses déjà données dans le groupe (une clé par question, `null` = passée). */
  reponses: Record<string, number | null>;
  selection: number;
  onChoisir: (i: number) => void;
};

/** Onglets « Question N » d'un groupe : libres dans le groupe, une coche par question répondue (jamais la couleur seule). */
export function OngletsGroupe({ membres, reponses, selection, onChoisir }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={styles.rangee}>
      {membres.map((m, i) => {
        const actif = i === selection;
        const fait = m.id in reponses;
        const libelle = t('certification.exercice.question', { n: m.number ?? i + 1 });
        return (
          <Appui key={m.id} accessibilityRole="tab" accessibilityState={{ selected: actif }} accessibilityLabel={libelle} onPress={() => onChoisir(i)} decalage={0} rayon={rayon.s}>
            <View style={[styles.onglet, { backgroundColor: actif ? theme.texte.principal : theme.fond.surface, borderColor: theme.bord.fort }]}>
              {fait ? <Check size={14} color={actif ? theme.texte.inverse : theme.texte.principal} strokeWidth={2.5} /> : null}
              <Text style={[typo.legende, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{libelle}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  onglet: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: espace[1], paddingHorizontal: espace[4], justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
});
