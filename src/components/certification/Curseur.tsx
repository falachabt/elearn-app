/* eslint-disable react-hooks/refs -- le geste ne lit la ref que dans ses rappels, jamais pendant le rendu */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord } from '@/theme/theme';

type Props = { valeur: number; min: number; max: number; pas?: number; onChange: (v: number) => void; libelle: string };

const POUCE = 24;

/** Curseur sans module natif : appui ou glissement sur la piste, et réglage par pas pour les lecteurs d'écran. */
export function Curseur({ valeur, min, max, pas = 10, onChange, libelle }: Props) {
  const { theme } = useTheme();
  const [largeur, setLargeur] = useState(0);
  const ref = useRef({ largeur: 0, min, max, onChange });
  useEffect(() => {
    ref.current = { largeur, min, max, onChange };
  });

  const depuisX = (x: number) => {
    const { largeur: l, min: a, max: b } = ref.current;
    if (l <= POUCE) return;
    const p = Math.max(0, Math.min(1, (x - POUCE / 2) / (l - POUCE)));
    ref.current.onChange(Math.round(a + p * (b - a)));
  };
  const geste = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => depuisX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => depuisX(e.nativeEvent.locationX),
    }),
    [],
  );

  const part = max > min ? Math.max(0, Math.min(1, (valeur - min) / (max - min))) : 0;
  const gauche = part * Math.max(0, largeur - POUCE);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={libelle}
      accessibilityValue={{ min, max, now: valeur }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(max, valeur + (e.nativeEvent.actionName === 'increment' ? pas : -pas))))}
      onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
      style={styles.zone}
      {...geste.panHandlers}
    >
      <View pointerEvents="none" style={[styles.piste, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
        <View style={{ width: `${part * 100}%`, height: '100%', backgroundColor: theme.marque.principale }} />
      </View>
      <View pointerEvents="none" style={[styles.pouce, { left: gauche, backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { height: 36, justifyContent: 'center' },
  piste: { height: 10, borderWidth: bord.normal, borderRadius: 999, overflow: 'hidden' },
  pouce: { position: 'absolute', width: POUCE, height: POUCE, borderRadius: POUCE / 2, borderWidth: bord.normal, top: 6 },
});
