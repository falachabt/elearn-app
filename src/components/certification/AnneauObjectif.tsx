import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';
import { etatAnneau } from '@/services/certification/anneauObjectif';

const TAILLE = 96;
const EPAISSEUR = 9;
const RAYON = (TAILLE - EPAISSEUR) / 2;
const CENTRE = TAILLE / 2;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/** Angle du tiret : 0 en haut, sens horaire, comme le remplissage. */
const pointDe = (fraction: number, rayon: number) => {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return { x: CENTRE + rayon * Math.cos(angle), y: CENTRE + rayon * Math.sin(angle) };
};

/**
 * Cercle « score moyen par rapport à l'objectif » (maquette 4-accueil-test-cercle-objectif).
 * Sous l'objectif : rouge, score au centre. Atteint : vert, tiret au centre. Le petit tiret marque l'objectif.
 */
export function AnneauObjectif({ score, objectif }: { score: number | null; objectif: number }) {
  const { theme } = useTheme();
  const e = etatAnneau(score, objectif);
  const couleur = e.atteint ? theme.marque.principale : theme.etat.erreur;
  const debut = pointDe(e.tiret, RAYON - EPAISSEUR / 2 - 4);
  const fin = pointDe(e.tiret, RAYON + EPAISSEUR / 2 + 4);
  const libelle = e.sansScore ? `Pas encore de score, objectif ${objectif}` : `Score moyen ${score} sur 990, objectif ${objectif}`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={libelle} style={styles.conteneur}>
      <Svg width={TAILLE} height={TAILLE} viewBox={`0 0 ${TAILLE} ${TAILLE}`}>
        <Circle cx={CENTRE} cy={CENTRE} r={RAYON} stroke={theme.fond.creux} strokeWidth={EPAISSEUR} fill="none" />
        {e.sansScore ? null : (
          <Circle
            cx={CENTRE}
            cy={CENTRE}
            r={RAYON}
            stroke={couleur}
            strokeWidth={EPAISSEUR}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${e.remplissage * CIRCONFERENCE} ${CIRCONFERENCE}`}
            transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
          />
        )}
        <Line x1={debut.x} y1={debut.y} x2={fin.x} y2={fin.y} stroke={theme.texte.principal} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
      <View style={styles.centre} pointerEvents="none">
        {e.atteint || e.sansScore ? (
          <Text style={[typo.h2, { color: theme.texte.principal }]}>–</Text>
        ) : (
          <>
            <Text style={[typo.h2, { color: theme.texte.principal }]}>{score}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>sur 990</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { width: TAILLE, height: TAILLE, alignSelf: 'center' },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
