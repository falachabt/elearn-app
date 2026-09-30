import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, typo } from '@/theme/theme';

type Icone = keyof typeof Ionicons.glyphMap;

type Props = PressableProps & {
  libelle: string;
  icone: Icone;
  iconeActive?: Icone;
  isFocused?: boolean; // fourni par TabTrigger
  central?: boolean;
};

/** Un onglet de la barre. Le bouton Photo central, émeraude et rond, est l'action n° 1. Texte toujours visible. */
export const Onglet = forwardRef<View, Props>(function Onglet(
  { libelle, icone, iconeActive, isFocused, central, ...reste },
  ref,
) {
  const { theme } = useTheme();
  const couleur = isFocused ? theme.marque.forte : theme.texte.secondaire;

  return (
    <Pressable
      {...reste}
      ref={ref}
      accessibilityRole="tab"
      accessibilityLabel={libelle}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.onglet}
    >
      {central ? (
        <View style={[styles.photo, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
          <Ionicons name={icone} size={26} color={theme.texte.surCouleur} />
        </View>
      ) : (
        <Ionicons name={isFocused && iconeActive ? iconeActive : icone} size={24} color={couleur} />
      )}
      <Text
        style={[typo.legende, { color: central ? theme.texte.principal : couleur }, isFocused && { fontFamily: 'SpaceGrotesk-Bold' }]}
      >
        {libelle}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  onglet: { flex: 1, minHeight: cibleMin + 8, alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 6, gap: 2 },
  photo: { width: 52, height: 52, borderRadius: 26, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
});
