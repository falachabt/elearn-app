import { Image } from 'expo-image';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Check, Download, Pause, Play, SkipBack, SkipForward, Trash2 } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { Banniere } from '@/components/Banniere';
import { Ecran } from '@/components/Ecran';
import { DEPASSEMENT_CENTRAL } from '@/components/Onglet';
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
  // Intervalle d'1 s : les contrôles maison (point 4) affichent la position en continu ; la sauvegarde
  // de la position garde sa cadence (~4 s) via dernierEnregistrementRef.
  const [lecteur] = useState<VideoPlayer>(() => {
    const p = createVideoPlayer(null);
    p.timeUpdateEventInterval = 1;
    return p;
  });
  // Même lecteur, vu par une ref : les contrôles maison lui affectent currentTime (recherche), ce que
  // le lint interdit sur la valeur d'état elle-même (react-hooks/immutability).
  const lecteurRef = useRef(lecteur);
  // État affiché par les contrôles maison : position, durée et lecture en cours.
  const [positionAffichee, setPositionAffichee] = useState(0);
  const [dureeAffichee, setDureeAffichee] = useState(0);
  const [enLectureAffichee, setEnLectureAffichee] = useState(false);
  const dernierEnregistrementRef = useRef(0);
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
    // Avant la reprise effective (le lecteur n'est pas encore calé sur la position sauvegardée), ses
    // premiers événements annoncent 0 : les écrire écraserait la position à reprendre. On ne sauvegarde
    // un retour sous les 3 premières secondes que si rien de plus avancé n'est déjà connu.
    const avant = suivisRef.current[v.id];
    if (avant && avant.positionS > 3 && lecteur.currentTime < 3 && !avant.terminee) return;
    void noterPosition(v.id, v.cours, lecteur.currentTime, v.dureeS ?? (lecteur.duration || null)).then((s) => {
      setSuivis((apres) => ({ ...apres, [v.id]: s }));
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
        if (status !== 'readyToPlay' || !v) return;
        if (p.duration > 0) setDureeAffichee(p.duration);
        if (repriseFaite.current === v.id) return;
        repriseFaite.current = v.id;
        const position = suivisRef.current[v.id]?.positionS ?? 0;
        if (position > 3 && !suivisRef.current[v.id]?.terminee) p.currentTime = position;
      }),
      p.addListener('timeUpdate', ({ currentTime }) => {
        setPositionAffichee(currentTime);
        if (p.duration > 0) setDureeAffichee(p.duration);
        // Sauvegarde à cadence limitée : l'évènement arrive chaque seconde pour les contrôles,
        // l'enregistrement de la position garde son rythme d'avant (~toutes les 4 s, et à la pause).
        if (Date.now() - dernierEnregistrementRef.current >= 4000) {
          dernierEnregistrementRef.current = Date.now();
          sauvegarder();
        }
      }),
      p.addListener('playingChange', ({ isPlaying }) => {
        setEnLectureAffichee(isPlaying);
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
    // Les contrôles repartent de la position sauvegardée de la nouvelle vidéo (0 si elle est terminée).
    const s = suivisRef.current[courante.id];
    setPositionAffichee(s && !s.terminee ? s.positionS : 0);
    setDureeAffichee(courante.dureeS ?? 0);
    setEnLectureAffichee(false);
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

  // Retour : DÉPILER vers l'écran d'origine (page du cours, accueil « Reprendre », Mes vidéos), comme
  // LecteurPdf. L'ancien code faisait router.navigate vers le chapitre : chaque aller-retour EMPLILAIT
  // un écran de plus et le retour alternait chapitre ↔ lecteur en boucle (bug signalé par Benny le
  // 26/10/2026). Le replace vers le chapitre ne sert que de repli sans historique (lien direct).
  const retour = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: '/cours/chapitre', params: { id: String(coursId), nom: nom ?? '', matiere: matiere ?? '' } });

  // Sélection d'une partie (playlist, boutons précédent/suivant) : on enregistre d'abord la position
  // de la vidéo quittée, puis le changement de source fait le reste (effet sur `courante`).
  const choisirVideo = useCallback(
    (v: VideoCours) => {
      if (v.id === couranteRef.current?.id) return;
      sauvegarder();
      setCouranteId(v.id);
    },
    [sauvegarder],
  );
  const indiceCourante = videos ? videos.findIndex((v) => v.id === courante?.id) : -1;
  const precedente = indiceCourante > 0 ? videos![indiceCourante - 1] : null;
  const suivante = videos && indiceCourante >= 0 && indiceCourante < videos.length - 1 ? videos[indiceCourante + 1] : null;
  const basculerLecture = useCallback(() => {
    if (enLectureAffichee) lecteur.pause();
    else lecteur.play();
  }, [enLectureAffichee, lecteur]);
  const chercher = useCallback((secondes: number) => {
    const p = lecteurRef.current;
    const cible = Math.max(0, Math.min(secondes, p.duration || secondes));
    p.currentTime = cible;
    setPositionAffichee(cible);
  }, []);
  const terminees = videos ? videos.filter((v) => suivis[v.id]?.terminee).length : 0;

  return (
    <Ecran
      // Écran d'onglets : la barre gère le bas (insetBas faux comme les autres écrans du groupe).
      // Sans cela, Ecran ajoute l'inset système + espace[5] sous le pied : la carte « S'entraîner »
      // flottait avec un grand vide au-dessus de la barre. piedStyle la colle à la barre (voir le style).
      insetBas={false}
      piedStyle={styles.piedEntrainement}
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
            matiere={matiere}
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
        <View style={styles.zoneHaute}>
          {/* Bloc lecteur resserré (retour de Benny, 26/10/2026) : vidéo, contrôles et barre forment un
              groupe à petits écarts, au lieu d'hériter du grand écart entre blocs de l'écran — les boutons
              flottaient loin sous la vidéo et la barre encore plus bas. Même resserrement pour toute la
              zone haute (titre, en-tête de playlist) : un seul groupe compact plutôt qu'une suite de
              blocs séparés par le grand écart de l'écran. */}
          <View style={styles.blocLecteur}>
            <View style={[styles.cadreVideo, { borderColor: theme.bord.fort }]}>
              <VideoView player={lecteur} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
            </View>
            {/* Contrôles maison (retour de Benny, 26/10/2026) : le lecteur intégré ne permettait ni de
                déplacer le temps de lecture ni de passer à la partie suivante. Rangée en trois zones :
                temps à gauche, précédent / lecture-pause / suivant CENTRÉS, zone vide à droite qui
                équilibre la rangée. Barre déplaçable pleine largeur juste en dessous.
                En plein écran, les contrôles natifs de VideoView prennent le relais. */}
            <View style={styles.controles}>
              <View style={styles.zoneTemps}>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                  {formaterDuree(positionAffichee)} / {formaterDuree(dureeAffichee || courante.dureeS || 0)}
                </Text>
              </View>
              <View style={styles.zoneBoutons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('videos.precedente')}
                  accessibilityState={{ disabled: !precedente }}
                  disabled={!precedente}
                  hitSlop={6}
                  onPress={() => precedente && choisirVideo(precedente)}
                  style={[styles.boutonControle, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }, !precedente && styles.boutonDesactive]}
                >
                  <SkipBack size={20} strokeWidth={2.4} color={theme.texte.principal} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={enLectureAffichee ? t('videos.pause') : t('videos.lecture')}
                  hitSlop={6}
                  onPress={basculerLecture}
                  style={[styles.boutonLecture, { borderColor: theme.bord.fort, backgroundColor: theme.marque.principale }]}
                >
                  {enLectureAffichee ? (
                    <Pause size={22} strokeWidth={2.4} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
                  ) : (
                    <Play size={22} strokeWidth={2.4} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('videos.suivante')}
                  accessibilityState={{ disabled: !suivante }}
                  disabled={!suivante}
                  hitSlop={6}
                  onPress={() => suivante && choisirVideo(suivante)}
                  style={[styles.boutonControle, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }, !suivante && styles.boutonDesactive]}
                >
                  <SkipForward size={20} strokeWidth={2.4} color={theme.texte.principal} />
                </Pressable>
              </View>
              <View style={styles.zoneTemps} />
            </View>
            <BarreRecherche position={positionAffichee} duree={dureeAffichee || courante.dureeS || 0} onChercher={chercher} libelle={t('videos.positionLecture')} />
          </View>
          {/* Zone épurée (retour de Benny, 26/10/2026) : étiquette + titre suffisent — la ligne de
              description « matière · chapitre · téléchargée · reprendre à… » saturait l'écran alors que
              le header affiche déjà le chapitre et la barre montre la position de reprise. */}
          <View style={styles.infos}>
            <Etiquette texte={t('videos.partie', { n: courante.numero })} />
            <Text numberOfLines={2} style={[typo.h3, { color: theme.texte.principal }]}>{courante.titre}</Text>
          </View>
          {videos && videos.length >= 1 ? (
            <>
              <View style={styles.lignePlaylist}>
                <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>
                  {t('videos.playlist')} · {terminees}/{videos.length}
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
                          {/* État « Terminée » SUR la miniature (retour de Benny, 26/10/2026) : pastille
                              verte ✓ « Terminée » en coin + barre pleine en bas, au lieu du seul petit
                              texte sous le titre. */}
                          {s?.terminee ? (
                            <>
                              <View style={[styles.badgeTerminee, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                                <Check size={10} strokeWidth={3.5} color={theme.texte.surCouleur} />
                                <Text style={[styles.badgeTermineeTexte, { color: theme.texte.surCouleur }]}>{t('videos.badgeTerminee')}</Text>
                              </View>
                              <View style={[styles.barreTerminee, { backgroundColor: theme.marque.principale }]} />
                            </>
                          ) : null}
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
                      onPress={() => choisirVideo(v)}
                    />
                  );
                })}
              </GroupeColle>
            </>
          ) : null}
        </View>
      ) : null}
    </Ecran>
  );
}

