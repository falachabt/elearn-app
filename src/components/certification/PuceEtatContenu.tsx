import { Award, Check, Circle, Eye, RotateCcw, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { EtatContenu } from '@/services/certification/etatsContenu';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

const ICONES: Record<EtatContenu, LucideIcon> = { non_vu: Circle, vu: Eye, valide: Check, maitrise: Award, a_revoir: RotateCcw };

/**
 * Les cinq états d'une notion (V34-TUILE-ETATS) : icône ET mot (Non vu, Vu, Validé, Maîtrisé, À revoir), jamais la couleur seule.
 * Fonds : surface (non vu), vert doux (vu), jaune (validé, maîtrisé), rouge doux (à revoir).
 */
export function PuceEtatContenu({ etat }: { etat: EtatContenu }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const Icone = ICONES[etat];
  const fond = etat === 'vu' ? theme.marque.douce : etat === 'valide' || etat === 'maitrise' ? theme.accent.soleil : etat === 'a_revoir' ? theme.etat.erreurDoux : theme.fond.surface;
  const encre = etat === 'valide' || etat === 'maitrise' ? theme.texte.surCouleur : theme.texte.principal;
  return (
    <View style={[styles.puce, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Icone size={12} color={encre} strokeWidth={2} />
      <Text style={[typo.legende, styles.texte, { color: encre }]}>{t(`certification.cours.etats.${etat}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  puce: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: espace[1], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  texte: { textTransform: 'uppercase' },
});
