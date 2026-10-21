import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COULEURS = ['#FFD83D', '#10B981', '#B69CFF', '#1A75FF', '#FF9A3D', '#FF5A4F', '#FF8FB1', '#34D399'];
/** Pluie de confettis sur tout l'écran (demande de Benny, 21 octobre : de vrais confettis, nombreux, jusqu'en bas). */
export const NB_CONFETTIS = 130;
/** « Réduire les animations » : une pluie plus légère et sans rotation, mais la célébration reste visible. */
export const NB_CONFETTIS_REDUIT = 40;
/** Chute environ 3,5 fois plus longue qu'à l'origine (1,8 à 2,6 s). */
const FACTEUR_DUREE = 3.5;
const DUREE_MIN_MS = 1800 * FACTEUR_DUREE;
const DUREE_ALEA_MS = 800 * FACTEUR_DUREE;
const DELAI_MAX_MS = 900;
/** Durée maximale d'une particule, retard compris : le toast garde les confettis montés au moins aussi longtemps. */
export const DUREE_CONFETTIS_MS = DUREE_MIN_MS + DUREE_ALEA_MS + DELAI_MAX_MS + 300;

type Forme = 'rectangle' | 'cercle' | 'ruban';

export interface Particule {
  id: number;
  xDepart: number;
  largeur: number;
  hauteur: number;
  forme: Forme;
  couleur: string;
  delai: number;
  duree: number;
  rotationFin: number;
  balancement: number;
}

export function genererParticules(largeur: number, nombre = NB_CONFETTIS, aleatoire: () => number = Math.random): Particule[] {
  return Array.from({ length: nombre }, (_, i) => {
    const forme: Forme = i % 5 === 0 ? 'cercle' : i % 5 === 1 ? 'ruban' : 'rectangle';
    const taille = 7 + Math.floor(aleatoire() * 7);
    return {
      id: i,
      xDepart: aleatoire() * largeur,
      largeur: forme === 'ruban' ? Math.max(4, Math.round(taille / 2)) : taille,
      hauteur: forme === 'cercle' ? taille : forme === 'ruban' ? taille * 2.4 : Math.round(taille * 1.5),
      forme,
      couleur: COULEURS[i % COULEURS.length],
      delai: Math.floor(aleatoire() * DELAI_MAX_MS),
      duree: DUREE_MIN_MS + Math.floor(aleatoire() * DUREE_ALEA_MS),
      rotationFin: (aleatoire() > 0.5 ? 1 : -1) * (540 + Math.floor(aleatoire() * 900)),
      balancement: 18 + aleatoire() * 40,
    };
  });
}

export function ConfettisCelebration({ reduit = false }: { reduit?: boolean }) {
  const { width, height } = useWindowDimensions();
  const [particules] = useState(() => genererParticules(width, reduit ? NB_CONFETTIS_REDUIT : NB_CONFETTIS));
  const [animations] = useState(() => particules.map(() => new Animated.Value(0)));

  useEffect(() => {
    const lancements = animations.map((anim, i) =>
      Animated.sequence([
        Animated.delay(particules[i].delai),
        Animated.timing(anim, { toValue: 1, duration: particules[i].duree, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    const composite = Animated.parallel(lancements);
    composite.start();
    return () => composite.stop();
  }, [animations, particules]);

  return (
    <View testID="confettis" pointerEvents="none" style={styles.conteneur}>
      {particules.map((p, i) => {
        const anim = animations[i];
        // Du haut de l'écran (hors champ) jusqu'au-delà du bas : les confettis traversent tout l'écran.
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
        // Balancement de gauche à droite pendant la chute.
        const translateX = anim.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, p.balancement, 0, -p.balancement, 0],
        });
        const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${reduit ? 0 : p.rotationFin}deg`] });
        // Bascule en trois dimensions : le confetti se retourne comme un vrai bout de papier.
        const bascule = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', reduit ? '0deg' : '180deg', reduit ? '0deg' : '360deg'] });
        const opacity = anim.interpolate({ inputRange: [0, 0.04, 0.94, 1], outputRange: [0, 1, 1, 0] });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particule,
              {
                left: p.xDepart,
                width: p.largeur,
                height: p.hauteur,
                borderRadius: p.forme === 'cercle' ? p.largeur / 2 : 1.5,
                backgroundColor: p.couleur,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }, { rotateX: bascule }],
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
    elevation: 20,
    overflow: 'hidden',
  },
  particule: {
    position: 'absolute',
    top: 0,
  },
});
