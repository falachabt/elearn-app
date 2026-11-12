import { Camera } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

const LARGEUR = 240;
const HAUTEUR = 150;
const PIVOT_X = 120;
const PIVOT_Y = 26;
const FIL = 92;
const ANGLE = (32 * Math.PI) / 180;

/**
 * « Photo » de démonstration du labo : un dessin qui tient lieu de photo d'un pendule (aucune vraie image, aucun
 * accès à l'appareil photo). Dans le produit final, ce bloc sera la vraie photo de l'élève ; c'est à partir d'elle
 * que le modèle vision choisira le bloc interactif à générer.
 */
export function PhotoSimulee() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const billeX = PIVOT_X + FIL * Math.sin(ANGLE);
  const billeY = PIVOT_Y + FIL * Math.cos(ANGLE);
  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <View style={[styles.scene, { backgroundColor: theme.accent.soleilTresDoux }]}>
        <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}>
          <Line x1={PIVOT_X - 64} y1={PIVOT_Y} x2={PIVOT_X + 64} y2={PIVOT_Y} stroke={theme.bord.fort} strokeWidth={5} strokeLinecap="round" />
          <Line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + FIL + 8} stroke={theme.texte.secondaire} strokeWidth={1.25} strokeDasharray="4 5" />
          <Line x1={PIVOT_X} y1={PIVOT_Y} x2={billeX} y2={billeY} stroke={theme.texte.secondaire} strokeWidth={2} />
          <Circle cx={billeX} cy={billeY} r={13} fill={theme.marque.principale} stroke={theme.bord.fort} strokeWidth={2} />
          <Circle cx={PIVOT_X} cy={PIVOT_Y} r={4} fill={theme.bord.fort} />
          <Line x1={16} y1={HAUTEUR - 14} x2={LARGEUR - 16} y2={HAUTEUR - 14} stroke={theme.bord.doux} strokeWidth={2} />
        </Svg>
      </View>
      <View style={styles.legende}>
        <Camera size={14} strokeWidth={2.25} color={theme.texte.secondaire} />
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.photoEnvoyee')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[2], gap: espace[2], width: 264 },
  scene: { borderRadius: rayon.s, overflow: 'hidden' },
  legende: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[2] },
});