/* eslint-disable react-hooks/refs -- le geste ne lit la ref que dans ses rappels, jamais pendant le rendu (même patron que certification/Curseur) */
/**
 * Barre de progression déplaçable des contrôles maison : appui ou glisser pour chercher dans la
 * vidéo — la recherche suit le doigt en direct (scrub), comme le Curseur de la certification.
 * Accessible : rôle « adjustable », les actions increment/decrement déplacent de 10 s.
 */
function BarreRecherche({ position, duree, onChercher, libelle }: { position: number; duree: number; onChercher: (secondes: number) => void; libelle: string }) {
  const { theme } = useTheme();
  const ref = useRef({ largeur: 0, duree, onChercher });
  useEffect(() => {
    ref.current = { largeur: ref.current.largeur, duree, onChercher };
  });

  const depuisX = (x: number) => {
    const { largeur: l, duree: d, onChercher: oc } = ref.current;
    if (l <= 0 || d <= 0) return;
    oc(Math.max(0, Math.min(1, x / l)) * d);
  };
  const geste = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => depuisX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => depuisX(e.nativeEvent.locationX),
      }),
    [],
  );

  const ratio = duree > 0 ? Math.max(0, Math.min(1, position / duree)) : 0;
  return (
    <View
      {...geste.panHandlers}
      onLayout={(e) => {
        ref.current.largeur = e.nativeEvent.layout.width;
      }}
      style={styles.barreZone}
      accessibilityRole="adjustable"
      accessibilityLabel={libelle}
      accessibilityValue={{ min: 0, max: Math.max(0, Math.round(duree)), now: Math.round(position) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChercher(position + 10);
        if (e.nativeEvent.actionName === 'decrement') onChercher(position - 10);
      }}
    >
      <View pointerEvents="none" style={[styles.barreFond, { backgroundColor: theme.fond.creux }]}>
        <View style={[styles.barrePlein, { width: `${Math.round(ratio * 100)}%`, backgroundColor: theme.marque.principale }]} />
      </View>
      <View pointerEvents="none" style={[styles.barrePouce, { left: `${Math.round(ratio * 100)}%`, backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]} />
    </View>
  );
}
/* eslint-enable react-hooks/refs */

