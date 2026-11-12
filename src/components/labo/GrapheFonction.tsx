import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as TexteSvg } from 'react-native-svg';

import { useTraduction } from '@/i18n/useTraduction';
import { echantillonsFonction, expressionFonction, formaterDecimal, sommetFonction, valeurFonction } from '@/services/laboChat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

const LARGEUR = 320;
const HAUTEUR = 232;
const MARGE = { gauche: 30, droite: 12, haut: 12, bas: 24 };
const X_MIN = -4;
const X_MAX = 3;

/** Pas des graduations verticales selon l'étendue des valeurs. */
function pasGraduation(etendue: number): number {
  if (etendue > 20) return 5;
  if (etendue > 8) return 2;
  return 1;
}

/**
 * Bloc interactif « graphe de fonction » du labo : courbe d'une parabole dessinée en SVG (aucun module natif,
 * aucun réseau), axes et graduations, sommet marqué d'un point et de son étiquette S.
 */
export function GrapheFonction({ a, b, c }: { a: number; b: number; c: number }) {
  const { theme } = useTheme();
  const { t } = useTraduction();

  const points = echantillonsFonction(a, b, c, X_MIN, X_MAX, 0.05);
  const ys = points.map((p) => p.y);
  const yMinBrut = Math.min(0, ...ys);
  const yMaxBrut = Math.max(0, ...ys);
  const margeY = (yMaxBrut - yMinBrut || 1) * 0.08;
  const yMin = yMinBrut - margeY;
  const yMax = yMaxBrut + margeY;
  const pas = pasGraduation(yMax - yMin);

  const sx = (x: number) => MARGE.gauche + ((x - X_MIN) / (X_MAX - X_MIN)) * (LARGEUR - MARGE.gauche - MARGE.droite);
  const sy = (y: number) => HAUTEUR - MARGE.bas - ((y - yMin) / (yMax - yMin)) * (HAUTEUR - MARGE.haut - MARGE.bas);

  const graduationsX: number[] = [];
  for (let x = Math.ceil(X_MIN); x <= X_MAX; x++) graduationsX.push(x);
  const graduationsY: number[] = [];
  for (let y = Math.ceil(yMin / pas) * pas; y <= yMax; y += pas) graduationsY.push(Math.round(y * 100) / 100);

  const sommet = sommetFonction(a, b, c);
  const chaine = points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <View style={styles.entete}>
        <View style={[styles.puce, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('labo.graphe')}</Text>
        </View>
        <Text style={[typo.h3, { color: theme.texte.principal }]}>{expressionFonction(a, b, c)}</Text>
      </View>

      <View style={[styles.scene, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
        <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}>
          {graduationsX.map((x) => (
            <Line key={`gx${x}`} x1={sx(x)} y1={MARGE.haut} x2={sx(x)} y2={HAUTEUR - MARGE.bas} stroke={theme.bord.doux} strokeWidth={0.75} />
          ))}
          {graduationsY.map((y) => (
            <Line key={`gy${y}`} x1={MARGE.gauche} y1={sy(y)} x2={LARGEUR - MARGE.droite} y2={sy(y)} stroke={theme.bord.doux} strokeWidth={0.75} />
          ))}
          <Line x1={MARGE.gauche} y1={sy(0)} x2={LARGEUR - MARGE.droite} y2={sy(0)} stroke={theme.bord.fort} strokeWidth={1.5} />
          <Line x1={sx(0)} y1={MARGE.haut} x2={sx(0)} y2={HAUTEUR - MARGE.bas} stroke={theme.bord.fort} strokeWidth={1.5} />
          {graduationsX.map((x) => (
            <TexteSvg key={`tx${x}`} x={sx(x)} y={HAUTEUR - 8} fontSize={10} fill={theme.texte.secondaire} textAnchor="middle">
              {x}
            </TexteSvg>
          ))}
          {graduationsY.map((y) => (
            <TexteSvg key={`ty${y}`} x={MARGE.gauche - 5} y={sy(y) + 3} fontSize={10} fill={theme.texte.secondaire} textAnchor="end">
              {y}
            </TexteSvg>
          ))}
          <TexteSvg x={LARGEUR - MARGE.droite - 2} y={sy(0) - 6} fontSize={11} fill={theme.texte.secondaire} textAnchor="end">
            x
          </TexteSvg>
          <TexteSvg x={sx(0) + 6} y={MARGE.haut + 4} fontSize={11} fill={theme.texte.secondaire}>
            y
          </TexteSvg>
          <Polyline points={chaine} fill="none" stroke={theme.marque.principale} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {sommet ? (
            <>
              <Circle cx={sx(sommet.x)} cy={sy(sommet.y)} r={4.5} fill={theme.bord.fort} stroke={theme.fond.surface} strokeWidth={1.5} />
              <TexteSvg x={sx(sommet.x) + 9} y={sy(sommet.y) - 7} fontSize={12} fontWeight="bold" fill={theme.texte.principal}>
                S
              </TexteSvg>
            </>
          ) : null}
        </Svg>
      </View>

      {sommet ? (
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
          {t('labo.sommet')}({formaterDecimal(sommet.x)} ; {formaterDecimal(sommet.y, 3)}) · f(0) = {formaterDecimal(valeurFonction(a, b, c, 0), 0)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[4] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  puce: { borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  scene: { borderWidth: bord.fin, borderRadius: rayon.m, overflow: 'hidden' },
});
