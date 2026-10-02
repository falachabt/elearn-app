import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, mouvement, rayon, typo } from '@/theme/theme';

import { useFeedback } from './useFeedback';

type Props = { libelle: string; aide?: string; valeur: boolean; onChange: (valeur: boolean) => void; desactive?: boolean };

const LARGEUR = 52;
const HAUTEUR = 30;
const BOUTON = 20;
const COURSE = LARGEUR - BOUTON - 2 * bord.normal - 2 * 3;

/**
 * Interrupteur avec libellé et phrase d'aide (H2 Paramètres) : piste bordée d'encre, émeraude quand il est actif,
 * bouton rond bordé. Toute la ligne est touchable ; rôle « switch » pour les lecteurs d'écran.
 */
export function Interrupteur({ libelle, aide, valeur, onChange, desactive }: Props) {
  const { theme } = useTheme();
  const { reduit } = useFeedback();
  const position = useSharedValue(valeur ? 1 : 0);
  useEffect(() => {
    position.value = reduit ? (valeur ? 1 : 0) : withTiming(valeur ? 1 : 0, { duration: mouvement.appui });
  }, [valeur, reduit, position]);
  const bouton = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * COURSE }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={libelle}
      accessibilityHint={aide}
      accessibilityState={{ checked: valeur, disabled: desactive }}
      disabled={desactive}
      onPress={() => onChange(!valeur)}
      style={[styles.ligne, desactive && styles.desactive]}
    >
      <View style={styles.texte}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{libelle}</Text>
        {aide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text> : null}
      </View>
      <View testID="interrupteur-piste" style={[styles.piste, { borderColor: theme.bord.fort, backgroundColor: valeur ? theme.marque.principale : theme.fond.creux }]}>
        <Animated.View style={[styles.bouton, { borderColor: theme.bord.fort, backgroundColor: valeur ? theme.fond.surface : theme.fond.surface }, bouton]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[5], minHeight: cibleMin },
  texte: { flex: 1, gap: espace[1] },
  desactive: { opacity: 0.5 },
  piste: { width: LARGEUR, height: HAUTEUR, borderRadius: rayon.pilule, borderWidth: bord.normal, padding: 3, justifyContent: 'center' },
  bouton: { width: BOUTON, height: BOUTON, borderRadius: rayon.pilule, borderWidth: bord.normal },
});
