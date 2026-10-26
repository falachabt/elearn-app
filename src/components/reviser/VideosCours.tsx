import { Image } from 'expo-image';
import { Check, Lock, Play } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PuceCout } from '@/components/credits/PuceCout';
import { useDepenseCredits } from '@/components/credits/useDepenseCredits';
import { useOuverts } from '@/components/credits/useOuverts';
import { useTraduction } from '@/i18n/useTraduction';
import { getSupabase } from '@/services/supabase';
import {
  compterTerminees,
  formaterDuree,
  indiceCarrousel,
  lireDerniereVideo,
  lireTelechargees,
  lireVideos,
  synchroniserSuivis,
  type SuiviVideo,
  type VideoCours,
  type VideoTelechargee,
} from '@/services/videos';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/** État d'une vidéo pour l'élève : terminée, en cours (commencée, pas finie) ou pas encore regardée. */
function etatDe(suivi?: SuiviVideo): 'terminee' | 'enCours' | 'neuve' {
  if (suivi?.terminee) return 'terminee';
  if (suivi && suivi.positionS > 0) return 'enCours';
  return 'neuve';
}

/**
 * D1e · Vidéos du cours : en haut de la page du cours, seulement si le cours a au moins une vidéo
 * prête — une GRANDE CARTE pleine largeur pour la vidéo à reprendre (celle en cours de visionnage,
 * sinon la Partie 1), puis juste en dessous une PLAYLIST HORIZONTALE DÉFILANTE DE MINIATURES SEULES
 * (maquette validée par Benny le 26/10/2026 à 07 h 27, fonction carteMiniStrip : vignettes 118×66
 * sans titres, badge « Pn », durée en coin, ✓ verte si terminée, barre de progression si en cours,
 * micro-légende d'état dessous). La liste collée verticale des autres parties et les grandes cartes
 * horizontales à titres ont été rejetées par Benny le matin même. Toucher une vignette ouvre le
 * lecteur sur cette partie.
 */
