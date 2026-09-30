import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReduireAnimations } from './useReduireAnimations';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Enfoncement en px (2 à 4). 0 : aucun mouvement. */
  decalage?: number;
  /** Ombre dure derrière le contenu (px) ; le contenu s'enfonce dessus, donc elle se réduit. */
  ombre?: number;
  couleurOmbre?: string;
  rayon?: number;
};

const RESSORT = { damping: 14, stiffness: 600, mass: 0.6 } as const;

/** Wrapper pressable néo-brutal : le contenu s'enfonce de `decalage` px, retour sec en ressort. Sans animation si « Réduire les animations ». */
export function Appui({ children, style, decalage = 3, ombre = 0, couleurOmbre, rayon = 0, disabled, onPressIn, onPressOut, ...reste }: Props) {
  const reduit = useReduireAnimations();
  const d = Math.max(0, decalage);
  const enfonce = useSharedValue(0);
  const anime = useAnimatedStyle(() => ({ transform: [{ translateX: enfonce.value * d }, { translateY: enfonce.value * d }] }));
  const vers = (v: number) => {
    enfonce.value = reduit ? v : withSpring(v, RESSORT);
  };

  return (
    <Pressable
      {...reste}
      disabled={disabled}
      onPressIn={(e) => {
        vers(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        vers(0);
        onPressOut?.(e);
      }}
      style={[{ paddingRight: ombre, paddingBottom: ombre }, style]}
    >
      <View>
        {ombre > 0 && (
          <View
            testID="appui-ombre"
            style={[styles.ombre, { left: ombre, top: ombre, right: -ombre, bottom: -ombre, borderRadius: rayon, backgroundColor: couleurOmbre }]}
          />
        )}
        <Animated.View testID="appui-corps" style={reduit ? undefined : anime}>
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ ombre: { position: 'absolute' } });
