import { Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { definirTheme, type ReglageTheme } from '@/services/affichage';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

const CHOIX: { valeur: ReglageTheme; icone: LucideIcon }[] = [
  { valeur: 'clair', icone: Sun },
  { valeur: 'sombre', icone: Moon },
  { valeur: 'systeme', icone: Smartphone },
];

/** H2 › Apparence : Clair, Sombre ou Système (par défaut), appliqué tout de suite. Choix actif sur fond encre. */
export function ChoixTheme() {
  const { t } = useTraduction();
  const { theme, reglage } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('reglages.theme')} style={[styles.groupe, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      {CHOIX.map(({ valeur, icone: Icone }) => {
        const actif = reglage === valeur;
        const encre = actif ? theme.texte.inverse : theme.texte.principal;
        return (
          <Pressable
            key={valeur}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif }}
            accessibilityLabel={t(`reglages.themes.${valeur}`)}
            onPress={() => void definirTheme(valeur)}
            style={[styles.choix, actif && { backgroundColor: theme.fond.inverse }]}
          >
            <Icone size={16} strokeWidth={2} color={encre} />
            <Text numberOfLines={1} style={[typo.boutonPetit, { color: encre }]}>{t(`reglages.themes.${valeur}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Même gabarit que les onglets segmentés (Onglets) : pas de marge, le choix actif remplit le cadre, le cadre donne les coins.
  groupe: { flexDirection: 'row', overflow: 'hidden', borderWidth: bord.normal, borderRadius: rayon.m },
  choix: { flex: 1, minHeight: cibleMin - 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2], paddingHorizontal: espace[2] },
});
