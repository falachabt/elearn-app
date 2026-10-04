import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { declencherPhoto, useDeclencheurActif } from '@/services/obturateur';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, typo } from '@/theme/theme';

type Icone = keyof typeof Ionicons.glyphMap;

type Props = PressableProps & {
  libelle: string;
  icone: Icone;
  iconeActive?: Icone;
  isFocused?: boolean; // fourni par TabTrigger
  central?: boolean;
  /** Pastille de nouveautés (nombre) sur l'icône ; « 9+ » au-delà, rien à 0. */
  badge?: number;
};

/** Un onglet de la barre. Le bouton Photo central, émeraude et rond, est l'action n° 1. Texte toujours visible. */
export const Onglet = forwardRef<View, Props>(function Onglet(
  { libelle, icone, iconeActive, isFocused, central, badge, ...reste },
  ref,
) {
  const { theme } = useTheme();
  const couleur = isFocused ? theme.marque.forte : theme.texte.secondaire;
  // Appareil photo affiché et prêt : ce bouton prend la photo, son rond est remplacé par le déclencheur de l'écran.
  const declencheurActif = useDeclencheurActif();
  const prise = !!central && !!isFocused && declencheurActif;

  return (
    <Pressable
      {...reste}
      onPress={prise ? () => void declencherPhoto() : reste.onPress}
      ref={ref}
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${libelle}, ${badge}` : libelle}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.onglet}
    >
      {central ? (
        <View style={[styles.photo, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }, prise && styles.photoMasque]}>
          <Ionicons name={icone} size={26} color={theme.texte.surCouleur} />
        </View>
      ) : (
        <View>
          <Ionicons name={isFocused && iconeActive ? iconeActive : icone} size={24} color={couleur} />
          {badge ? (
            <View testID="onglet-badge" style={[styles.badge, { backgroundColor: theme.etat.erreur, borderColor: theme.bord.fort }]}>
              <Text style={[typo.boutonPetit, styles.badgeTexte, { color: theme.texte.surCouleur }]}>{badge > 9 ? '9+' : String(badge)}</Text>
            </View>
          ) : null}
        </View>
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
  badge: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  badgeTexte: { fontSize: 10, lineHeight: 12 },
  onglet: { flex: 1, minHeight: cibleMin + 8, alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 6, gap: 2 },
  photoMasque: { opacity: 0 },
  photo: { width: 52, height: 52, borderRadius: 26, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
});