export function VideosCours({ cours, nom, matiere }: { cours: number; nom?: string; matiere?: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [videos, setVideos] = useState<VideoCours[] | null>(null);
  const [suivis, setSuivis] = useState<Record<string, SuiviVideo>>({});
  const [telechargees, setTelechargees] = useState<Record<string, VideoTelechargee>>({});
  const [avant, setAvant] = useState(0);
  // Crédits (26/10/2026) : quelles vidéos sont déjà débloquées, et le parcours de déblocage existant
  // (feuille de coût, crédits épuisés, recharge) pour celles qui ne le sont pas.
  const acces = useOuverts('course_video', videos?.map((v) => v.id) ?? []);
  const { lancer, feuilles } = useDepenseCredits();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void Promise.all([lireVideos(getSupabase(), cours).catch(() => [] as VideoCours[]), synchroniserSuivis(getSupabase()), lireDerniereVideo(), lireTelechargees().catch(() => ({}) as Record<string, VideoTelechargee>)])
        .then(([v, s, d, tel]) => {
          if (!actif) return;
          setVideos(v);
          setSuivis(s);
          setTelechargees(tel);
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
  const vedette = videos[Math.min(avant, videos.length - 1)];
  const suiviVedette = suivis[vedette.id];
  const etatVedette = etatDe(suiviVedette);
  const progression = suiviVedette?.dureeS ? Math.min(1, suiviVedette.positionS / suiviVedette.dureeS) : 0;
  const sousTitreVedette =
    etatVedette === 'enCours'
      ? `${t('videos.reprendreA', { temps: formaterDuree(suiviVedette!.positionS) })} · ${t('videos.reste', { temps: formaterDuree((suiviVedette!.dureeS ?? 0) - suiviVedette!.positionS) })}`
      : etatVedette === 'terminee'
        ? `✓ ${t('videos.terminee')}`
        : t('videos.pasCommencee');
  const sousTitreVedetteComplet = telechargees[vedette.id] ? `${sousTitreVedette} · ${t('videos.telechargee')}` : sousTitreVedette;

  const verrouillee = (v: VideoCours) => acces.etat(v.id) === 'payant' && !telechargees[v.id];

  const ouvrir = async (v: VideoCours) => {
    // Vidéo verrouillée : le parcours de déblocage des contenus payants d'abord (raison, prix, solde,
    // recharge si besoin) ; on n'ouvre le lecteur que si le déblocage aboutit.
    if (verrouillee(v)) {
      const r = await lancer('course_video', v.id);
      if (!r) return;
      void acces.relire();
    }
    router.push({ pathname: '/video', params: { cours: String(cours), video: v.id, nom: nom ?? '', matiere: matiere ?? '' } });
  };

  return (
    <View>
      {feuilles}
      <Text style={[typo.etiquette, styles.etiquette, { color: theme.texte.secondaire }]}>{t('videos.etiquette', { n: terminees, total: videos.length })}</Text>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={`${t('videos.partie', { n: vedette.numero })}. ${vedette.titre}. ${verrouillee(vedette) ? t('videos.aDebloquer') : sousTitreVedetteComplet}`}
        onPress={() => void ouvrir(vedette)}
        rayon={rayon.m}
        ombre={ombre.carte}
        decalage={2}
        couleurOmbre={theme.ombre}
      >
        {/* Bordure neutre standard, même pour la vidéo en cours (retour de Benny, 26/10/2026 : la
            grosse bordure verte « donnait trop de couleur à la page »). Le badge « EN COURS » et la
            ligne de reprise suffisent à distinguer la carte à reprendre. */}
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <View style={styles.visuel}>
            {vedette.miniature ? <Image source={{ uri: vedette.miniature }} style={styles.miniature} contentFit="cover" /> : <View style={[styles.miniature, { backgroundColor: theme.fond.creux }]} />}
            {etatVedette === 'terminee' ? (
              <View style={[styles.badge, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                <Check size={11} strokeWidth={3.5} color={theme.texte.surCouleur} />
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.badgeTerminee')}</Text>
              </View>
            ) : etatVedette === 'enCours' ? (
              <View style={[styles.badge, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.enCours')}</Text>
              </View>
            ) : null}
            <View style={[styles.boutonLecture, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              {verrouillee(vedette) ? (
                <Lock size={21} strokeWidth={2.5} color={theme.texte.surCouleur} />
              ) : (
                <Play size={21} strokeWidth={2.5} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
              )}
            </View>
            {vedette.dureeS ? (
              <View style={styles.duree}>
                <Text style={styles.dureeTexte}>{formaterDuree(vedette.dureeS)}</Text>
              </View>
            ) : null}
            {etatVedette !== 'neuve' ? (
              <View style={styles.progressionFond}>
                <View style={[styles.progression, { width: `${etatVedette === 'terminee' ? 100 : Math.round(progression * 100)}%`, backgroundColor: theme.marque.principale }]} />
              </View>
            ) : null}
          </View>
          <View style={styles.texte}>
            <View style={styles.lignePartie}>
              <Text style={[typo.etiquette, { color: theme.marque.forte }]}>
                {etatVedette === 'enCours' ? `${t('videos.partie', { n: vedette.numero })} · ${t('videos.aReprendre')}` : t('videos.partie', { n: vedette.numero })}
              </Text>
              {verrouillee(vedette) ? <PuceCout cout={acces.cout} etat="payant" /> : null}
            </View>
            <Text numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{vedette.titre}</Text>
            <Text numberOfLines={1} style={[typo.legende, { color: etatVedette === 'enCours' ? theme.marque.forte : theme.texte.secondaire }, etatVedette === 'enCours' && styles.gras]}>
              {sousTitreVedetteComplet}
            </Text>
          </View>
        </View>
      </Appui>
      {videos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bande} contentContainerStyle={styles.bandeContenu}>
          {videos.map((v) => {
            const s = suivis[v.id];
            const etat = etatDe(s);
            const pct = etat === 'enCours' && s?.dureeS ? Math.min(100, Math.round((s.positionS / s.dureeS) * 100)) : 0;
            const verrou = verrouillee(v);
            const legende = verrou ? t('videos.aDebloquer') : etat === 'enCours' ? t('videos.enCours') : etat === 'terminee' ? t('videos.badgeTerminee') : t('videos.partie', { n: v.numero });
            return (
              <Appui
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={`${t('videos.partie', { n: v.numero })}. ${v.titre}. ${legende}`}
                onPress={() => void ouvrir(v)}
                rayon={rayon.s}
                ombre={ombre.carte}
                decalage={2}
                couleurOmbre={theme.ombre}
              >
                <View style={styles.carteMini}>
                  <View style={[styles.vignette, { borderColor: theme.bord.fort }]}>
                    {v.miniature ? <Image source={{ uri: v.miniature }} style={styles.miniImage} contentFit="cover" /> : <View style={[styles.miniImage, { backgroundColor: theme.fond.creux }]} />}
                    <View style={styles.numMini}>
                      <Text style={styles.numMiniTexte}>P{v.numero}</Text>
                    </View>
                    {etat === 'terminee' ? (
                      <View style={[styles.vuMini, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                        <Check size={11} strokeWidth={3.5} color={theme.texte.surCouleur} />
                      </View>
                    ) : verrou ? (
                      <View style={[styles.vuMini, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                        <Lock size={11} strokeWidth={3} color={theme.texte.surCouleur} />
                      </View>
                    ) : null}
                    {v.dureeS ? (
                      <View style={styles.dureeMini}>
                        <Text style={styles.dureeMiniTexte}>{formaterDuree(v.dureeS)}</Text>
                      </View>
                    ) : null}
                    {etat === 'enCours' ? (
                      <View style={styles.progressionFondMini}>
                        <View style={[styles.progressionMini, { width: `${pct}%`, backgroundColor: theme.marque.principale }]} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.legendeMini, { color: etat === 'enCours' ? theme.marque.forte : theme.texte.secondaire }]}>{legende}</Text>
                </View>
              </Appui>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { marginBottom: espace[2] },
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  visuel: { width: '100%', aspectRatio: 16 / 9, position: 'relative', backgroundColor: '#000' },
  miniature: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: espace[2], top: espace[2], flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  boutonLecture: { position: 'absolute', left: '50%', top: '50%', marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: 25, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  duree: { position: 'absolute', right: espace[2], bottom: espace[2], backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  dureeTexte: { color: '#FFF7E3', fontSize: 11, fontWeight: '700' },
  progressionFond: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: 'rgba(10,10,10,0.45)' },
  progression: { height: '100%' },
  texte: { padding: espace[3], gap: espace[1] },
  lignePartie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[2] },
  titre: { fontSize: 15, lineHeight: 20 },
  gras: { fontWeight: '700' },
  // Bande horizontale de vignettes (maquette carteMiniStrip) : elle casse la marge horizontale de la
  // page pour défiler bord à bord, son contenu la réapplique en padding.
  bande: { marginHorizontal: -espace[6], marginTop: espace[3] },
  bandeContenu: { paddingHorizontal: espace[6], gap: espace[3], paddingVertical: espace[1] },
  carteMini: { width: 118 },
  vignette: { width: 118, height: 66, borderWidth: bord.normal, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  numMini: { position: 'absolute', left: 4, top: 4, backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: 6, paddingVertical: 1 },
  numMiniTexte: { color: '#FFF7E3', fontSize: 9.5, fontWeight: '700' },
  vuMini: { position: 'absolute', right: 4, top: 4, width: 19, height: 19, borderRadius: 10, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  progressionFondMini: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(10,10,10,0.45)' },
  progressionMini: { height: '100%' },
  legendeMini: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: espace[2], letterSpacing: 0.4, textTransform: 'uppercase' },
  miniImage: { width: '100%', height: '100%' },
  dureeMini: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: 5, paddingVertical: 1 },
  dureeMiniTexte: { color: '#FFF7E3', fontSize: 9.5, fontWeight: '700' },
});
