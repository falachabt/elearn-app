import { Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTraduction } from '@/i18n/useTraduction';
import { formaterDecimal, frequencePendule, oscillationsParMinute, periodePendule } from '@/services/laboChat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Curseur } from '../certification/Curseur';

const LARGEUR = 320;
const HAUTEUR = 208;
const PIVOT_X = 160;
const PIVOT_Y = 30;

/** Longueur du fil dessinée (px) pour une longueur réelle : 0,2 m → 52 px, 3 m → 164 px. */
const filPx = (longueurM: number) => 52 + ((longueurM - 0.2) / 2.8) * 112;

/**
 * Bloc interactif « pendule simple » du labo : simulation SVG animée (aucun module natif, aucun réseau) et trois
 * curseurs — longueur, amplitude, pesanteur. Le curseur maison ne règle que des entiers : longueur et pesanteur
 * sont donc réglées en dixièmes (10 = 1,0 m ; 98 = 9,8 N/kg).
 */
export function PenduleInteractif() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [longueurDixiemes, setLongueurDixiemes] = useState(10);
  const [amplitude, setAmplitude] = useState(30);
  const [gDixiemes, setGDixiemes] = useState(98);
  const [enMarche, setEnMarche] = useState(true);
  const [angle, setAngle] = useState(30);
  const phase = useRef(0);

  const longueur = longueurDixiemes / 10;
  const g = gDixiemes / 10;
  const periode = periodePendule(longueur, g);

  useEffect(() => {
    if (!enMarche) return;
    let raf = 0;
    let dernier: number | null = null;
    const pas = (maintenant: number) => {
      if (dernier !== null) {
        const dt = Math.min(0.05, (maintenant - dernier) / 1000);
        phase.current += (2 * Math.PI * dt) / periode;
        setAngle(amplitude * Math.cos(phase.current));
      }
      dernier = maintenant;
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [enMarche, periode, amplitude]);

  const rad = (angle * Math.PI) / 180;
  const fil = filPx(longueur);
  const billeX = PIVOT_X + fil * Math.sin(rad);
  const billeY = PIVOT_Y + fil * Math.cos(rad);
  const arcR = 40;
  const arcFin = { x: PIVOT_X + arcR * Math.sin(rad), y: PIVOT_Y + arcR * Math.cos(rad) };

  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <View style={styles.entete}>
        <View style={[styles.puce, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('labo.simulation')}</Text>
        </View>
        <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('labo.pendule')}</Text>
      </View>

      <View style={[styles.scene, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
        <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}>
          <Line x1={PIVOT_X - 88} y1={PIVOT_Y} x2={PIVOT_X + 88} y2={PIVOT_Y} stroke={theme.bord.fort} strokeWidth={6} strokeLinecap="round" />
          <Line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y + fil + 14} stroke={theme.texte.secondaire} strokeWidth={1.5} strokeDasharray="4 5" />
          {Math.abs(angle) > 1 ? (
            <Path
              d={`M ${PIVOT_X} ${PIVOT_Y + arcR} A ${arcR} ${arcR} 0 0 ${angle > 0 ? 1 : 0} ${arcFin.x} ${arcFin.y}`}
              stroke={theme.marque.forte}
              strokeWidth={2}
              fill="none"
            />
          ) : null}
          <Line x1={PIVOT_X} y1={PIVOT_Y} x2={billeX} y2={billeY} stroke={theme.texte.secondaire} strokeWidth={2.5} />
          <Circle cx={billeX} cy={billeY} r={15} fill={theme.marque.principale} stroke={theme.bord.fort} strokeWidth={2} />
          <Circle cx={PIVOT_X} cy={PIVOT_Y} r={5} fill={theme.bord.fort} />
        </Svg>
        <Text style={[typo.donnee, styles.angle, { color: theme.texte.secondaire }]}>θ = {formaterDecimal(angle, 1)}°</Text>
      </View>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: theme.fond.creux }]}>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.periode')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{formaterDecimal(periode)} s</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: theme.fond.creux }]}>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.frequence')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{formaterDecimal(frequencePendule(longueur, g))} Hz</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: theme.fond.creux }]}>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.oscillations')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{formaterDecimal(oscillationsParMinute(longueur, g), 1)}</Text>
        </View>
      </View>

      <View style={styles.reglages}>
        <View style={styles.reglage}>
          <Text style={[typo.texteFort, styles.reglageLibelle, { color: theme.texte.principal }]}>{t('labo.longueur')}</Text>
          <View style={styles.flex}>
            <Curseur valeur={longueurDixiemes} min={2} max={30} pas={1} onChange={setLongueurDixiemes} libelle={t('labo.longueur')} />
          </View>
          <Text style={[typo.donnee, styles.reglageValeur, { color: theme.texte.principal }]}>{formaterDecimal(longueur, 1)} m</Text>
        </View>
        <View style={styles.reglage}>
          <Text style={[typo.texteFort, styles.reglageLibelle, { color: theme.texte.principal }]}>{t('labo.amplitude')}</Text>
          <View style={styles.flex}>
            <Curseur valeur={amplitude} min={5} max={60} pas={1} onChange={setAmplitude} libelle={t('labo.amplitude')} />
          </View>
          <Text style={[typo.donnee, styles.reglageValeur, { color: theme.texte.principal }]}>{amplitude} °</Text>
        </View>
        <View style={styles.reglage}>
          <Text style={[typo.texteFort, styles.reglageLibelle, { color: theme.texte.principal }]}>{t('labo.pesanteur')}</Text>
          <View style={styles.flex}>
            <Curseur valeur={gDixiemes} min={16} max={250} pas={1} onChange={setGDixiemes} libelle={t('labo.pesanteur')} />
          </View>
          <Text style={[typo.donnee, styles.reglageValeur, { color: theme.texte.principal }]}>{formaterDecimal(g, 1)} N/kg</Text>
        </View>
      </View>

      <View style={styles.pied}>
        <Appui
          accessibilityRole="button"
          accessibilityLabel={enMarche ? t('labo.pause') : t('labo.reprendre')}
          onPress={() => setEnMarche((m) => !m)}
          rayon={rayon.m}
          ombre={2}
          decalage={2}
          couleurOmbre={theme.ombre}
        >
          <View style={[styles.boutonPause, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            {enMarche ? <Pause size={16} strokeWidth={2.25} color={theme.texte.principal} /> : <Play size={16} strokeWidth={2.25} color={theme.texte.principal} />}
            <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{enMarche ? t('labo.pause') : t('labo.reprendre')}</Text>
          </View>
        </Appui>
      </View>

      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('labo.notePendule')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[4] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  puce: { borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  scene: { borderWidth: bord.fin, borderRadius: rayon.m, overflow: 'hidden' },
  angle: { position: 'absolute', left: espace[4], bottom: espace[3] },
  stats: { flexDirection: 'row', gap: espace[3] },
  stat: { flex: 1, borderRadius: rayon.m, paddingHorizontal: espace[3], paddingVertical: espace[2], gap: espace[1] },
  reglages: { gap: espace[2] },
  reglage: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  reglageLibelle: { width: 104 },
  reglageValeur: { width: 76, textAlign: 'right' },
  flex: { flex: 1 },
  pied: { flexDirection: 'row', justifyContent: 'flex-end' },
  boutonPause: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[2] },
});