const styles = StyleSheet.create({
  // Pied « limite collé » à la barre d'onglets (retour de Benny, 26/10/2026) : le conteneur d'onglets
  // réserve DEPASSEMENT_CENTRAL + espace[3] sous chaque écran pour le bouton central débordant — une
  // réserve pensée pour le contenu défilant, pas pour un pied fixe. La marge négative récupère cette
  // réserve (moins 4 px de filet) et le padding tombe à zéro : le bas de la carte arrive à 4 px de la barre.
  piedEntrainement: { paddingBottom: 0, marginBottom: -(DEPASSEMENT_CENTRAL + espace[3] - 4) },
  zoneHaute: { gap: espace[3] },
  blocLecteur: { gap: espace[3] },
  controles: { flexDirection: 'row', alignItems: 'center' },
  zoneTemps: { flex: 1 },
  zoneBoutons: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  boutonControle: { width: 40, height: 40, borderWidth: bord.normal, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  boutonLecture: { width: 46, height: 46, borderWidth: bord.normal, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  boutonDesactive: { opacity: 0.35 },
  barreZone: { height: 28, justifyContent: 'center' },
  barreFond: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barrePlein: { height: '100%' },
  barrePouce: { position: 'absolute', top: 6, width: 16, height: 16, borderRadius: 8, borderWidth: bord.fin, marginLeft: -8 },
  badgeTerminee: { position: 'absolute', left: 3, top: 3, flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: 5, paddingVertical: 0.5 },
  badgeTermineeTexte: { fontSize: 9, fontWeight: '700' },
  barreTerminee: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  titreEntete: { flex: 1, fontSize: 15, lineHeight: 20 },
  cadreVideo: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  infos: { gap: espace[1] },
  lignePlaylist: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[3] },
  actionsVideo: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  mini: { width: 86, height: 50, borderWidth: bord.fin, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000' },
  miniImage: { width: '100%', height: '100%' },
});
