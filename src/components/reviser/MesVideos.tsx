import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { Banniere } from '@/components/Banniere';
import { Ecran } from '@/components/Ecran';
import { Etiquette } from '@/components/Etiquette';
import { BoutonFermer } from '@/components/arrivee/MiniTest';
import { lireProfil } from '@/services/profil';
import { lireCours, nomCourt, programmeDu, type Cours } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { formaterDuree, lireVideos, synchroniserSuivis, type SuiviVideo, type VideoCours } from '@/services/videos';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, rayon, typo } from '@/theme/theme';

import { GroupeColle, LigneGroupe } from './BlocEntrainement';

type Entree = { video: VideoCours; suivi: SuiviVideo; matiere: string; chapitre: string };

/**
 * « Mes vidéos » (lot 2) : l'historique de visionnage de l'élève, branché sur le suivi synchronisé —
 * les vidéos en cours (à reprendre où il s'était arrêté) puis les terminées, des plus récentes aux plus
 * anciennes. Entrée depuis l'écran Progression.
 */
export function MesVideos() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [entrees, setEntrees] = useState<Entree[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      void (async () => {
        const client = getSupabase();
        const [suivis, cours] = await Promise.all([
          synchroniserSuivis(client),
          lireCours(client, programmeDu(await lireProfil())).catch((): Cours[] => []),
        ]);
        const parCours = new Map<number, { matiere: string; chapitre: string }>();
        for (const c of cours) parCours.set(c.id, { matiere: nomCourt(c.matiere), chapitre: c.nom });
        const idsCours = [...new Set(Object.values(suivis).filter((s) => s.cours > 0 && (s.positionS > 0 || s.terminee)).map((s) => s.cours))];
        const listes = await Promise.all(idsCours.map((id) => lireVideos(client, id).catch((): VideoCours[] => [])));
        if (!actif) return;
        const parVideo = new Map<string, VideoCours>();
        for (const liste of listes) for (const v of liste) parVideo.set(v.id, v);
        const sortie: Entree[] = [];
        for (const [id, suivi] of Object.entries(suivis)) {
          const video = parVideo.get(id);
          if (!video || (suivi.positionS <= 0 && !suivi.terminee)) continue;
          const contexte = parCours.get(video.cours);
          sortie.push({ video, suivi, matiere: contexte?.matiere ?? '', chapitre: contexte?.chapitre ?? '' });
        }
        sortie.sort((a, b) => b.suivi.quand - a.suivi.quand);
        setEntrees(sortie);
      })().catch(() => actif && setEntrees([]));
      return () => {
        actif = false;
      };
    }, [pret]),
  );

  const enCours = entrees?.filter((e) => !e.suivi.terminee) ?? [];
  const terminees = entrees?.filter((e) => e.suivi.terminee) ?? [];

  const section = (titre: string, liste: Entree[]) =>
    liste.length ? (
      <>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{titre}</Text>
        <GroupeColle>
          {liste.map((e, i) => (
            <LigneGroupe
              key={e.video.id}
              premier={i === 0}
              haut={<Etiquette texte={t('videos.partie', { n: e.video.numero })} />}
              gauche={
                <View style={[styles.mini, { borderColor: theme.bord.fort }]}>
                  {e.video.miniature ? <Image source={{ uri: e.video.miniature }} style={styles.miniImage} contentFit="cover" /> : null}
                </View>
              }
              titre={e.video.titre}
              sousTitre={
                e.suivi.terminee
                  ? [e.chapitre, t('videos.terminee')].filter(Boolean).join(' · ')
                  : [e.chapitre, t('videos.reprendreA', { temps: formaterDuree(e.suivi.positionS) })].filter(Boolean).join(' · ')
              }
              droite={e.suivi.terminee ? <Check size={20} strokeWidth={3} color={theme.marque.principale} /> : undefined}
              onPress={() =>
                router.push({ pathname: '/video', params: { cours: String(e.video.cours), video: e.video.id, nom: e.chapitre, matiere: e.matiere } })
              }
            />
          ))}
        </GroupeColle>
      </>
    ) : null;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('videos.retourCours')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/progression'))} />
          <Text accessibilityRole="header" style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{t('videos.mesVideos')}</Text>
        </>
      }
    >
      {entrees !== null && entrees.length === 0 ? <Banniere ton="info" titre={t('videos.mesVideosVide')} /> : null}
      {section(t('videos.enCoursSection'), enCours)}
      {section(t('videos.termineesSection'), terminees)}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { flex: 1, fontSize: 15, lineHeight: 20 },
  mini: { width: 86, height: 50, borderWidth: bord.fin, borderRadius: rayon.s, overflow: 'hidden', backgroundColor: '#000' },
  miniImage: { width: '100%', height: '100%' },
});
