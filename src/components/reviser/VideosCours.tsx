import { Image } from 'expo-image';
import { Check, Play } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { getSupabase } from '@/services/supabase';
import {
  compterTerminees,
  formaterDuree,
  indiceCarrousel,
  lireDerniereVideo,
  lireSuivis,
  lireVideos,
  type SuivisVideos,
  type VideoCours,
} from '@/services/videos';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Etiquette } from '../Etiquette';

export const LARGEUR_CARTE_VIDEO = 218;
const ECART_CARTES = espace[3];

/**
 * D1e · Carrousel des vidéos du cours (maquette validée par Benny le 26/10/2026) : tout en haut de la page du
 * cours, seulement si le cours a au moins une vidéo prête. Il s'ouvre positionné sur la vidéo en cours de
 * visionnage (dernière regardée de ce cours), sinon sur la Partie 1.
 */
export function VideosCours({ cours, nom, matiere }: { cours: number; nom?: string; matiere?: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [videos, setVideos] = useState<VideoCours[] | null>(null);
  const [suivis, setSuivis] = useState<SuivisVideos>({});
  const [avant, setAvant] = useState(0);
  const defilement = useRef<ScrollView>(null);
  const positionne = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      positionne.current = false;
      void Promise.all([lireVideos(getSupabase(), cours).catch(() => [] as VideoCours[]), lireSuivis(), lireDerniereVideo()])
        .then(([v, s, d]) => {
          if (!actif) return;
          setVideos(v);
          setSuivis(s);
          setAvant(indiceCarrousel(v, s, d));
        })
        .catch(() => actif && setVideos([]));
      return () => {
        actif = false;
      };
    }, [cours, pret]),
  );

  if (!videos?.length) return null;
  const terminees = compterTerminees(videos, suivis);

  const ouvrir = (v: VideoCours) =>
    router.push({ pathname: '/video', params: { cours: String(cours), video: String(v.id), nom: nom ?? '', matiere: matiere ?? '' } });

  return (
    <View>
      <Text style={[typo.etiquette, styles.etiquette, { color: theme.texte.secondaire }]}>{t('videos.etiquette', { n: terminees, total: videos.length })}</Text>
      <ScrollView
        ref={defilement}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rang}
        onContentSizeChange={() => {
          if (positionne.current || avant === 0) return;
          positionne.current = true;
          defilement.current?.scrollTo({ x: avant * (LARGEUR_CARTE_VIDEO + ECART_CARTES), animated: false });
        }}
      >
        {videos.map((v) => {
          const suivi = suivis[v.id];
          const enCours = !!suivi && !suivi.terminee && suivi.positionS > 0;
          const progression = suivi?.dureeS ? Math.min(1, suivi.positionS / suivi.dureeS) : 0;
          const sousTitre = suivi?.terminee
            ? t('videos.terminee')
            : enCours
              ? `${t('videos.reprendreA', { temps: formaterDuree(suivi.positionS) })} · ${t('videos.reste', { temps: formaterDuree((suivi.dureeS ?? 0) - suivi.positionS) })}`
              : t('videos.pasCommencee');
          return (
            <Appui
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`${t('videos.partie', { n: v.numero })}. ${v.titre}. ${sousTitre}`}
              onPress={() => ouvrir(v)}
              rayon={rayon.m}
              ombre={ombre.carte}
              decalage={2}
              couleurOmbre={theme.ombre}
            >
              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: enCours ? theme.marque.principale : theme.bord.fort }, enCours && styles.enCours]}>
                <View style={styles.visuel}>
                  {v.miniature ? <Image source={{ uri: v.miniature }} style={styles.miniature} contentFit="cover" /> : <View style={[styles.miniature, { backgroundColor: theme.fond.creux }]} />}
                  {suivi?.terminee ? (
                    <View style={[styles.badge, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                      <Check size={11} strokeWidth={3.5} color={theme.texte.surCouleur} />
                      <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.vue')}</Text>
                    </View>
                  ) : enCours ? (
                    <View style={[styles.badge, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                      <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.enCours')}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.boutonLecture, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                    <Play size={17} strokeWidth={2.5} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
                  </View>
                  {v.dureeS ? (
                    <View style={styles.duree}>
                      <Text style={styles.dureeTexte}>{formaterDuree(v.dureeS)}</Text>
                    </View>
                  ) : null}
                  {enCours ? (
                    <View style={styles.progressionFond}>
                      <View style={[styles.progression, { width: `${Math.round(progression * 100)}%`, backgroundColor: theme.marque.principale }]} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.texte}>
                  <Etiquette texte={t('videos.partie', { n: v.numero })} />
                  <Text numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{v.titre}</Text>
                  <Text numberOfLines={1} style={[typo.legende, { color: enCours ? theme.marque.forte : theme.texte.secondaire }]}>{sousTitre}</Text>
                </View>
              </View>
            </Appui>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { marginBottom: espace[2] },
  rang: { gap: ECART_CARTES, paddingRight: espace[1], paddingBottom: espace[1] },
  carte: { width: LARGEUR_CARTE_VIDEO, borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  enCours: { borderWidth: bord.epais },
  visuel: { height: 110, position: 'relative', backgroundColor: '#000' },
  miniature: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: espace[2], top: espace[2], flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  boutonLecture: { position: 'absolute', alignSelf: 'center', top: 35, width: 40, height: 40, borderRadius: 20, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  duree: { position: 'absolute', right: espace[2], bottom: espace[2], backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  dureeTexte: { color: '#FFF7E3', fontSize: 11, fontWeight: '700' },
  progressionFond: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: 'rgba(10,10,10,0.45)' },
  progression: { height: '100%' },
  texte: { padding: espace[3], gap: espace[1] },
  titre: { fontSize: 14, lineHeight: 18 },
});
