import { Search, X } from 'lucide-react-native';
import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { useRendreVisible } from '../Ecran';
import { Appui } from '../Appui';

/**
 * Barre de recherche des annales (demande de Benny, 21 octobre) : à la place du titre « Ma classe ». Résultats en direct
 * côté appelant ; la croix vide le champ. `Ecran` garde le champ au-dessus du clavier. Maquette : `docs/maquettes/annales-recherche.md`.
 */
export function BarreRecherche({ valeur, onChange }: { valeur: string; onChange: (texte: string) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const rendreVisible = useRendreVisible();
  const zone = useRef<View>(null);
  const champ = useRef<TextInput>(null);
  return (
    <View ref={zone} style={[styles.barre, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Search size={18} strokeWidth={2} color={theme.texte.secondaire} />
      <TextInput
        ref={champ}
        value={valeur}
        onChangeText={onChange}
        onFocus={() => rendreVisible?.(zone.current)}
        accessibilityLabel={t('annales.rechercher')}
        placeholder={t('annales.rechercher')}
        placeholderTextColor={theme.texte.secondaire}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={[typo.texte, styles.champ, { color: theme.texte.principal }]}
      />
      {valeur ? (
        <Appui
          accessibilityRole="button"
          accessibilityLabel={t('annales.effacerRecherche')}
          onPress={() => {
            onChange('');
            champ.current?.focus();
          }}
          decalage={0}
        >
          <X size={18} strokeWidth={2} color={theme.texte.principal} />
        </Appui>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4] },
  champ: { flex: 1, paddingVertical: espace[3] },
});
