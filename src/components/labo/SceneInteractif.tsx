import { Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect, Text as TexteSvg } from 'react-native-svg';

import { useTraduction } from '@/i18n/useTraduction';
import {
  analyserChemin,
  contexteScene,
  couleurContrastee,
  evaluerValeur,
  formaterValeurScene,
  pointsCourbe,
  pointsRessort,
  remplissageSous,
  texteScene,
  type PorteeScene,
  type SceneChat,
  type SceneElement,
} from '@/services/laboScene';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Curseur } from '../certification/Curseur';

/**
 * Bloc « scène déclarative » du labo : le moteur de rendu NATIF des scènes libres composées par l'IA
 * (format du benchmark « génération libre », route 3). La scène reçue est une donnée validée
 * (`validerScene`) : ce composant l'interprète — expressions évaluées par le parseur maison de
 * `laboScene` (aucun code exécuté), primitives dessinées en SVG, curseurs maison, affichages recalculés
 * à chaque image. Habillage : la carte, la zone de dessin, les curseurs et les affichages suivent le
 * design system et le thème (clair/sombre) ; les couleurs d'éléments viennent de la scène (hexadécimal
 * validé), avec un garde-fou de lisibilité pour les textes trop proches du fond du thème.
 */
export function SceneInteractif({ scene }: { scene: SceneChat }) {
  const { theme, sombre } = useTheme();
  const { t } = useTraduction();
  const [valeurs, setValeurs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of scene.parametres) init[p.id] = p.defaut;
    return init;
  });
  const [enMarche, setEnMarche] = useState(true);
  const [temps, setTemps] = useState(0);
  const tempsRef = useRef(0);

  useEffect(() => {
    if (!enMarche) return;
    let raf = 0;
    let dernier: number | null = null;
    const pas = (maintenant: number) => {
      if (dernier !== null) {
        const dt = Math.min(0.05, (maintenant - dernier) / 1000);
        tempsRef.current += dt;
        setTemps(tempsRef.current);
      }
      dernier = maintenant;
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [enMarche]);

  const portee = contexteScene(scene, valeurs, temps);
  const hauteurZone = Math.min(360, Math.max(170, Math.round((320 * scene.hauteur) / scene.largeur)));

  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <View style={styles.entete}>
        <View style={[styles.puce, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('labo.simulation')}</Text>
        </View>
        <Text style={[typo.h3, styles.titre, { color: theme.texte.principal }]}>{scene.titre}</Text>
      </View>

      <View style={[styles.scene, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]}>
        <Svg width="100%" height={hauteurZone} viewBox={`0 0 ${scene.largeur} ${scene.hauteur}`}>
          {scene.elements.map((el, i) => (
            <ElementScene key={i} el={el} portee={portee} encre={theme.texte.principal} secondaire={theme.texte.secondaire} fondZone={theme.fond.creux} tous={scene.elements} />
          ))}
        </Svg>
      </View>

      {scene.affichages.length > 0 ? (
        <View style={styles.stats}>
          {scene.affichages.map((a) => (
            <View key={a.etiquette} style={[styles.stat, { backgroundColor: theme.fond.creux }]}>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{a.etiquette}</Text>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
                {formaterValeurScene(evaluerValeur(a.expression, portee), a.decimales)}
                {a.unite ? ` ${a.unite}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {scene.parametres.length > 0 ? (
        <View style={styles.reglages}>
          {scene.parametres.map((p) => {
            const nbPas = Math.max(1, Math.round((p.max - p.min) / p.pas));
            const cran = Math.min(nbPas, Math.max(0, Math.round(((valeurs[p.id] ?? p.defaut) - p.min) / p.pas)));
            const valeur = valeurs[p.id] ?? p.defaut;
            return (
              <View key={p.id} style={styles.reglage}>
                <Text style={[typo.texteFort, styles.reglageLibelle, { color: theme.texte.principal }]}>{p.etiquette}</Text>
                <View style={styles.flex}>
                  <Curseur
                    valeur={cran}
                    min={0}
                    max={nbPas}
                    pas={1}
                    libelle={p.etiquette}
                    onChange={(n) => setValeurs((v) => ({ ...v, [p.id]: Math.round((p.min + n * p.pas) * 1e6) / 1e6 }))}
                  />
                </View>
                <Text style={[typo.donnee, styles.reglageValeur, { color: theme.texte.principal }]}>
                  {Number.isInteger(valeur) ? String(valeur) : formaterValeurScene(valeur, 2)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

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
    </View>
  );
}

type PropsElement = { el: SceneElement; portee: PorteeScene; encre: string; secondaire: string; fondZone: string; tous: SceneElement[] };

function ElementScene({ el, portee, encre, secondaire, fondZone, tous }: PropsElement): React.ReactNode {
  const E = (v: number | string) => evaluerValeur(v, portee);
  // Traits : la couleur de la scène est gardée si elle se détache du fond de la zone, sinon encre du thème.
  const trait = (couleur: string | undefined) => couleurContrastee(couleur ?? secondaire, fondZone, encre);
  switch (el.type) {
    case 'ligne':
      return (
        <Line x1={E(el.x1)} y1={E(el.y1)} x2={E(el.x2)} y2={E(el.y2)} stroke={trait(el.couleur)} strokeWidth={el.epaisseur ?? 2} strokeLinecap="round" />
      );
    case 'cercle':
      return <Circle cx={E(el.cx)} cy={E(el.cy)} r={Math.max(0, E(el.r))} fill={el.remplissage ?? 'none'} stroke={el.contour || el.couleur ? trait(el.contour ?? el.couleur) : undefined} strokeWidth={el.contour || el.couleur ? 1.5 : 0} />;
    case 'rectangle':
      return <Rect x={E(el.x)} y={E(el.y)} width={Math.max(0, E(el.largeur))} height={Math.max(0, E(el.hauteur))} rx={3} fill={el.remplissage ?? 'none'} stroke={el.contour || el.couleur ? trait(el.contour ?? el.couleur) : undefined} strokeWidth={el.contour || el.couleur ? 1.5 : 0} />;
    case 'polygone':
      return (
        <Polygon
          points={el.points.map(([x, y]) => `${E(x)},${E(y)}`).join(' ')}
          fill={el.remplissage ?? 'none'}
          stroke={trait(el.contour ?? el.couleur)}
          strokeWidth={1.5}
        />
      );
    case 'texte': {
      // Le fond réel du texte : la forme pleine sous lui s'il y en a une, sinon le fond de la zone.
      const fondLocal = remplissageSous(tous, E(el.x), E(el.y), portee) ?? fondZone;
      return (
        <TexteSvg x={E(el.x)} y={E(el.y)} fontSize={el.taille ?? 14} fill={el.couleur ? couleurContrastee(el.couleur, fondLocal, encre) : encre} textAnchor={el.ancre ?? 'start'}>
          {texteScene(el.contenu, portee)}
        </TexteSvg>
      );
    }
    case 'chemin':
      return <CheminScene el={el} portee={portee} secondaire={secondaire} fondZone={fondZone} encre={encre} />;
    case 'courbe':
      return <Polyline points={pointsCourbe(el, portee)} fill="none" stroke={trait(el.couleur ?? '#2980b9')} strokeWidth={el.epaisseur ?? 2} />;
    case 'ressort':
      return (
        <Polyline
          points={pointsRessort(E(el.x1), E(el.y1), E(el.x2), E(el.y2), el.spires ?? 9)}
          fill="none"
          stroke={trait(el.couleur)}
          strokeWidth={2}
        />
      );
    case 'groupe': {
      const rotation = el.rotation;
      const transform = rotation ? `rotate(${E(rotation.angle)} ${rotation.cx} ${rotation.cy})` : undefined;
      return (
        <G transform={transform}>
          {el.elements.map((enfant, i) => (
            <ElementScene key={i} el={enfant} portee={portee} encre={encre} secondaire={secondaire} fondZone={fondZone} tous={tous} />
          ))}
        </G>
      );
    }
  }
}

function CheminScene({ el, portee, secondaire, fondZone, encre }: { el: Extract<SceneElement, { type: 'chemin' }>; portee: PorteeScene; secondaire: string; fondZone: string; encre: string }) {
  const echantillonneur = useMemo(() => analyserChemin(el.d), [el.d]);
  const flux = el.flux;
  const points: { x: number; y: number }[] = [];
  if (flux && echantillonneur) {
    const vitesse = evaluerValeur(flux.vitesse, portee);
    const L = echantillonneur.longueur;
    for (let i = 0; i < flux.nombre; i++) {
      points.push(echantillonneur.pointA(portee.t * vitesse + (i * L) / flux.nombre));
    }
  }
  return (
    <>
      <Path d={el.d} fill={el.remplissage ?? 'none'} stroke={couleurContrastee(el.couleur ?? secondaire, fondZone, encre)} strokeWidth={el.epaisseur ?? 2} />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={flux!.rayon} fill={flux!.couleur ?? '#f39c12'} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[4] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  puce: { borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  titre: { flex: 1 },
  scene: { borderWidth: bord.fin, borderRadius: rayon.m, overflow: 'hidden' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  stat: { flexGrow: 1, flexBasis: '28%', borderRadius: rayon.m, paddingHorizontal: espace[3], paddingVertical: espace[2], gap: espace[1] },
  reglages: { gap: espace[2] },
  reglage: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  reglageLibelle: { width: 118 },
  reglageValeur: { width: 60, textAlign: 'right' },
  flex: { flex: 1 },
  pied: { flexDirection: 'row', justifyContent: 'flex-end' },
  boutonPause: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], paddingVertical: espace[2] },
});
