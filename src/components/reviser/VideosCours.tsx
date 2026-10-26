import { Image } from 'expo-image';
import { Check, Play } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { GroupeColle, LigneGroupe } from '../liste/ListeCollee';

type Traducteur = ReturnType<typeof useTraduction>['t'];

/** État d'une vidéo pour l'élève : terminée, en cours (commencée, pas finie) ou pas encore regardée. */
function etatDe(suivi?: SuiviVideo): 'terminee' | 'enCours' | 'neuve' {
  if (suivi?.terminee) return 'terminee';
  if (suivi && suivi.positionS > 0) return 'enCours';
  return 'neuve';
}

/** Sous-titre d'une ligne « autre partie » : l'état, puis la durée (maquette façon A). */
function sousTitreLigne(t: Traducteur, v: VideoCours, suivi: SuiviVideo | undefined, telechargee: boolean): string {
  const etat = etatDe(suivi);
  const base =
    etat === 'terminee'
      ? `✓ ${t('videos.terminee')}`
      : etat === 'enCours'
        ? t('videos.reprendreA', { temps: formaterDuree(suivi!.positionS) })
        : t('videos.pasCommencee');
  return [base, formaterDuree(v.dureeS), telechargee ? t('videos.telechargee') : null].filter(Boolean).join(' · ');
}

/**
 * D1e · Vidéos du cours (façon A validée par Benny le 26/10/2026, après l'abandon du carrousel testé trop
 * petit en réel) : en haut de la page du cours, seulement si le cours a au moins une vidéo prête — une
 * GRANDE CARTE pleine largeur pour la vidéo à reprendre (celle en cours de visionnage, sinon la Partie 1),
 * puis TOUTES les autres parties en liste collée à grandes miniatures, avec leur état. Toucher une vidéo
 * ouvre le lecteur à sa position.
 */
export function VideosCours({ cours, nom, matiere }: { cours: number; nom?: string; matiere?: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [videos, setVideos] = useState<VideoCours[] | null>(null);
  const [suivis, setSuivis] = useState<Record<string, SuiviVideo>>({});
  const [telechargees, setTelechargees] = useState<Record<string, VideoTelechargee>>({});
  const [avant, setAvant] = useState(0);

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
  const autres = videos.filter((v) => v.id !== vedette.id);
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

  const ouvrir = (v: VideoCours) =>
    router.push({ pathname: '/video', params: { cours: String(cours), video: v.id, nom: nom ?? '', matiere: matiere ?? '' } });

  return (
    <View>
      <Text style={[typo.etiquette, styles.etiquette, { color: theme.texte.secondaire }]}>{t('videos.etiquette', { n: terminees, total: videos.length })}</Text>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={`${t('videos.partie', { n: vedette.numero })}. ${vedette.titre}. ${sousTitreVedetteComplet}`}
        onPress={() => ouvrir(vedette)}
        rayon={rayon.m}
        ombre={ombre.carte}
        decalage={2}
        couleurOmbre={theme.ombre}
      >
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: etatVedette === 'enCours' ? theme.marque.principale : theme.bord.fort }, etatVedette === 'enCours' && styles.enCours]}>
          <View style={styles.visuel}>
            {vedette.miniature ? <Image source={{ uri: vedette.miniature }} style={styles.miniature} contentFit="cover" /> : <View style={[styles.miniature, { backgroundColor: theme.fond.creux }]} />}
            {etatVedette === 'terminee' ? (
              <View style={[styles.badge, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                <Check size={11} strokeWidth={3.5} color={theme.texte.surCouleur} />
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.vue')}</Text>
              </View>
            ) : etatVedette === 'enCours' ? (
              <View style={[styles.badge, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('videos.enCours')}</Text>
              </View>
            ) : null}
            <View style={[styles.boutonLecture, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              <Play size={21} strokeWidth={2.5} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
            </View>
            {vedette.dureeS ? (
              <View style={styles.duree}>
                <Text style={styles.dureeTexte}>{formaterDuree(vedette.dureeS)}</Text>
              </View>
            ) : null}
            {etatVedette === 'enCours' ? (
              <View style={styles.progressionFond}>
                <View style={[styles.progression, { width: `${Math.round(progression * 100)}%`, backgroundColor: theme.marque.principale }]} />
              </View>
            ) : null}
          </View>
          <View style={styles.texte}>
            <Text style={[typo.etiquette, { color: theme.marque.forte }]}>
              {etatVedette === 'enCours' ? `${t('videos.partie', { n: vedette.numero })} · ${t('videos.aReprendre')}` : t('videos.partie', { n: vedette.numero })}
            </Text>
            <Text numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{vedette.titre}</Text>
            <Text numberOfLines={1} style={[typo.legende, { color: etatVedette === 'enCours' ? theme.marque.forte : theme.texte.secondaire }, etatVedette === 'enCours' && styles.gras]}>
              {sousTitreVedetteComplet}
            </Text>
          </View>
        </View>
      </Appui>
      {autres.length ? (
        <GroupeColle style={styles.autres}>
          {autres.map((v, i) => (
            <LigneGroupe
              key={v.id}
              premier={i === 0}
              haut={<Text style={[typo.etiquette, { color: theme.marque.forte }]}>{t('videos.partie', { n: v.numero })}</Text>}
              gauche={
                <View style={[styles.mini, { borderColor: theme.bord.fort }]}>
                  {v.miniature ? <Image source={{ uri: v.miniature }} style={styles.miniImage} contentFit="cover" /> : null}
                  {v.dureeS ? (
                    <View style={styles.dureeMini}>
                      <Text style={styles.dureeMiniTexte}>{formaterDuree(v.dureeS)}</Text>
                    </View>
                  ) : null}
                </View>
              }
              titre={v.titre}
              sousTitre={sousTitreLigne(t, v, suivis[v.id], !!telechargees[v.id])}
              onPress={() => ouvrir(v)}
            />
          ))}
        </GroupeColle>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { marginBottom: espace[2] },
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: 'hidden' },
  enCours: { borderWidth: bord.epais },
  visuel: { width: '100%', aspectRatio: 16 / 9, position: 'relative', backgroundColor: '#000' },
  miniature: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: espace[2], top: espace[2], flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  boutonLecture: { position: 'absolute', left: '50%', top: '50%', marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: 25, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  duree: { position: 'absolute', right: espace[2], bottom: espace[2], backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  dureeTexte: { color: '#FFF7E3', fontSize: 11, fontWeight: '700' },
  progressionFond: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: 'rgba(10,10,10,0.45)' },
  progression: { height: '100%' },
  texte: { padding: espace[3], gap: espace[1] },
  titre: { fontSize: 15, lineHeight: 20 },
  gras: { fontWeight: '700' },
  autres: { marginTop: espace[4] },
  mini: { width: 118, height: 66, borderWidth: bord.fin, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  miniImage: { width: '100%', height: '100%' },
  dureeMini: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: rayon.pilule, paddingHorizontal: 5, paddingVertical: 1 },
  dureeMiniTexte: { color: '#FFF7E3', fontSize: 9.5, fontWeight: '700' },
});
