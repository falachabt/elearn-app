import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronDown, ChevronUp, Target } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { marquerEtapeFaite } from '@/services/certification/planFaites';
import { obtenirApi } from '@/services/certification/api';
import { ErreurContenuExpire } from '@/services/certification/copie';
import { etatContenu, quizLies } from '@/services/certification/etatsContenu';
import { jourDe } from '@/services/certification/jours';
import { titreAffiche } from '@/services/certification/titre';
import { chargerVideoNotion, type VideoNotion as VideoDeNotion } from '@/services/certification/videoNotion';
import { chargerFiche, chargerRevision, lireFiche, morceauxMisEnValeur } from '@/services/certification/revision';
import { lireProfil } from '@/services/profil';
import type { NotionFiche, NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige as corrigeCouleurs, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { PuceEtatContenu } from './PuceEtatContenu';
import { VideoNotion } from './VideoNotion';
import { EnteteToeic, EtiquetteSection, LigneChoix, ListeChoix, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'expire' } | { nom: 'ok'; fiche: NotionFiche };

/** C5 · Fiche d'une notion : règle, exemples, piège, faux ami, trois questions d'ancrage, entraînement. */
export function FicheNotion() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const jaune = sombre ? corrigeCouleurs.dark : corrigeCouleurs.light;
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  /** État de maîtrise de la notion (liste des notions) : absent si la liste n'est pas lisible, la fiche s'affiche sans badge. */
  const [suivi, setSuivi] = useState<NotionListee | null>(null);
  /** Vidéo explicative (maquette C5v) : absente ou hors ligne, la fiche s'affiche dépliée comme avant. */
  const [video, setVideo] = useState<VideoDeNotion | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState(false);
  /** Vrai quand la recherche de la vidéo est terminée (trouvée ou non) : avant, on ne sait pas encore s'il faut attendre la fin de la vidéo. */
  const [videoCherchee, setVideoCherchee] = useState(false);

  const charger = useCallback(() => {
    setPhase({ nom: 'chargement' });
    chargerFiche(id)
      .then(({ valeur }) => {
        setPhase({ nom: 'ok', fiche: valeur });
        suivre('cert_notion_opened', { notion: valeur.code, source: source ?? 'liste' });
        void obtenirApi().ouvrirNotion(id, 0, jourDe(new Date())).catch(() => undefined);
        // L'étape du plan n'est PAS cochée à l'ouverture : voir plus bas (fin de la vidéo, ou fiche sans vidéo).
      })
      .catch((e: unknown) => setPhase(e instanceof ErreurContenuExpire ? { nom: 'expire' } : { nom: 'erreur' }));
  }, [id, source]);

  useEffect(() => {
    let actif = true;
    void (async () => {
      try {
        const p = await lireProfil();
        const r = await chargerRevision(p?.exam ?? 'toeic', jourDe(new Date()));
        if (actif) setSuivi(r.valeur.notions.find((n) => n.id === id) ?? null);
      } catch {
        if (actif) setSuivi(null);
      }
    })();
    return () => {
      actif = false;
    };
  }, [id]);

  const codeNotion = phase.nom === 'ok' ? phase.fiche.code : null;
  useEffect(() => {
    if (!codeNotion) return;
    let actif = true;
    void chargerVideoNotion(codeNotion).then((v) => {
      if (!actif) return;
      setVideo(v);
      setVideoCherchee(true);
    });
    return () => {
      actif = false;
    };
  }, [codeNotion]);

  // Bug du 17 novembre (Benny) : l'étape était cochée dès l'ouverture de la fiche, sans regarder la vidéo. Une notion avec vidéo
  // n'est faite qu'à la fin réelle de la vidéo (onTerminee) ; sans vidéo, la fiche lue (ouverte) suffit, comme avant.
  useEffect(() => {
    if (codeNotion && videoCherchee && !video) void marquerEtapeFaite(`fiche:${id}`);
  }, [codeNotion, videoCherchee, video, id]);

  useEffect(() => {
    // Chargement initial de la fiche (copie locale puis serveur) : l'état de chargement est posé par `charger` lui-même.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  // Temps de lecture : envoyé en quittant l'écran, jamais bloquant (F11).
  useFocusEffect(
    useCallback(() => {
      const arrivee = Date.now();
      return () => {
        const secondes = Math.round((Date.now() - arrivee) / 1000);
        if (secondes > 0) void obtenirApi().ouvrirNotion(id, secondes, jourDe(new Date())).catch(() => undefined);
      };
    }, [id]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser' as never));
  const titre = phase.nom === 'ok' ? titreAffiche(phase.fiche.titre) : t('certification.cours.entete');

  return (
    <Ecran piedBordure
      insetBas={false}
      entete={<EnteteToeic titre={titre} onRetour={retour} />}
      pied={phase.nom === 'ok' ? <Bouton libelle={t('certification.fiche.entrainer')} onPress={() => router.push({ pathname: '/certification/serie', params: { notion: phase.fiche.id } } as never)} retour /> : undefined}
    >
      {phase.nom === 'chargement' ? <Squelette lignes={4} /> : null}
      {phase.nom === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.fiche.erreurTitre')} texte={t('certification.fiche.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={charger} />
        </View>
      ) : null}
      {phase.nom === 'expire' ? (
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.fiche.expireTitre')} texte={`${t('certification.fiche.expireTexte')}. ${t('certification.fiche.expireAide')}`} />
          <Bouton libelle={t('certification.fiche.actualiser')} onPress={charger} />
        </View>
      ) : null}
      {phase.nom === 'ok' ? (() => {
        const f = lireFiche(phase.fiche.markdown);
        const texteVisible = !video || ficheOuverte;
        const carteEtat = suivi ? (
          <Carte>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
            <PuceEtatContenu etat={etatContenu(suivi)} />
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t(`certification.fiche.etatAide.${etatContenu(suivi)}`)}</Text>
          </Carte>
        ) : null;
        const vide = !f.regle && f.exemples.length === 0 && !f.piege && !f.fauxAmi;
        return (
          <View style={video ? styles.groupeVideo : styles.groupe}>
            {video ? (
              <>
                <VideoNotion
                  video={video}
                  titre={titre}
                  onLancee={() => suivre('cert_video_started', { notion: phase.fiche.code })}
                  onTerminee={() => {
                    suivre('cert_video_completed', { notion: phase.fiche.code });
                    void marquerEtapeFaite(`fiche:${id}`);
                  }}
                  onEntrainer={() => {
                    suivre('cert_video_practice_clicked', { notion: phase.fiche.code });
                    router.push({ pathname: '/certification/serie', params: { notion: phase.fiche.id } } as never);
                  }}
                  onRevoir={() => suivre('cert_video_replayed', { notion: phase.fiche.code })}
                />
                {suivi ? carteEtat : null}
                <View style={styles.ficheLigne}><LigneChoix
                  icone={BookOpen}
                  titre={ficheOuverte ? t('certification.fiche.video.masquerFiche') : t('certification.fiche.video.lireFiche')}
                  aide={t('certification.fiche.video.ficheAide')}
                  droite={ficheOuverte ? <ChevronUp size={20} color={theme.texte.principal} strokeWidth={2} /> : <ChevronDown size={20} color={theme.texte.principal} strokeWidth={2} />}
                  onPress={() => {
                    suivre('cert_notion_sheet_toggled', { notion: phase.fiche.code, ouverte: !ficheOuverte });
                    setFicheOuverte(!ficheOuverte);
                  }}
                /></View>
              </>
            ) : null}
            {!video && suivi ? carteEtat : null}
            {texteVisible ? <>
            {vide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.fiche.sansTexte')}</Text> : null}
            {f.regle ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.regle')} />
                <Carte><Text style={[typo.texte, { color: theme.texte.principal }]}>{f.regle}</Text></Carte>
              </View>
            ) : null}
            {f.exemples.length ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.exemples')} />
                {f.exemples.map((ex, i) => (
                  <Carte key={i}>
                    <Text style={[typo.texte, { color: theme.texte.principal }]}>
                      {morceauxMisEnValeur(ex.en).map((m, j) => (
                        <Text key={j} style={m.fort ? typo.texteFort : undefined}>{m.texte}</Text>
                      ))}
                    </Text>
                    {ex.fr ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{ex.fr}</Text> : null}
                  </Carte>
                ))}
              </View>
            ) : null}
            {f.piege ? (
              // Maquette C5 : carte jaune « Piège TOEIC », le titre dans la carte (texte noir sur surface colorée).
              <Carte testID="fiche-piege" style={{ backgroundColor: jaune.fond, gap: espace[1] }}>
                <Text accessibilityRole="header" style={[typo.texteFort, { color: jaune.texte }]}>{t('certification.fiche.piege')}</Text>
                <Text style={[typo.texte, { color: jaune.texte }]}>{f.piege}</Text>
              </Carte>
            ) : null}
            {f.fauxAmi ? (
              <View testID="fiche-faux-ami" style={[styles.pastille, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.donnee, { color: theme.texte.principal }]}>{t('certification.fiche.fauxAmi', { texte: f.fauxAmi })}</Text>
              </View>
            ) : null}
            {phase.fiche.ancrages.length ? (
              <View style={styles.groupe}>
                {/* Maquette C5 : « 3 questions d'ancrage », une ligne « Question n · 3 minutes » par question servie. */}
                <EtiquetteSection texte={t('certification.fiche.ancrage', { n: phase.fiche.ancrages.length })} />
                {suivi && quizLies(suivi) ? (
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.fiche.quizLiesBilan', { r: quizLies(suivi)!.reussis, n: quizLies(suivi)!.total })}</Text>
                ) : null}
                <ListeChoix>
                {phase.fiche.ancrages.map((_, i) => (
                  <LigneChoix
                    key={i}
                    icone={Target}
                    titre={phase.fiche.dureeMin ? t('certification.fiche.ancrageLigne', { n: i + 1, minutes: phase.fiche.dureeMin }) : t('certification.fiche.ancrageLigneSans', { n: i + 1 })}
                    onPress={() => router.push({ pathname: '/certification/serie', params: { notion: phase.fiche.id, ancrage: '1' } } as never)}
                  />
                ))}
                </ListeChoix>
              </View>
            ) : null}
            </> : null}
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  groupeVideo: { gap: espace[6] },
  ficheLigne: { marginTop: -espace[2] },
  pastille: { alignSelf: 'flex-start', maxWidth: '100%', borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: espace[1] },
});
