import { Maximize, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { formaterDuree } from '@/services/videos';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, palette, rayon } from '@/theme/theme';

type Props = {
  position: number;
  duree: number;
  enLecture: boolean;
  /** Fin de la vidéo : le bouton de lecture devient « Revoir ». */
  terminee?: boolean;
  onBasculer: () => void;
  onChercher: (secondes: number) => void;
  onPleinEcran: () => void;
  libelles: { lecture: string; pause: string; revoir: string; pleinEcran: string; progression: string; precedente?: string; suivante?: string };
  /** Précédent / suivant (parties d'un cours) : absents pour une vidéo seule. */
  onPrecedente?: (() => void) | null;
  onSuivante?: (() => void) | null;
  avecNavigation?: boolean;
};

/**
 * Barre de contrôle partagée (maquettes TOEIC-C5v et VIDEO-COURS) : une seule barre noire de 46 px collée sous l'image, avec
 * lecture / pause, progression qu'on peut toucher ou glisser, temps et plein écran. Les parties d'un cours ajoutent
 * précédent et suivant. La barre reste noire dans les deux thèmes.
 */
/* eslint-disable react-hooks/refs -- le geste ne lit la ref que dans ses rappels, jamais pendant le rendu */
export function BarreVideo({ position, duree, enLecture, terminee, onBasculer, onChercher, onPleinEcran, libelles, onPrecedente, onSuivante, avecNavigation }: Props) {
  const { theme } = useTheme();
  const ref = useRef({ largeur: 0, duree, onChercher });
  useEffect(() => {
    ref.current = { largeur: ref.current.largeur, duree, onChercher };
  });
  const depuisX = (x: number) => {
    const { largeur: l, duree: d, onChercher: oc } = ref.current;
    if (l <= 0 || d <= 0) return;
    oc(Math.max(0, Math.min(1, x / l)) * d);
  };
  const geste = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => depuisX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => depuisX(e.nativeEvent.locationX),
      }),
    [],
  );
  const ratio = duree > 0 ? Math.min(1, Math.max(0, position / duree)) : 0;
  const total = duree > 0 ? formaterDuree(duree) : '';
  const libelleTemps = `${formaterDuree(position)}${total ? ` / ${total}` : ''}`;
  return (
    <View style={styles.barre}>
      {avecNavigation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={libelles.precedente}
          accessibilityState={{ disabled: !onPrecedente }}
          disabled={!onPrecedente}
          onPress={() => onPrecedente?.()}
          hitSlop={4}
          style={[styles.zoneIcone, !onPrecedente && styles.desactive]}
        >
          <SkipBack size={18} color={palette.papier[50]} strokeWidth={2.2} />
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={terminee ? libelles.revoir : enLecture ? libelles.pause : libelles.lecture} onPress={onBasculer} hitSlop={4} style={styles.zoneBouton}>
        <View style={[styles.bouton, { backgroundColor: theme.marque.principale }]}>
          {terminee ? (
            <RotateCcw size={16} color={palette.encre[1000]} strokeWidth={2.6} />
          ) : enLecture ? (
            <Pause size={16} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
          ) : (
            <Play size={16} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
          )}
        </View>
      </Pressable>
      {avecNavigation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={libelles.suivante}
          accessibilityState={{ disabled: !onSuivante }}
          disabled={!onSuivante}
          onPress={() => onSuivante?.()}
          hitSlop={4}
          style={[styles.zoneIcone, !onSuivante && styles.desactive]}
        >
          <SkipForward size={18} color={palette.papier[50]} strokeWidth={2.2} />
        </Pressable>
      ) : null}
      <View
        {...geste.panHandlers}
        testID="barre-video-piste"
        onLayout={(e) => {
          ref.current.largeur = e.nativeEvent.layout.width;
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={libelles.progression}
        accessibilityValue={{ min: 0, max: Math.max(0, Math.round(duree)), now: Math.round(position) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChercher(position + (e.nativeEvent.actionName === 'increment' ? 5 : -5))}
        style={styles.zonePiste}
      >
        <View pointerEvents="none" style={styles.piste}>
          <View style={[styles.remplie, { width: `${ratio * 100}%`, backgroundColor: theme.marque.principale }]} />
        </View>
        <View pointerEvents="none" style={[styles.curseur, { left: `${ratio * 100}%`, borderColor: theme.marque.principale }]} />
      </View>
      <Text style={styles.temps}>{libelleTemps || '0:00'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={libelles.pleinEcran} onPress={onPleinEcran} hitSlop={8} style={styles.zoneIcone}>
        <Maximize size={18} color={palette.papier[50]} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
/* eslint-enable react-hooks/refs */

const styles = StyleSheet.create({
  barre: { height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: espace[2], gap: espace[1], backgroundColor: palette.encre[1000] },
  zoneBouton: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  bouton: { width: 32, height: 32, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  zoneIcone: { width: 32, height: 46, alignItems: 'center', justifyContent: 'center' },
  desactive: { opacity: 0.35 },
  zonePiste: { flex: 1, height: 46, justifyContent: 'center', paddingHorizontal: 6 },
  piste: { height: 4, borderRadius: 2, backgroundColor: palette.encre[700], overflow: 'hidden' },
  remplie: { height: 4 },
  curseur: { position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: 6, borderWidth: 2, backgroundColor: palette.papier[50] },
  temps: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: palette.papier[50] },
});
