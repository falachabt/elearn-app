import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';
import { etatAnneau } from '@/services/certification/anneauObjectif';

const EPAISSEUR_RATIO = 0.1;

/** Angle du tiret : 0 en haut, sens horaire, comme le remplissage. */
const pointDe = (fraction: number, centre: number, rayon: number) => {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return {
    x: centre + rayon * Math.cos(angle),
    y: centre + rayon * Math.sin(angle),
  };
};

/**
 * Cercle « score moyen par rapport à l'objectif » (maquette 4-accueil-test-cercle-objectif).
 * Sous l'objectif : rouge, score au centre. Atteint : vert, tiret au centre. Le petit tiret marque l'objectif.
 */
export function AnneauObjectif({
  score,
  objectif,
  taille = 128,
}: {
  score: number | null;
  objectif: number;
  taille?: number;
}) {
  const { theme } = useTheme();
  const e = etatAnneau(score, objectif);
  const epaisseur = Math.round(taille * EPAISSEUR_RATIO);
  const rayon = (taille - epaisseur) / 2;
  const centre = taille / 2;
  const circonference = 2 * Math.PI * rayon;
  const couleur = e.couleur === 'vert' ? theme.marque.principale : e.couleur === 'orange' ? theme.etat.alerte : theme.etat.erreur;
  const debut = pointDe(e.tiret, centre, rayon - epaisseur / 2 - 6);
  const fin = pointDe(e.tiret, centre, rayon + epaisseur / 2 + 6);
  const libelle = e.sansScore
    ? `Pas encore de score, objectif ${objectif}`
    : `Score moyen ${score} sur 990, objectif ${objectif}`;
  return (
    <View
      accessible
      accessibilityRole='image'
      accessibilityLabel={libelle}
      style={{ width: taille, height: taille, alignSelf: 'center' }}
    >
      <Svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
        <Circle
          cx={centre}
          cy={centre}
          r={rayon}
          stroke={theme.fond.creux}
          strokeWidth={epaisseur}
          fill='none'
        />
        {e.sansScore ? null : (
          <Circle
            cx={centre}
            cy={centre}
            r={rayon}
            stroke={couleur}
            strokeWidth={epaisseur}
            fill='none'
            strokeLinecap='butt'
            strokeDasharray={`${e.remplissage * circonference} ${circonference}`}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        )}
        <Line
          x1={debut.x}
          y1={debut.y}
          x2={fin.x}
          y2={fin.y}
          stroke={theme.texte.principal}
          strokeWidth={3}
          strokeLinecap='round'
        />
      </Svg>
      <View
        style={[styles.centre, { width: taille, height: taille }]}
        pointerEvents='none'
      >
        {e.atteint || e.sansScore ? (
          <Text style={[typo.h1, { color: theme.texte.principal }]}>–</Text>
        ) : (
          <>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>
              {score}
            </Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
              sur 990
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
