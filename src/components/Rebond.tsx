import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { Moment } from '@/services/retours';

import { useFeedback } from './useFeedback';

type Props = {
  children: React.ReactNode;
  /** Change (ex. compteur de réussites) pour déclencher le pop. 0 ou `false` : rien. */
  declencheur?: number | boolean;
  /** Échelle atteinte au sommet du pop (overshoot). */
  echelle?: number;
  /** Retour joué avec le pop : `success` (bonne réponse), `reward` ou `celebrate`. */
  moment?: Extract<Moment, 'success' | 'reward' | 'celebrate'>;
  style?: StyleProp<ViewStyle>;
};

/** Succès : pop avec overshoot puis retour en ressort. Sans animation si « Réduire les animations ». */
export function Rebond({ children, declencheur = 0, echelle = 1.2, moment = 'success', style }: Props) {
  const { reduit, declencher } = useFeedback();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!declencheur) return;
    declencher(moment);
    if (reduit) return;
    s.value = withSequence(withTiming(echelle, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 400, mass: 0.6 }));
  }, [declencheur, reduit, echelle, s, declencher, moment]);
  const anime = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, reduit ? undefined : anime]}>{children}</Animated.View>;
}
