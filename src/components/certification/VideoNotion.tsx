import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Play } from 'lucide-react-native';
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
 * Maquette TOEIC-C5v (v2) : « Explication en vidéo ». La vignette de la vidéo avec son bouton de lecture ; aucun flux
 * n'est ouvert avant l'appui. La lecture se fait sur place (contrôles natifs, plein écran possible) et se met en pause
 * quand l'élève quitte l'écran. Le fond de la vidéo reste crème dans les deux thèmes.
 */
export function VideoNotion({ video, titre, onLancee, onTerminee }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [lecteur, setLecteur] = useState<VideoPlayer | null>(null);
  const lecteurRef = useRef<VideoPlayer | null>(null);
  const debutee = useRef(false);

  const lancer = useCallback(() => {
    if (lecteurRef.current) {
      lecteurRef.current.play();
      return;
    }
    const p = createVideoPlayer(video.url);
    lecteurRef.current = p;
    p.addListener('playToEnd', () => onTerminee());
    p.addListener('playingChange', (e: { isPlaying: boolean }) => {
      if (e.isPlaying && !debutee.current) {
        debutee.current = true;
        onLancee();
      }
    });
    setLecteur(p);
    p.play();
  }, [video.url, onLancee, onTerminee]);

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

  const duree = video.dureeS ? formaterDuree(video.dureeS) : null;
  return (
    <View style={styles.groupe}>
      <EtiquetteSection texte={t('certification.fiche.video.etiquette')} />
      <View testID="video-notion-cadre" style={[styles.cadre, { borderColor: theme.bord.fort }]}>
        {lecteur ? (
          <VideoView player={lecteur} style={styles.media} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('certification.fiche.video.lire', { titre })}
            onPress={lancer}
            style={styles.lecture}
          >
              {video.miniature ? <Image source={{ uri: video.miniature }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : <View style={[StyleSheet.absoluteFill, styles.fondCreme]} />}
              <View style={[styles.bouton, { borderColor: palette.encre[1000], backgroundColor: theme.marque.principale }]}>
                <Play size={26} color={palette.encre[1000]} fill={palette.encre[1000]} strokeWidth={2} />
              </View>
          </Pressable>
        )}
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
  cadre: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: palette.papier[50] },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  lecture: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fondCreme: { backgroundColor: palette.papier[50] },
  bouton: { width: 56, height: 56, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});
