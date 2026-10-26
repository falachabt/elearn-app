import { Image } from 'expo-image';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Check, Download, Trash2 } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { Banniere } from '@/components/Banniere';
import { Ecran } from '@/components/Ecran';
import { Etiquette } from '@/components/Etiquette';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { lireEntrainement, lireProgresChapitres, type Compteur, type ProgresChapitre } from '@/services/entrainement';
import { enregistrerTempsActivite } from '@/services/activite';
import { getSupabase } from '@/services/supabase';
import {
  formaterDuree,
  lireTelechargees,
  lireVideos,
  marquerTerminee,
  noterDerniereVideo,
  noterPosition,
  supprimerVideoTelechargee,
  synchroniserSuivis,
  telechargerVideo,
  telechargerVideos,
  videoLocale,
  type SuivisVideos,
  type VideoCours,
  type VideoTelechargee,
} from '@/services/videos';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { BlocEntrainement, GroupeColle, LigneGroupe } from './BlocEntrainement';

/**
 * Lecteur vidéo d'un cours (maquette validée par Benny le 26/10/2026) : style YouTube — la vidéo dans son
 * rectangle en haut, le titre, la PLAYLIST du cours en dessous, et le bloc « S'entraîner sur ce cours »
 * épinglé en bas. L'écran vit dans le groupe (onglets) : le header de l'app (retour + titre du cours) et la
 * barre d'onglets restent visibles. La position est reprise là où l'élève s'était arrêté et sauvegardée
 * toutes les 5 secondes, à la pause et en quittant l'écran (suivi local synchronisé au serveur, lot 2) ;
 * le temps réellement visionné alimente les activités et la progression (lot 3).
 * Le lecteur natif est tenu en ref (création impérative), comme le lecteur audio de la certification.
 */
