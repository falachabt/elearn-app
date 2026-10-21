import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { etatInitial, formaterTemps, reduireLecteur } from '@/services/certification/lecteur';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { BarreProgression } from './ui';

type Props = {
  /** Adresse du média ; `null` = indisponible (pas d'hôte configuré ou piste absente). */
  uri: string | null;
  libelle: string;
  /** Écoute unique : diagnostic et mode examen. */
  unique?: boolean;
  /** Délai avant de déclarer le son indisponible (`mock_audio_fail_s`). */
  delaiEchecS: number;
  ecran: string;
  onPasser: () => void;
  onFin?: () => void;
};

/** B8 · Lecteur audio : lecture, pause, état « audio indisponible » (le texte reste lisible, on peut passer). */
export function LecteurAudio({ uri, libelle, unique, delaiEchecS, ecran, onPasser, onFin }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, envoyer] = useReducer((e: typeof etatInitial, ev: Parameters<typeof reduireLecteur>[1]) => reduireLecteur(e, ev, !!unique), etatInitial);
  const lecteur = useRef<AudioPlayer | null>(null);
  const delai = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finRef = useRef(onFin);
  useEffect(() => {
    finRef.current = onFin;
  });

  const liberer = useCallback(() => {
    if (delai.current) clearTimeout(delai.current);
    delai.current = null;
    try {
      lecteur.current?.remove();
    } catch {
      // déjà libéré
    }
    lecteur.current = null;
  }, []);

  // Changement de piste : l'ancienne s'arrête et l'état repart de zéro, un seul son à la fois.
  useEffect(() => {
    envoyer({ type: 'reinitialiser' });
    return liberer;
  }, [liberer, uri]);

  const demarrer = (depuis: number) => {
    if (!uri) {
      envoyer({ type: 'erreur' });
      suivre('cert_audio_error', { ecran, code: 'absent' });
      return;
    }
    liberer();
    envoyer({ type: 'jouer' });
    // Une épreuve écoutée doit sortir même téléphone en silencieux. Le mode est réglé ici, à chaque lecture,
    // car un autre écran (sons de retour, retours.ts) peut l'avoir changé entre-temps.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: false }).catch(() => {});
    try {
      const p = createAudioPlayer({ uri }, { updateInterval: 250 });
      lecteur.current = p;
      p.addListener('playbackStatusUpdate', (s) => {
        // Un évènement d'une piste déjà remplacée ne doit pas toucher l'écran courant.
        if (lecteur.current !== p) return;
        // Le délai d'échec ne s'arrête qu'à la première position réellement lue : un fichier chargé
        // mais figé à 0:00 doit finir en « audio indisponible », pas en lecture muette sans fin.
        if (s.isLoaded && s.currentTime > 0 && delai.current) {
          clearTimeout(delai.current);
          delai.current = null;
        }
        envoyer({ type: 'statut', chargee: s.isLoaded, enLecture: s.playing, position: s.currentTime, duree: s.duration, termine: !!s.didJustFinish });
        if (s.didJustFinish) finRef.current?.();
      });
      if (depuis > 1) void p.seekTo(depuis);
      p.play();
      delai.current = setTimeout(() => {
        envoyer({ type: 'erreur' });
        suivre('cert_audio_error', { ecran, code: 'delai' });
      }, delaiEchecS * 1000);
    } catch {
      envoyer({ type: 'erreur' });
      suivre('cert_audio_error', { ecran, code: 'lecture' });
    }
  };

  // Pas de piste (question sans audio en base) : « audio indisponible » tout de suite, sans rien jouer.
  if (etat.phase === 'erreur' || !uri) {
    return (
      <View accessibilityRole="alert" style={[styles.carte, { backgroundColor: theme.etat.erreurDoux, borderColor: theme.bord.fort }]}>
        <View style={styles.centre}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.exercice.audioKoTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.exercice.audioKoTexte')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.exercice.audioKoAide')}</Text>
          {uri ? <Bouton petit variante="secondaire" libelle={t('certification.exercice.audioKoReessayer')} onPress={() => demarrer(etat.position)} /> : null}
          <Bouton petit variante="texte" libelle={t('certification.exercice.audioKoPasser')} onPress={onPasser} />
        </View>
      </View>
    );
  }

  const enLecture = etat.phase === 'lecture' || etat.phase === 'chargement';
  const bloque = !!unique && etat.jouee;
  const action = () => {
    if (enLecture) {
      lecteur.current?.pause();
      if (delai.current) clearTimeout(delai.current);
      delai.current = null;
      envoyer({ type: 'pause' });
    } else if (etat.phase === 'pause' && lecteur.current) {
      lecteur.current.play();
      envoyer({ type: 'jouer' });
    } else {
      demarrer(0);
    }
  };
  const Icone = enLecture ? Pause : Play;
  // Écoute déjà faite : en entraînement, le bouton propose de réécouter (le mode examen reste à écoute unique).
  const reecoute = !enLecture && !unique && etat.jouee;
  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={enLecture ? t('certification.exercice.pause') : reecoute ? t('certification.exercice.reecouter') : t('certification.exercice.ecouter')}
        accessibilityState={{ disabled: bloque }}
        disabled={bloque}
        onPress={action}
        decalage={2}
        rayon={rayon.pilule}
        retour
      >
        <View style={[styles.bouton, { backgroundColor: bloque ? theme.fond.creux : theme.marque.principale, borderColor: theme.bord.fort }]}>
          <Icone size={22} color={theme.texte.surCouleur} strokeWidth={2} />
        </View>
      </Appui>
      <View style={styles.centre}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{enLecture ? t('certification.exercice.enCours') : reecoute ? t('certification.exercice.reecouter') : libelle}</Text>
        <BarreProgression pourcent={etat.duree > 0 ? (etat.position / etat.duree) * 100 : etat.phase === 'fini' ? 100 : 0} hauteur={8} libelle={libelle} />
        {bloque ? (
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{unique ? t('certification.exercice.ecouteExamen') : t('certification.exercice.ecouteJouee')}</Text>
        ) : etat.duree > 0 ? (
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{`${formaterTemps(etat.position)} / ${formaterTemps(etat.duree)}`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  bouton: { width: cibleMin, height: cibleMin, borderRadius: cibleMin / 2, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  centre: { flex: 1, gap: espace[2] },
});
