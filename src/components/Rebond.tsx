import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useReduireAnimations } from './useReduireAnimations';

type Props = {
  children: React.ReactNode;
  /** Change (ex. compteur de réussites) pour déclencher le pop. 0 ou `false` : rien. */
  declencheur?: number | boolean;
  /** Échelle atteinte au sommet du pop (overshoot). */
  echelle?: number;
  style?: StyleProp<ViewStyle>;
};

/** Succès : pop avec overshoot puis retour en ressort. Sans animation si « Réduire les animations ». */
export function Rebond({ children, declencheur = 0, echelle = 1.2, style }: Props) {
  const reduit = useReduireAnimations();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!declencheur || reduit) return;
    s.value = withSequence(withTiming(echelle, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 400, mass: 0.6 }));
  }, [declencheur, reduit, echelle, s]);
  const anime = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, reduit ? undefined : anime]}>{children}</Animated.View>;
}
