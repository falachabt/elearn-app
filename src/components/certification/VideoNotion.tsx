import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Maximize, Pause, Play } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { formaterDuree } from '@/services/videos';
import type { VideoNotion as Video } from '@/services/certification/videoNotion';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, palette, rayon, typo } from '@/theme/theme';

import { EtiquetteSection } from './ui';

type Props = {
  video: Video;
  titre: string;
  onLancee: () => void;
  onTerminee: () => void;
};

/**
 * Maquette TOEIC-C5v (v3) : « Explication en vidéo ». L'image de la vidéo, sans gros bouton dessus, et une barre de
 * contrôle collée dessous (lecture / pause, progression qu'on peut toucher, temps, plein écran). Aucun flux n'est
 * ouvert avant la première lecture ; toucher l'image lance ou met en pause. La vidéo se met en pause quand l'élève
 * quitte l'écran. Le fond de la vidéo reste crème et la barre reste noire dans les deux thèmes.
 */
export function VideoNotion({ video, titre, onLancee, onTerminee }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [lecteur, setLecteur] = useState<VideoPlayer | null>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [temps, setTemps] = useState(0);
  const [dureeLue, setDureeLue] = useState(video.dureeS ?? 0);
  const [largeurPiste, setLargeurPiste] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const lecteurRef = useRef<VideoPlayer | null>(null);
  const vueRef = useRef<VideoView | null>(null);
  const debutee = useRef(false);

  const lancer = useCallback(() => {
    if (lecteurRef.current) {
      lecteurRef.current.play();
      return;
    }
    const p = createVideoPlayer(video.url);
    lecteurRef.current = p;
    p.timeUpdateEventInterval = 0.5;
    p.addListener('playToEnd', () => {
      setEnLecture(false);
      onTerminee();
    });
    p.addListener('playingChange', (e: { isPlaying: boolean }) => {
      setEnLecture(e.isPlaying);
      if (e.isPlaying && !debutee.current) {
        debutee.current = true;
        onLancee();
      }
    });
    p.addListener('timeUpdate', (e: { currentTime: number }) => {
      setTemps(e.currentTime);
      if (p.duration > 0) setDureeLue(p.duration);
    });
    setLecteur(p);
    p.play();
  }, [video.url, onLancee, onTerminee]);

  const basculer = useCallback(() => {
    const p = lecteurRef.current;
    if (!p) {
      lancer();
      return;
    }
    if (p.playing) p.pause();
    else p.play();
  }, [lancer]);

  const aller = useCallback(
    (secondes: number) => {
      const p = lecteurRef.current;
      if (!p) return;
      const max = dureeLue > 0 ? dureeLue : secondes;
      p.currentTime = Math.max(0, Math.min(max, secondes));
      setTemps(p.currentTime);
    },
    [dureeLue],
  );

  // En quittant l'écran, la vidéo se met en pause.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          lecteurRef.current?.pause();
        } catch {
          // Lecteur déjà libéré.
        }
      };
    }, []),
  );

  useEffect(
    () => () => {
      try {
        lecteurRef.current?.pause();
        lecteurRef.current?.release();
      } catch {
        // Déjà libéré.
      }
      lecteurRef.current = null;
    },
    [],
  );

  const ratio = dureeLue > 0 ? Math.min(1, Math.max(0, temps / dureeLue)) : 0;
  const total = dureeLue > 0 ? formaterDuree(dureeLue) : '';
  const duree = video.dureeS ? formaterDuree(video.dureeS) : null;
  const libelleTemps = `${formaterDuree(temps)}${total ? ` / ${total}` : ''}`;
  return (
    <View style={styles.groupe}>
      <EtiquetteSection texte={t('certification.fiche.video.etiquette')} />
      <View testID="video-notion-cadre" style={[styles.cadre, { borderColor: theme.bord.fort }]}>
        <View style={styles.image}>
          <Pressable accessible={false} onPress={basculer} style={styles.media}>
            {lecteur ? (
              <VideoView
                ref={vueRef}
                player={lecteur}
                style={styles.media}
                nativeControls={pleinEcran}
                contentFit="contain"
                fullscreenOptions={{ enable: true }}
                onFullscreenEnter={() => setPleinEcran(true)}
                onFullscreenExit={() => setPleinEcran(false)}
                pointerEvents="none"
              />
            ) : video.miniature ? (
              <Image source={{ uri: video.miniature }} style={styles.media} contentFit="cover" accessible={false} />
            ) : (
              <View style={[styles.media, styles.fondCreme]} />
            )}
          </Pressable>
        </View>
        <View style={styles.barre}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lecteur ? (enLecture ? t('certification.fiche.video.pause') : t('certification.fiche.video.lecture')) : t('certification.fiche.video.lire', { titre })}
            onPress={basculer}
            hitSlop={8}
            style={styles.zoneBouton}
          >
            <View style={[styles.bouton, { backgroundColor: theme.marque.principale }]}>
              {enLecture ? (
                <Pause size={16} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
              ) : (
                <Play size={16} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
              )}
            </View>
          </Pressable>
          <Pressable
            testID="video-notion-piste"
            accessibilityRole="adjustable"
            accessibilityLabel={t('certification.fiche.video.progression')}
            accessibilityValue={{ min: 0, max: Math.round(dureeLue), now: Math.round(temps), text: t('certification.fiche.video.progressionTexte', { temps: Math.round(temps), total: Math.round(dureeLue) }) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => aller(temps + (e.nativeEvent.actionName === 'increment' ? 5 : -5))}
            onLayout={(e) => setLargeurPiste(e.nativeEvent.layout.width)}
            onPress={(e) => {
              if (largeurPiste > 0 && dureeLue > 0) aller((e.nativeEvent.locationX / largeurPiste) * dureeLue);
            }}
            style={styles.zonePiste}
          >
            <View style={styles.piste}>
              <View style={[styles.remplie, { width: `${ratio * 100}%`, backgroundColor: theme.marque.principale }]} />
            </View>
            <View style={[styles.curseur, { left: `${ratio * 100}%`, borderColor: theme.marque.principale }]} />
          </Pressable>
          <Text style={styles.temps}>{libelleTemps || '0:00'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('certification.fiche.video.pleinEcran')}
            onPress={() => {
              try {
                void vueRef.current?.enterFullscreen();
              } catch {
                // Plein écran indisponible : sans effet.
              }
            }}
            hitSlop={8}
            style={styles.zoneIcone}
          >
            <Maximize size={18} color={palette.papier[50]} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
        {duree ? t('certification.fiche.video.aideDuree', { duree }) : t('certification.fiche.video.aide')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[2] },
  cadre: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: palette.encre[1000] },
  image: { aspectRatio: 16 / 9, backgroundColor: palette.papier[50] },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fondCreme: { backgroundColor: palette.papier[50] },
  barre: { height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: espace[2], gap: espace[2], backgroundColor: palette.encre[1000] },
  zoneBouton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginLeft: -espace[2] },
  bouton: { width: 32, height: 32, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  zonePiste: { flex: 1, height: 48, justifyContent: 'center' },
  piste: { height: 4, borderRadius: 2, backgroundColor: palette.encre[700], overflow: 'hidden' },
  remplie: { height: 4 },
  curseur: { position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: 6, borderWidth: 2, backgroundColor: palette.papier[50] },
  temps: { fontFamily: 'SpaceMono-Regular', fontSize: 12, color: palette.papier[50] },
  zoneIcone: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -espace[2] },
});
