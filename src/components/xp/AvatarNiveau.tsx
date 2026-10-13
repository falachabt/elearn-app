import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { calculerNiveau } from '@/services/xp';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, rayon, typo } from '@/theme/theme';

interface Props {
  photo?: string | null;
  nom?: string | null;
  totalXp?: number;
  taille?: number; // Diamètre total (par défaut 44 pour l'accueil, 64 pour Moi)
}

/**
 * Avatar circulaire avec anneau de progression XP et couleur dynamique par palier (M4-07).
 * - Anneau SVG autour de l'avatar représentant le % vers le niveau suivant.
 * - Couleur du palier appliquée à l'anneau et au badge de niveau.
 * - Mini badge avec le chiffre du niveau affiché en bas à droite.
 */
export function AvatarNiveau({ photo, nom, totalXp = 0, taille = 44 }: Props) {
  const { theme } = useTheme();
  const info = calculerNiveau(totalXp);
  const initiale = (nom ?? '').trim().charAt(0).toUpperCase() || '?';

  const epaisseurAnneau = taille >= 56 ? 4.5 : 3.5;
  const rayonCercle = (taille - epaisseurAnneau) / 2;
  const circonference = 2 * Math.PI * rayonCercle;
  const decalageProgression = circonference - circonference * info.ratioProgression;

  const tailleInterne = taille - epaisseurAnneau * 2 - 4;
  const tailleBadge = taille >= 56 ? 20 : 16;

  return (
    <View style={[styles.conteneur, { width: taille, height: taille }]}>
      {/* Anneau de progression SVG */}
      <Svg width={taille} height={taille} style={styles.svg}>
        {/* Rail de fond */}
        <Circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayonCercle}
          fill="none"
          stroke={theme.fond.creux}
          strokeWidth={epaisseurAnneau}
        />
        {/* Arc de progression selon le palier */}
        <Circle
          cx={taille / 2}
          cy={taille / 2}
          r={rayonCercle}
          fill="none"
          stroke={info.couleur}
          strokeWidth={epaisseurAnneau}
          strokeDasharray={circonference}
          strokeDashoffset={decalageProgression}
          strokeLinecap="round"
        />
      </Svg>

      {/* Avatar (photo ou initiale) */}
      <View
        style={[
          styles.cercleInterne,
          {
            width: tailleInterne,
            height: tailleInterne,
            backgroundColor: theme.accent.soleil,
            borderColor: theme.bord.fort,
          },
        ]}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.photo}
            contentFit="cover"
            accessibilityLabel={nom ?? undefined}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[taille >= 56 ? typo.h3 : typo.boutonPetit, { color: theme.texte.surCouleur }]}>
            {initiale}
          </Text>
        )}
      </View>

      {/* Mini badge du niveau en bas à droite */}
      <View
        style={[
          styles.badgeNiveau,
          {
            width: tailleBadge,
            height: tailleBadge,
            backgroundColor: info.couleur,
            borderColor: theme.bord.fort,
          },
        ]}
      >
        <Text style={[styles.texteBadge, { fontSize: taille >= 56 ? 10 : 8.5 }]}>
          {info.niveau}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: [{ rotate: '-90deg' }],
  },
  cercleInterne: {
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  badgeNiveau: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texteBadge: {
    fontFamily: 'SpaceMono-Bold',
    fontWeight: '800',
    color: '#0A0A0A',
  },
});
