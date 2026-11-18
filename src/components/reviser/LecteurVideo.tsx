import { Image } from 'expo-image';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Check, Download, Lock, Trash2 } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { Banniere } from '@/components/Banniere';
import { PuceCout } from '@/components/credits/PuceCout';
import { useDepenseCredits } from '@/components/credits/useDepenseCredits';
import { useOuverts } from '@/components/credits/useOuverts';
import { Ecran } from '@/components/Ecran';
import { DEPASSEMENT_CENTRAL } from '@/components/Onglet';
import { Etiquette } from '@/components/Etiquette';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { peutVoir } from '@/services/credits';
import { lireEntrainement, lireProgresChapitres, type Compteur, type ProgresChapitre } from '@/services/entrainement';
import { enregistrerTempsActivite } from '@/services/activite';
import { suivre } from '@/services/analytics';
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
import { useSession, useSessionPrete } from '@/session/SessionProvider';
import { validerLeconsParVideo } from '@/services/progressionVideo';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { BarreVideo } from '@/components/video/BarreVideo';
import { FinVideo } from '@/components/video/FinVideo';

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
  const { session } = useSession();
  const idUtilisateur = session?.user?.id;
  const videosRef = useRef<VideoCours[] | null>(null);
  const idUtilisateurRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    idUtilisateurRef.current = idUtilisateur;
  }, [idUtilisateur]);
  const pleinEcranRef = useRef(false);
  const [videos, setVideos] = useState<VideoCours[] | null>(null);
  const [suivis, setSuivis] = useState<SuivisVideos>({});
  const [couranteId, setCouranteId] = useState<string | null>(video ?? null);
  const [entrainement, setEntrainement] = useState<(Compteur & { progres: ProgresChapitre }) | null>(null);
  const [telechargees, setTelechargees] = useState<Record<string, VideoTelechargee>>({});
  const [dlEnCours, setDlEnCours] = useState<string | null>(null);
  const [toutDl, setToutDl] = useState(false);
  const courante = videos?.find((v) => v.id === couranteId) ?? videos?.[0] ?? null;
  const restantes = videos ? videos.filter((v) => !telechargees[v.id]) : [];

  // Crédits (26/10/2026) : une vidéo verrouillée ne se lit ni ne se télécharge. L'accès se confirme
  // AVANT de charger la moindre source : déjà débloquée (le serveur compte aussi les vidéos regardées
  // avant l'arrivée des crédits), copie téléchargée sur l'appareil (elle n'existe que débloquée), pass
  // illimité, ou déblocage à l'instant par le parcours existant des contenus payants — la première vidéo
  // ouverte, tous cours confondus, est gratuite et se consomme ici, côté serveur, dès l'ouverture.
  const acces = useOuverts('course_video', videos?.map((v) => v.id) ?? []);
  const { lancer, feuilles } = useDepenseCredits();
  const [accesSession, setAccesSession] = useState<ReadonlySet<string>>(new Set());
  const [bloqueeId, setBloqueeId] = useState<string | null>(null);
  const accesSessionRef = useRef<Set<string>>(new Set());
  const tentativeRef = useRef<string | null>(null);
  const accesRef = useRef(acces);
  const lancerRef = useRef(lancer);
  useEffect(() => {
    accesRef.current = acces;
    lancerRef.current = lancer;
  });

  /** Demande l'accès à une vidéo (feuilles de coût / crédits épuisés comprises) ; vrai si elle peut se lire. */
  const demanderAcces = useCallback(async (v: VideoCours): Promise<boolean> => {
    if (videoLocale(v.id) || accesSessionRef.current.has(v.id)) return true;
    // Le serveur d'abord : déblocage existant, pass, ou vidéo déjà regardée (ancienneté) — aucun parcours.
    try {
      if (await peutVoir(getSupabase(), 'course_video', v.id)) {
        accesSessionRef.current.add(v.id);
        setAccesSession(new Set(accesSessionRef.current));
        return true;
      }
    } catch {
      // Sans réponse du serveur, le parcours de dépense tranchera (feuille « connexion » si besoin).
    }
    let r;
    try {
      r = await lancerRef.current('course_video', v.id, { deja: accesRef.current.sansFrais(v.id) });
    } catch {
      return false;
    }
    if (!r || r.statut === 'insufficient' || r.statut === 'limit') return false;
    accesSessionRef.current.add(v.id);
    setAccesSession(new Set(accesSessionRef.current));
    void accesRef.current.relire();
    return true;
  }, []);

  const rafraichirTelechargees = useCallback(() => {
    void lireTelechargees().then(setTelechargees).catch(() => undefined);
  }, []);

  // Téléchargement explicite d'une vidéo (lot 4) : le bouton de sa ligne de playlist la garde sur le
  // téléphone ; la même touche la supprime quand elle y est déjà. Une vidéo verrouillée ne se télécharge
  // pas : le bouton propose d'abord le déblocage (même parcours que la lecture), puis télécharge.
  const basculerTelechargement = useCallback(
    async (v: VideoCours) => {
      if (dlEnCours) return;
      if (videoLocale(v.id)) {
        await supprimerVideoTelechargee(v.id).catch(() => undefined);
        rafraichirTelechargees();
        return;
      }
      if (accesRef.current.etat(v.id) === 'payant' && !(await demanderAcces(v))) return;
      setDlEnCours(v.id);
      try {
        await telechargerVideo(v);
      } catch {
        // Échec (réseau, place) : la vidéo reste en ligne seulement, rien n'est inscrit.
      }
      setDlEnCours(null);
      rafraichirTelechargees();
    },
    [dlEnCours, rafraichirTelechargees, demanderAcces],
  );

  const toutTelecharger = useCallback(async () => {
    if (!videos || toutDl) return;
    setToutDl(true);
    // Les vidéos verrouillées sont ignorées : « Tout télécharger » ne débloque rien tout seul.
    await telechargerVideos(videos.filter((v) => !videoLocale(v.id) && accesRef.current.etat(v.id) !== 'payant')).catch(() => undefined);
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
  const [pleinEcran, setPleinEcran] = useState(false);
  const vueRef = useRef<VideoView | null>(null);
  /** Id de la partie dont la fin est affichée (écran de fin sur l'image) ; vide dès que la lecture reprend ou qu'on change de partie. */
  const [finId, setFinId] = useState<string | null>(null);
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
        if (isPlaying) setFinId(null);
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
        // En plein écran, les actions de fin (posées sur l'image) seraient cachées : on en sort pour les montrer.
        if (pleinEcranRef.current) {
          try {
            void vueRef.current?.exitFullscreen();
          } catch {
            // Sortie du plein écran impossible : sans effet.
          }
        }
        void marquerTerminee(v.id, v.cours, v.dureeS).then(() => {
          // Vidéo regardée jusqu'au bout : elle compte dans la progression des leçons du cours.
          if (videosRef.current) void validerLeconsParVideo(getSupabase(), v.cours, videosRef.current, idUtilisateurRef.current);
          setSuivis((avant) => ({
            ...avant,
            [v.id]: { positionS: v.dureeS ?? avant[v.id]?.positionS ?? 0, dureeS: v.dureeS, terminee: true, quand: Date.now(), cours: v.cours },
          }));
        });
        // Fin de partie : l'écran de fin propose le quiz, la partie suivante ou de revoir (aucun enchaînement automatique).
        setFinId(v.id);
        suivre('course_video_completed', { cours: String(coursId) });
      }),
    ];
    return () => {
      abonnements.forEach((a) => a.remove());
      p.release();
    };
  }, [lecteur, sauvegarder, fermerSegment, coursId]);

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
        videosRef.current = v;
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

  // Verrou crédits : à chaque nouvelle vidéo courante, l'accès est confirmé avant toute lecture (voir
  // demanderAcces). Un refus — feuille de coût fermée, crédits épuisés — laisse la vidéo bloquée : le
  // panneau de déblocage prend la place du lecteur et son bouton relance le parcours. Une seule
  // tentative automatique par vidéo et par passage sur l'écran.
  useEffect(() => {
    if (!courante) return;
    if (videoLocale(courante.id) || acces.ouverts.has(courante.id) || accesSession.has(courante.id)) return;
    if (tentativeRef.current === courante.id) return;
    tentativeRef.current = courante.id;
    const id = courante.id;
    // Le verdict s'applique même si l'effet a tourné entre-temps : pendant que la feuille attend la
    // réponse de l'élève, la relecture des déblocages (nouvel ensemble) relance cet effet — annuler le
    // verdict au nettoyage laisserait la vidéo en limbe, ni panneau ni lecture (vécu en capture réelle).
    // La tentative est unique par vidéo (tentativeRef), un verdict tardif reste donc le bon.
    void demanderAcces(courante).then((ok) => {
      if (!ok) setBloqueeId(id);
    });
  }, [courante, acces.ouverts, accesSession, demanderAcces]);

  const reessayerDeblocage = useCallback(async () => {
    const v = couranteRef.current;
    if (!v) return;
    tentativeRef.current = null;
    setBloqueeId(null);
    if (!(await demanderAcces(v))) {
      tentativeRef.current = v.id;
      setBloqueeId(v.id);
    }
  }, [demanderAcces]);

  // Changement de vidéo (playlist ou enchaînement) : on remplace la source, sans lecture automatique.
  // Une copie téléchargée (lot 4) est préférée au flux — décidée au moment du choix de la vidéo.
  useEffect(() => {
    if (!courante) return;
    // Verrou crédits : tant que l'accès n'est pas établi, aucune source n'est chargée — une vidéo
    // verrouillée ne se lit pas, même en connaissant son adresse.
    if (!videoLocale(courante.id) && !acces.ouverts.has(courante.id) && !accesSession.has(courante.id)) return;
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
  }, [courante, coursId, lecteur, viderTempsLu, acces.ouverts, accesSession]);

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
  const revoirPartie = useCallback(() => {
    const p = lecteurRef.current;
    p.currentTime = 0;
    setPositionAffichee(0);
    setFinId(null);
    suivre('course_video_replayed', { cours: String(coursId) });
    p.play();
  }, [coursId]);
  const terminees = videos ? videos.filter((v) => suivis[v.id]?.terminee).length : 0;
  // Bloquée = le parcours a refusé ET l'accès n'est toujours pas établi par ailleurs (déblocage appris
  // depuis, copie téléchargée entre-temps) : l'état posé par l'effet se relit donc toujours frais.
  const couranteBloquee =
    !!courante && bloqueeId === courante.id && !videoLocale(courante.id) && !acces.ouverts.has(courante.id) && !accesSession.has(courante.id);

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
      {feuilles}
      {videos !== null && videos.length === 0 ? <Banniere ton="erreur" titre={t('videos.erreur')} /> : null}
      {courante ? (
        <View style={styles.zoneHaute}>
          {/* Bloc lecteur resserré (retour de Benny, 26/10/2026) : vidéo, contrôles et barre forment un
              groupe à petits écarts, au lieu d'hériter du grand écart entre blocs de l'écran — les boutons
              flottaient loin sous la vidéo et la barre encore plus bas. Même resserrement pour toute la
              zone haute (titre, en-tête de playlist) : un seul groupe compact plutôt qu'une suite de
              blocs séparés par le grand écart de l'écran. */}
          {couranteBloquee ? (
            // Vidéo verrouillée (crédits) : pas de lecteur, la miniature voilée, la raison, le prix et
            // le bouton qui relance le parcours de déblocage existant.
            <View style={[styles.cadreVerrouille, { borderColor: theme.bord.fort }]}>
              {courante.miniature ? <Image source={{ uri: courante.miniature }} style={styles.fondVerrouille} contentFit="cover" /> : null}
              <View style={styles.voileVerrouille}>
                <View style={[styles.badgeVerrou, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                  <Lock size={22} strokeWidth={2.4} color={theme.texte.surCouleur} />
                </View>
                <Text style={[typo.texteFort, { color: '#FFF7E3' }]}>{t('videos.verrouillee')}</Text>
                <Text style={[typo.legende, styles.texteVerrouille, { color: '#FFF7E3' }]}>{t('videos.verrouilleeTexte')}</Text>
                <PuceCout cout={acces.cout} etat={acces.etat(courante.id)} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('videos.debloquer')}
                  onPress={() => void reessayerDeblocage()}
                  style={[styles.boutonDebloquer, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}
                >
                  <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t('videos.debloquer')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
          <View style={styles.blocLecteur}>
            <View style={[styles.cadreVideo, { borderColor: theme.bord.fort }]}>
              <View style={styles.video}>
                <Pressable accessible={false} onPress={basculerLecture} style={styles.media}>
                  <VideoView
                    ref={vueRef}
                    player={lecteur}
                    style={styles.media}
                    nativeControls={pleinEcran}
                    contentFit="contain"
                    fullscreenOptions={{ enable: true }}
                    onFullscreenEnter={() => { pleinEcranRef.current = true; setPleinEcran(true); }}
                    onFullscreenExit={() => { pleinEcranRef.current = false; setPleinEcran(false); }}
                    pointerEvents="none"
                  />
                </Pressable>
                {finId === courante.id ? (
                  <FinVideo
                    testID="lecteur-video-fin"
                    etiquette={t('videos.finPartie', { n: courante.numero })}
                    principal={entrainement ? { libelle: t('videos.finQuiz'), onPress: () => { suivre('course_video_end_quiz_clicked', { cours: String(coursId) }); router.push({ pathname: '/entrainement/chapitre', params: { cours: String(coursId), nom: nom ?? '', ...(matiere ? { matiere } : {}) } }); } } : undefined}
                    secondaire={suivante ? { libelle: t('videos.finSuivante'), onPress: () => { suivre('course_video_end_next_clicked', { cours: String(coursId) }); choisirVideo(suivante); } } : undefined}
                    revoir={{ libelle: t('videos.finRevoir'), onPress: revoirPartie }}
                  />
                ) : null}
              </View>
              {/* Barre unique, comme pour les vidéos TOEIC (retour de Benny, 17/11/2026) : précédent, lecture, suivant, progression, temps, plein écran. */}
              <BarreVideo
                position={positionAffichee}
                duree={dureeAffichee || courante.dureeS || 0}
                enLecture={enLectureAffichee}
                terminee={finId === courante.id}
                onBasculer={finId === courante.id ? revoirPartie : basculerLecture}
                onChercher={chercher}
                onPleinEcran={() => {
                  try {
                    void vueRef.current?.enterFullscreen();
                  } catch {
                    // Plein écran indisponible : sans effet.
                  }
                }}
                avecNavigation
                onPrecedente={precedente ? () => choisirVideo(precedente) : null}
                onSuivante={suivante ? () => choisirVideo(suivante) : null}
                libelles={{ lecture: t('videos.lecture'), pause: t('videos.pause'), revoir: t('videos.finRevoir'), pleinEcran: t('videos.pleinEcran'), progression: t('videos.positionLecture'), precedente: t('videos.precedente'), suivante: t('videos.suivante') }}
              />
            </View>
          </View>
          )}
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
                  const gardee = !!telechargees[v.id];
                  // Verrouillée (crédits) et pas de copie locale : cadenas, pas de téléchargement —
                  // toucher la ligne lance le parcours de déblocage via le changement de vidéo.
                  const verrou = acces.etat(v.id) === 'payant' && !gardee;
                  const sousTitre = verrou
                    ? t('videos.aDebloquer')
                    : enLecture
                      ? t('videos.enLecture', { position: formaterDuree(s?.positionS ?? 0), duree: formaterDuree(v.dureeS) })
                      : s?.terminee
                        ? t('videos.terminee')
                        : formaterDuree(v.dureeS) || t('videos.pasCommencee');
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
                          ) : verrou ? (
                            <View style={styles.badgeVerrouMini}>
                              <Lock size={13} strokeWidth={2.6} color="#FFF7E3" />
                            </View>
                          ) : null}
                        </View>
                      }
                      titre={v.titre}
                      sousTitre={gardee ? `${sousTitre} · ${t('videos.telechargee')}` : sousTitre}
                      droiteAction={
                        <View style={styles.actionsVideo}>
                          {verrou ? (
                            <Lock size={19} strokeWidth={2.2} color={theme.texte.secondaire} />
                          ) : dlEnCours === v.id ? (
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
                      droite={s?.terminee ? <Check size={20} strokeWidth={3} color={theme.marque.principale} /> : undefined}
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
  cadreVerrouille: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  fondVerrouille: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  voileVerrouille: { backgroundColor: 'rgba(10,10,10,0.78)', padding: espace[4], gap: espace[2], alignItems: 'center' },
  badgeVerrou: { width: 46, height: 46, borderRadius: 23, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texteVerrouille: { textAlign: 'center' },
  boutonDebloquer: { borderWidth: bord.normal, borderRadius: rayon.s, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  badgeVerrouMini: { position: 'absolute', left: '50%', top: '50%', marginLeft: -11, marginTop: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(10,10,10,0.72)', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  infos: { gap: espace[1] },
  lignePlaylist: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[3] },
  actionsVideo: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  mini: { width: 86, height: 50, borderWidth: bord.fin, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000' },
  miniImage: { width: '100%', height: '100%' },
});
