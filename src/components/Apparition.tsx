import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { useReduireAnimations } from './useReduireAnimations';

type Props = {
  children: React.ReactNode;
  /** Délai avant l'entrée (ms). Pour un échelonnage : `index * 60`. */
  delai?: number;
  /** Distance de glissement (px, depuis le bas). */
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

const RESSORT = { damping: 12, stiffness: 260, mass: 0.7 } as const;

/** Entrée franche : glisse depuis le bas avec un court rebond, sans fondu. Sans animation si « Réduire les animations ». */
export function Apparition({ children, delai = 0, distance = 24, style }: Props) {
  const reduit = useReduireAnimations();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = reduit ? 1 : withDelay(delai, withSpring(1, RESSORT));
  }, [reduit, delai, p]);
  const anime = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * distance }] }));
  return <Animated.View style={[style, reduit ? undefined : anime]}>{children}</Animated.View>;
}