export function LecteurVideo() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, video, nom, matiere } = useLocalSearchParams<{ cours: string; video?: string; nom?: string; matiere?: string }>();
  const coursId = Number(cours);
  const pret = useSessionPrete();
  const [videos, setVideos] = useState<VideoCours[] | null>(null);
  const [suivis, setSuivis] = useState<SuivisVideos>({});
  const [couranteId, setCouranteId] = useState<string | null>(video ?? null);
  const [entrainement, setEntrainement] = useState<(Compteur & { progres: ProgresChapitre }) | null>(null);
  const [telechargees, setTelechargees] = useState<Record<string, VideoTelechargee>>({});
  const [dlEnCours, setDlEnCours] = useState<string | null>(null);
  const [toutDl, setToutDl] = useState(false);
  const courante = videos?.find((v) => v.id === couranteId) ?? videos?.[0] ?? null;
  const restantes = videos ? videos.filter((v) => !telechargees[v.id]) : [];

  const rafraichirTelechargees = useCallback(() => {
    void lireTelechargees().then(setTelechargees).catch(() => undefined);
  }, []);

  // Téléchargement explicite d'une vidéo (lot 4) : le bouton de sa ligne de playlist la garde sur le
  // téléphone ; la même touche la supprime quand elle y est déjà.
  const basculerTelechargement = useCallback(
    async (v: VideoCours) => {
      if (dlEnCours) return;
      if (videoLocale(v.id)) {
        await supprimerVideoTelechargee(v.id).catch(() => undefined);
        rafraichirTelechargees();
        return;
      }
      setDlEnCours(v.id);
      try {
        await telechargerVideo(v);
      } catch {
        // Échec (réseau, place) : la vidéo reste en ligne seulement, rien n'est inscrit.
      }
      setDlEnCours(null);
      rafraichirTelechargees();
    },
    [dlEnCours, rafraichirTelechargees],
  );

  const toutTelecharger = useCallback(async () => {
    if (!videos || toutDl) return;
    setToutDl(true);
    await telechargerVideos(videos.filter((v) => !videoLocale(v.id))).catch(() => undefined);
    setToutDl(false);
    rafraichirTelechargees();
  }, [videos, toutDl, rafraichirTelechargees]);

  // Créé une fois, source vide : les vidéos du cours arrivent ensuite et remplacent la source.
  const [lecteur] = useState<VideoPlayer>(() => {
    const p = createVideoPlayer(null);
    p.timeUpdateEventInterval = 5;
    return p;
  });
  const couranteRef = useRef<VideoCours | null>(null);
  const suivisRef = useRef<SuivisVideos>({});
  const repriseFaite = useRef<string | null>(null);
  const sourceRef = useRef<string | null>(null);
  useEffect(() => {
    couranteRef.current = courante;
  }, [courante]);
  useEffect(() => {
    suivisRef.current = suivis;
  }, [suivis]);

  const sauvegarder = useCallback(() => {
    const v = couranteRef.current;
    if (!v) return;
    void noterPosition(v.id, v.cours, lecteur.currentTime, v.dureeS ?? (lecteur.duration || null)).then((s) => {
      setSuivis((avant) => ({ ...avant, [v.id]: s }));
    });
  }, [lecteur]);

  // Temps réellement visionné (lot 3) : seuls les intervalles en lecture comptent (pas les sauts de
  // position ni les pauses), mesurés par segments ouverts à la lecture et fermés à la pause, puis versés
  // dans les activités comme les autres types quand l'élève quitte la vidéo ou l'écran.
  const segmentDebut = useRef<number | null>(null);
  const segmentTitre = useRef<string | null>(null);
  const tempsLuS = useRef(0);
  const fermerSegment = useCallback(() => {
    if (segmentDebut.current !== null) {
      tempsLuS.current += (Date.now() - segmentDebut.current) / 1000;
      segmentDebut.current = null;
    }
  }, []);
  const viderTempsLu = useCallback(() => {
    fermerSegment();
    const secondes = Math.round(tempsLuS.current);
    tempsLuS.current = 0;
    if (segmentTitre.current && secondes >= 3) {
      void enregistrerTempsActivite({ type: 'video', dureeS: secondes, matiere: matiere ?? undefined, titre: segmentTitre.current });
    }
    segmentTitre.current = null;
  }, [fermerSegment, matiere]);

  // Branchement des événements du lecteur (une seule fois) et libération en fin de vie.
  useEffect(() => {
    const p = lecteur;
    const abonnements = [
      p.addListener('statusChange', ({ status }) => {
        const v = couranteRef.current;
        if (status !== 'readyToPlay' || !v || repriseFaite.current === v.id) return;
        repriseFaite.current = v.id;
        const position = suivisRef.current[v.id]?.positionS ?? 0;
        if (position > 3 && !suivisRef.current[v.id]?.terminee) p.currentTime = position;
      }),
      p.addListener('timeUpdate', () => sauvegarder()),
      p.addListener('playingChange', ({ isPlaying }) => {
        if (isPlaying) {
          if (segmentDebut.current === null) {
            segmentDebut.current = Date.now();
            segmentTitre.current = couranteRef.current?.titre ?? null;
          }
        } else {
          fermerSegment();
          sauvegarder();
        }
      }),
      p.addListener('playToEnd', () => {
        fermerSegment();
        const v = couranteRef.current;
        if (!v) return;
        void marquerTerminee(v.id, v.cours, v.dureeS).then(() => {
          setSuivis((avant) => ({
            ...avant,
            [v.id]: { positionS: v.dureeS ?? avant[v.id]?.positionS ?? 0, dureeS: v.dureeS, terminee: true, quand: Date.now(), cours: v.cours },
          }));
        });
        // Enchaînement : la partie suivante est chargée, sans lecture automatique (l'élève appuie sur lecture).
        setVideos((liste) => {
          if (!liste) return liste;
          const i = liste.findIndex((x) => x.id === v.id);
          const suivante = i >= 0 ? liste[i + 1] : undefined;
          if (suivante) setCouranteId(suivante.id);
          return liste;
        });
      }),
    ];
    return () => {
      abonnements.forEach((a) => a.remove());
      p.release();
    };
  }, [lecteur, sauvegarder, fermerSegment]);

  // Chargement : les vidéos du cours, le suivi local et les compteurs d'entraînement du pied.
  useEffect(() => {
    if (!pret || !Number.isFinite(coursId)) return;
    let actif = true;
    void (async () => {
      try {
        // La synchro serveur (lot 2) fusionne d'abord les positions du compte dans le suivi local.
        const [v, s] = await Promise.all([lireVideos(getSupabase(), coursId), synchroniserSuivis(getSupabase())]);
        if (!actif) return;
        setVideos(v);
        setSuivis(s);
        rafraichirTelechargees();
        setCouranteId((avant) => avant ?? v[0]?.id ?? null);
      } catch {
        if (actif) setVideos([]);
      }
    })();
    lireEntrainement(getSupabase(), coursId)
      .then(async (e) => {
        const progres = (await lireProgresChapitres([coursId]))[coursId] ?? { faits: 0, quizFaits: 0 };
        if (actif) setEntrainement(e.quiz.length || e.exercices.length ? { quiz: e.quiz.length, exercices: e.exercices.length, progres } : null);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [coursId, pret, rafraichirTelechargees]);

  // Changement de vidéo (playlist ou enchaînement) : on remplace la source, sans lecture automatique.
  // Une copie téléchargée (lot 4) est préférée au flux — décidée au moment du choix de la vidéo.
  useEffect(() => {
    if (!courante) return;
    const uri = videoLocale(courante.id) ?? courante.url;
    if (sourceRef.current === uri) return;
    viderTempsLu();
    sourceRef.current = uri;
    repriseFaite.current = null;
    lecteur.replace({ uri });
    void noterDerniereVideo({ video: courante.id, cours: coursId });
  }, [courante, coursId, lecteur, viderTempsLu]);

  // En quittant l'écran (autre onglet, retour) : on sauvegarde et on met en pause.
  useFocusEffect(
    useCallback(() => {
      return () => {
        sauvegarder();
        viderTempsLu();
        // La position fraîche part au serveur (au retour du réseau, la synchro suivante la poussera).
        void synchroniserSuivis(getSupabase());
        try {
          lecteur.pause();
        } catch {
          // Lecteur déjà libéré.
        }
      };
    }, [lecteur, sauvegarder, viderTempsLu]),
  );

  const retour = () => router.navigate({ pathname: '/cours/chapitre', params: { id: String(coursId), nom: nom ?? '', matiere: matiere ?? '' } });
  const suiviCourante = courante ? suivis[courante.id] : undefined;
  const terminees = videos ? videos.filter((v) => suivis[v.id]?.terminee).length : 0;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('videos.retourCours')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.texteFort, styles.titreEntete, { color: theme.texte.principal }]}>{nom}</Text>
        </>
      }
      pied={
        entrainement ? (
          <BlocEntrainement
            cours={String(coursId)}
            nom={nom ?? ''}
            quiz={entrainement.quiz}
            exercices={entrainement.exercices}
            faits={entrainement.progres.faits}
            quizFaits={entrainement.progres.quizFaits}
            libelle={t('reviser.entrainerCours')}
          />
        ) : undefined
      }
    >
      {videos !== null && videos.length === 0 ? <Banniere ton="erreur" titre={t('videos.erreur')} /> : null}
      {courante ? (
        <>
          <View style={[styles.cadreVideo, { borderColor: theme.bord.fort }]}>
            <VideoView player={lecteur} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
          </View>
          <View style={styles.infos}>
            <Etiquette texte={t('videos.partie', { n: courante.numero })} />
            <Text numberOfLines={2} style={[typo.h3, { color: theme.texte.principal }]}>{courante.titre}</Text>
            <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>
              {[matiere, nom, telechargees[courante.id] ? t('videos.telechargee') : null, suiviCourante && !suiviCourante.terminee && suiviCourante.positionS > 3 ? t('videos.repriseAuto', { temps: formaterDuree(suiviCourante.positionS) }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          {videos && videos.length >= 1 ? (
            <>
              <View style={styles.lignePlaylist}>
                <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>
                  {t('videos.playlist')} · {terminees} / {videos.length}
                </Text>
                {restantes.length ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('videos.toutTelecharger')} onPress={() => void toutTelecharger()} disabled={toutDl} hitSlop={8}>
                    <Text style={[typo.legende, { color: theme.marque.principale }]}>{toutDl ? t('videos.telechargementEnCours') : t('videos.toutTelecharger')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <GroupeColle>
                {videos.map((v, i) => {
                  const s = suivis[v.id];
                  const enLecture = v.id === courante.id;
                  const sousTitre = enLecture
                    ? t('videos.enLecture', { position: formaterDuree(s?.positionS ?? 0), duree: formaterDuree(v.dureeS) })
                    : s?.terminee
                      ? t('videos.terminee')
                      : formaterDuree(v.dureeS) || t('videos.pasCommencee');
                  const gardee = !!telechargees[v.id];
                  return (
                    <LigneGroupe
                      key={v.id}
                      premier={i === 0}
                      enCours={enLecture}
                      haut={<Etiquette texte={t('videos.partie', { n: v.numero })} />}
                      gauche={
                        <View style={[styles.mini, { borderColor: theme.bord.fort }]}>
                          {v.miniature ? <Image source={{ uri: v.miniature }} style={styles.miniImage} contentFit="cover" /> : null}
                        </View>
                      }
                      titre={v.titre}
                      sousTitre={gardee ? `${sousTitre} · ${t('videos.telechargee')}` : sousTitre}
                      droite={
                        <View style={styles.actionsVideo}>
                          {s?.terminee ? <Check size={20} strokeWidth={3} color={theme.marque.principale} /> : null}
                          {dlEnCours === v.id ? (
                            <ActivityIndicator size="small" color={theme.texte.secondaire} />
                          ) : gardee ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('videos.supprimerTelechargement')}
                              hitSlop={10}
                              onPress={() => void basculerTelechargement(v)}
                            >
                              <Trash2 size={19} strokeWidth={2.2} color={theme.texte.secondaire} />
                            </Pressable>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('videos.telecharger')}
                              hitSlop={10}
                              onPress={() => void basculerTelechargement(v)}
                            >
                              <Download size={19} strokeWidth={2.2} color={theme.texte.secondaire} />
                            </Pressable>
                          )}
                        </View>
                      }
                      onPress={() => setCouranteId(v.id)}
                    />
                  );
                })}
              </GroupeColle>
            </>
          ) : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titreEntete: { flex: 1, fontSize: 15, lineHeight: 20 },
  cadreVideo: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  infos: { gap: espace[1] },
  lignePlaylist: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[3] },
  actionsVideo: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  mini: { width: 86, height: 50, borderWidth: bord.fin, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000' },
  miniImage: { width: '100%', height: '100%' },
});
