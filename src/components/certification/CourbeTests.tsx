import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirApi } from '@/services/certification/api';
import { pointsCourbe, type PointCourbe } from '@/services/certification/suivi';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

// Maquette v33 (STATS-COURBE) : axe de 0 à 990, cible 800 en pointillé, un score exact par point.
const ECHELLE = { bas: 0, haut: 990, cible: 800 } as const;
const GRAPHE = { largeur: 320, hauteur: 170, gauche: 36, droite: 304, haut: 12, bas: 140 } as const;

const yDe = (v: number) => GRAPHE.haut + ((ECHELLE.haut - v) / (ECHELLE.haut - ECHELLE.bas)) * (GRAPHE.bas - GRAPHE.haut);

/** Points de la courbe, à partir de l'historique du serveur (chargé par l'écran Statistiques). */
export const chargerCourbe = async (): Promise<PointCourbe[]> => {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  return pointsCourbe(await obtenirApi().listerTentatives(exam));
};

/** Courbe des scores (v33) : Départ à 0, diagnostic, puis un point par demi-test ou test complet terminé. Le titre suit le dernier point. */
export function CourbeTests({ points }: { points: PointCourbe[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const dernier = points[points.length - 1];
  const titre = dernier.type === 'depart' ? t('certification.stats.courbe.pasEncore') : t('certification.stats.courbe.dernier', { valeur: dernier.valeur });
  const valeurs = points.map((p) => (p.type === 'depart' ? 0 : p.valeur));
  const xDe = (i: number) => (points.length === 1 ? (GRAPHE.gauche + GRAPHE.droite) / 2 : GRAPHE.gauche + (i * (GRAPHE.droite - GRAPHE.gauche)) / (points.length - 1));
  const libelle = (p: PointCourbe) => (p.type === 'depart' ? t('certification.stats.courbe.depart') : p.type === 'diagnostic' ? t('certification.stats.courbe.diagnostic') : t('certification.stats.courbe.test', { n: p.numero }));
  const trace = valeurs.map((v, i) => `${xDe(i)},${yDe(v)}`).join(' ');
  return (
    <View accessibilityLabel={t('certification.stats.graphique')} style={styles.graphique}>
      <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
      <Svg width="100%" height={GRAPHE.hauteur} viewBox={`0 0 ${GRAPHE.largeur} ${GRAPHE.hauteur}`}>
        {[ECHELLE.bas, ECHELLE.cible, ECHELLE.haut].map((v) => (
          <SvgText key={v} x={0} y={yDe(v) + 4} fontSize={10} fill={theme.texte.secondaire}>{String(v)}</SvgText>
        ))}
        <Line x1={GRAPHE.gauche} x2={GRAPHE.droite} y1={yDe(ECHELLE.cible)} y2={yDe(ECHELLE.cible)} stroke={theme.etat.erreur} strokeWidth={1.5} strokeDasharray="6 4" />
        {points.length > 1 ? <Polyline points={trace} fill="none" stroke={theme.marque.principale} strokeWidth={2.5} /> : null}
        {valeurs.map((v, i) => (
          <Circle key={i} cx={xDe(i)} cy={yDe(v)} r={4} fill={theme.marque.principale} stroke={theme.bord.fort} strokeWidth={1.5} />
        ))}
        {points.map((p, i) => (
          <SvgText key={`l${i}`} x={xDe(i)} y={GRAPHE.hauteur - 2} fontSize={9} textAnchor="middle" fill={theme.texte.secondaire}>{libelle(p)}</SvgText>
        ))}
      </Svg>
      <View style={styles.legende}>
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.stats.cible', { score: ECHELLE.cible })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  graphique: { gap: espace[1], paddingTop: espace[2] },
  legende: { flexDirection: 'row', justifyContent: 'flex-end' },
});
