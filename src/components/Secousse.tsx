import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useFeedback } from './useFeedback';

type Props = {
  children: React.ReactNode;
  /** Change (ex. compteur d'erreurs) pour déclencher une secousse. 0 ou `false` : rien. */
  declencheur?: number | boolean;
  amplitude?: number;
  style?: StyleProp<ViewStyle>;
};

/** Erreur : secousse horizontale franche (linéaire, pas de ressort mou). Sans animation si « Réduire les animations ». */
export function Secousse({ children, declencheur = 0, amplitude = 8, style }: Props) {
  const { reduit, declencher } = useFeedback();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!declencheur) return;
    declencher('error'); // haptique et son selon les préférences, même si la secousse visuelle est réduite
    if (reduit) return;
    x.value = withSequence(
      withTiming(-amplitude, { duration: 40 }),
      withRepeat(withTiming(amplitude, { duration: 80 }), 5, true),
      withTiming(0, { duration: 40 }),
    );
  }, [declencheur, reduit, amplitude, x, declencher]);
  const anime = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[style, reduit ? undefined : anime]}>{children}</Animated.View>;
}
