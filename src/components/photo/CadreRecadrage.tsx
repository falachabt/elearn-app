import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import type { Cadre } from '@/services/photo';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, palette, rayon } from '@/theme/theme';

/** Côté minimal du cadre, en points : un exercice reste lisible. */
const MIN = 56;
const POIGNEE = 28;

/** Rectangle de l'image affichée entière (contain) dans la zone. */
export function rectangleAffiche(zone: { largeur: number; hauteur: number }, image: { largeur: number; hauteur: number }) {
  const echelle = Math.min(zone.largeur / image.largeur, zone.hauteur / image.hauteur);
  const largeur = image.largeur * echelle;
  const hauteur = image.hauteur * echelle;
  return { x: (zone.largeur - largeur) / 2, y: (zone.hauteur - hauteur) / 2, largeur, hauteur };
}

/** Cadre initial : l'image moins une marge de 8 %. */
export const CADRE_INITIAL: Cadre = { x: 0.08, y: 0.08, largeur: 0.84, hauteur: 0.84 };

type Coin = 'hg' | 'hd' | 'bg' | 'bd';

/**
 * B2 · Cadre de recadrage : l'élève resserre le cadre (coins), le déplace (glisser dedans) ou appuie sur la photo pour
 * centrer le cadre sur l'exercice voulu. `onChange` reçoit le cadre en fractions de l'image (0–1).
 */
export function CadreRecadrage({ uri, largeur, hauteur, onChange }: { uri: string; largeur: number; hauteur: number; onChange: (c: Cadre) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [zone, setZone] = useState<{ largeur: number; hauteur: number } | null>(null);
  const r = zone ? rectangleAffiche(zone, { largeur, hauteur }) : { x: 0, y: 0, largeur: 1, hauteur: 1 };

  // Cadre en points, relatif à l'image affichée.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const l = useSharedValue(0);
  const h = useSharedValue(0);
  const debut = useSharedValue({ x: 0, y: 0, l: 0, h: 0 });
  const W = useSharedValue(1);
  const H = useSharedValue(1);

  const mesurer = (e: LayoutChangeEvent) => {
    const z = { largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height };
    if (zone && Math.abs(zone.largeur - z.largeur) < 1 && Math.abs(zone.hauteur - z.hauteur) < 1) return;
    const a = rectangleAffiche(z, { largeur, hauteur });
    W.value = a.largeur;
    H.value = a.hauteur;
    x.value = a.largeur * CADRE_INITIAL.x;
    y.value = a.hauteur * CADRE_INITIAL.y;
    l.value = a.largeur * CADRE_INITIAL.largeur;
    h.value = a.hauteur * CADRE_INITIAL.hauteur;
    setZone(z);
    onChange(CADRE_INITIAL);
  };

  const publier = () => {
    'worklet';
    runOnJS(onChange)({ x: x.value / W.value, y: y.value / H.value, largeur: l.value / W.value, hauteur: h.value / H.value });
  };
  const retenir = () => {
    'worklet';
    debut.value = { x: x.value, y: y.value, l: l.value, h: h.value };
  };

  const deplacer = Gesture.Pan()
    .minDistance(2)
    .onStart(retenir)
    .onUpdate((e) => {
      x.value = Math.min(Math.max(0, debut.value.x + e.translationX), W.value - l.value);
      y.value = Math.min(Math.max(0, debut.value.y + e.translationY), H.value - h.value);
    })
    .onEnd(publier);

  const coin = (c: Coin) =>
    Gesture.Pan()
      .minDistance(0)
      .onStart(retenir)
      .onUpdate((e) => {
        const d = debut.value;
        if (c === 'hg' || c === 'bg') {
          const nx = Math.min(Math.max(0, d.x + e.translationX), d.x + d.l - MIN);
          l.value = d.l + (d.x - nx);
          x.value = nx;
        } else {
          l.value = Math.min(Math.max(MIN, d.l + e.translationX), W.value - d.x);
        }
        if (c === 'hg' || c === 'hd') {
          const ny = Math.min(Math.max(0, d.y + e.translationY), d.y + d.h - MIN);
          h.value = d.h + (d.y - ny);
          y.value = ny;
        } else {
          h.value = Math.min(Math.max(MIN, d.h + e.translationY), H.value - d.y);
        }
      })
      .onEnd(publier);

  // Appui sur la photo : le cadre se centre sur le point touché (même taille).
  const appui = Gesture.Tap().onEnd((e) => {
    x.value = Math.min(Math.max(0, e.x - l.value / 2), W.value - l.value);
    y.value = Math.min(Math.max(0, e.y - h.value / 2), H.value - h.value);
    publier();
  });

  const style = useAnimatedStyle(() => ({ left: x.value, top: y.value, width: l.value, height: h.value }));
  const voiles = {
    haut: useAnimatedStyle(() => ({ left: 0, right: 0, top: 0, height: y.value })),
    bas: useAnimatedStyle(() => ({ left: 0, right: 0, top: y.value + h.value, bottom: 0 })),
    gauche: useAnimatedStyle(() => ({ left: 0, width: x.value, top: y.value, height: h.value })),
    droite: useAnimatedStyle(() => ({ left: x.value + l.value, right: 0, top: y.value, height: h.value })),
  };
  const bleu = theme.etat.info;

  return (
    <View testID="photo-recadrage" onLayout={mesurer} style={[styles.zone, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
      {zone ? (
        <GestureDetector gesture={appui}>
          <View accessible accessibilityLabel={t('photo.zoneRecadrage')} accessibilityHint={t('photo.zoneRecadrageAide')} style={{ position: 'absolute', left: r.x, top: r.y, width: r.largeur, height: r.hauteur }}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
            {Object.entries(voiles).map(([k, s]) => (
              <Animated.View key={k} pointerEvents="none" style={[styles.voile, s]} />
            ))}
            <GestureDetector gesture={deplacer}>
              <Animated.View testID="photo-cadre" style={[styles.cadre, { borderColor: bleu }, style]}>
                {(['hg', 'hd', 'bg', 'bd'] as Coin[]).map((c) => (
                  <GestureDetector key={c} gesture={coin(c)}>
                    <View
                      hitSlop={14}
                      style={[
                        styles.poignee,
                        { backgroundColor: palette.papier[0], borderColor: bleu },
                        c[0] === 'h' ? { top: -POIGNEE / 2 } : { bottom: -POIGNEE / 2 },
                        c[1] === 'g' ? { left: -POIGNEE / 2 } : { right: -POIGNEE / 2 },
                      ]}
                    />
                  </GestureDetector>
                ))}
              </Animated.View>
            </GestureDetector>
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flex: 1, minHeight: 280, borderWidth: bord.normal, borderRadius: rayon.l, overflow: 'hidden' },
  voile: { position: 'absolute', backgroundColor: 'rgba(10,10,10,0.45)' },
  cadre: { position: 'absolute', borderWidth: bord.epais, borderRadius: rayon.s },
  poignee: { position: 'absolute', width: POIGNEE, height: POIGNEE, borderRadius: POIGNEE / 2, borderWidth: bord.epais },
});
