import { X } from 'lucide-react-native';
import { Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace } from '@/theme/theme';

import { Appui } from '../Appui';

const ZOOM_MAX = 4;

/**
 * G3e · Visionneuse de photo : plein écran sur fond encre, image entière (contain), zoom au pincement et au double appui,
 * déplacement au glissement, ✕ en haut à gauche, glisser vers le bas pour fermer (quand l'image n'est pas zoomée).
 */
export function PhotoPleine({ uri, onFermer }: { uri: string | null; onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();
  const echelle = useSharedValue(1);
  const echelleDebut = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xDebut = useSharedValue(0);
  const yDebut = useSharedValue(0);

  const remettre = () => {
    'worklet';
    echelle.value = 1;
    x.value = 0;
    y.value = 0;
  };
  const fermer = () => {
    remettre();
    onFermer();
  };

  const pincer = Gesture.Pinch()
    .onStart(() => {
      echelleDebut.value = echelle.value;
    })
    .onUpdate((e) => {
      echelle.value = Math.min(ZOOM_MAX, Math.max(1, echelleDebut.value * e.scale));
    })
    .onEnd(() => {
      if (echelle.value < 1.05) remettre();
    });
  const glisser = Gesture.Pan()
    .onStart(() => {
      xDebut.value = x.value;
      yDebut.value = y.value;
    })
    .onUpdate((e) => {
      if (echelle.value > 1) x.value = xDebut.value + e.translationX;
      y.value = yDebut.value + e.translationY;
    })
    .onEnd((e) => {
      if (echelle.value <= 1 && e.translationY > 120) runOnJS(fermer)();
      else if (echelle.value <= 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
      }
    });
  const doubleAppui = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (echelle.value > 1) {
        echelle.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
      } else echelle.value = withTiming(2.5);
    });
  const gestes = Gesture.Simultaneous(pincer, glisser, doubleAppui);

  const styleImage = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: echelle.value }] }));

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={fermer} statusBarTranslucent>
      <GestureHandlerRootView style={[styles.fond, { backgroundColor: '#0A0A0A' }]}>
        {uri ? (
          <GestureDetector gesture={gestes}>
            <Animated.Image source={{ uri }} style={[styles.image, styleImage]} resizeMode="contain" accessibilityIgnoresInvertColors />
          </GestureDetector>
        ) : null}
        <Appui accessibilityRole="button" accessibilityLabel={t('questions.fermerPhoto')} onPress={fermer} decalage={0} style={[styles.fermer, { top: top + espace[3] }]}>
          <View style={[styles.rond, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <X size={22} strokeWidth={2.25} color={theme.texte.principal} />
          </View>
        </Appui>
      </GestureHandlerRootView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  fermer: { position: 'absolute', left: espace[5] },
  fond: { flex: 1, justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  rond: { width: 44, height: 44, borderRadius: 22, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
