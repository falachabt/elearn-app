import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COULEURS = ['#FFD83D', '#10B981', '#B69CFF', '#1A75FF', '#FF9A3D', '#FF5252', '#34D399'];
const NB_PARTICULES = 28;
/** Chute lente (demande de Benny, 21 octobre : environ 3,5 fois plus longue qu'avant, 1,8 à 2,6 s). */
const FACTEUR_DUREE = 3.5;
const DUREE_MIN_MS = 1800 * FACTEUR_DUREE;
const DUREE_ALEA_MS = 800 * FACTEUR_DUREE;
/** Durée maximale d'une particule, retard compris : le toast garde les confettis montés au moins aussi longtemps. */
export const DUREE_CONFETTIS_MS = DUREE_MIN_MS + DUREE_ALEA_MS + 200 + 28 * 20 + 300;

interface Particule {
  id: number;
  xDepart: number;
  taille: number;
  estCercle: boolean;
  couleur: string;
  delai: number;
  duree: number;
  rotationFin: number;
  derivationX: number;
}

function genererParticules(largeur: number): Particule[] {
  const liste: Particule[] = [];
  for (let i = 0; i < NB_PARTICULES; i++) {
    const couleur = COULEURS[i % COULEURS.length];
    liste.push({
      id: i,
      xDepart: Math.random() * largeur,
      taille: 6 + Math.floor(Math.random() * 8),
      estCercle: i % 3 === 0,
      couleur,
      delai: Math.floor(Math.random() * 200),
      duree: DUREE_MIN_MS + Math.floor(Math.random() * DUREE_ALEA_MS),
      rotationFin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.floor(Math.random() * 360)),
      derivationX: (Math.random() - 0.5) * 80,
    });
  }
  return liste;
}

export function ConfettisCelebration() {
  const { width, height } = Dimensions.get('window');
  const [particules] = useState(() => genererParticules(width));
  const [animations] = useState(() => particules.map(() => new Animated.Value(0)));

  useEffect(() => {
    const lancements = animations.map((anim, i) => {
      const p = particules[i];
      return Animated.sequence([
        Animated.delay(p.delai),
        Animated.timing(anim, {
          toValue: 1,
          duration: p.duree,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    });

    const composite = Animated.stagger(20, lancements);
    composite.start();
    return () => {
      composite.stop();
    };
  }, [animations, particules]);

  return (
    <View testID="confettis" pointerEvents="none" style={styles.conteneur}>
      {particules.map((p, i) => {
        const anim = animations[i];
        const translateY = anim.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [-30, -50, height * 0.55],
        });
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.derivationX],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotationFin}deg`],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        const scale = anim.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0, 1.2, 0.8],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particule,
              {
                left: p.xDepart,
                width: p.taille,
                height: p.estCercle ? p.taille : p.taille * 1.5,
                borderRadius: p.estCercle ? p.taille / 2 : 2,
                backgroundColor: p.couleur,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  particule: {
    position: 'absolute',
    top: 0,
    borderWidth: 1,
    borderColor: '#0A0A0A',
  },
});
