import { router } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { chronometre } from '@/services/certification/format';
import { cloreParTemps, lireMini, repondreMini, tempsRestantMs, type EtatMini } from '@/services/certification/miniTest';
import { ForcerSombre, useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'absent' } | { nom: 'examen'; etat: EtatMini };

/**
 * Écran d'examen d'un mini-test : sombre dans les deux thèmes, audio joué une seule fois, aucune correction avant la fin,
 * chronomètre sur horodatage absolu (l'app en arrière-plan ne le fige pas). Fin à la dernière réponse ou au temps écoulé.
 */
export function MiniTest() {
  return (
    <ForcerSombre>
      <Examen />
    </ForcerSombre>
  );
}

function Examen() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [choix, setChoix] = useState<number | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [delaiEchecS, setDelaiEchecS] = useState(20);
  const debut = useRef(0);
  const occupe = useRef(false);
  const clos = useRef(false);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const [etat, r] = await Promise.all([lireMini(), obtenirReglages().catch(() => null)]);
      if (!actif) return;
      if (r) setDelaiEchecS(r.audioEchecSecondes);
      if (!etat || etat.fin || etat.termine) setPhase({ nom: 'absent' });
      else setPhase({ nom: 'examen', etat });
    })();
    return () => {
      actif = false;
    };
  }, []);

  const etat = phase.nom === 'examen' ? phase.etat : null;
  const index = etat?.index ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoix(null);
    debut.current = Date.now();
  }, [index]);

  // Une seconde d'horloge : le temps restant est toujours recalculé depuis l'horodatage de départ.
  useEffect(() => {
    if (!etat) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [etat]);

  const aLaFin = useCallback(() => router.replace('/certification/mini-bilan' as never), []);

  const reste = etat ? tempsRestantMs(etat, maintenant) : 1;
  useEffect(() => {
    if (!etat || reste > 0 || clos.current) return;
    clos.current = true;
    void cloreParTemps(etat).then(aLaFin);
  }, [etat, reste, aLaFin]);

  const avancer = async (chosen: number | null) => {
    if (!etat || occupe.current || clos.current) return;
    occupe.current = true;
    try {
      const question = etat.tentative.questions[etat.index];
      const suivant = await repondreMini(etat, chosen, Date.now() - debut.current);
      if (question) suivre('cert_exercise_answered', { type: question.type, partie: question.part, juste: null });
      if (suivant.termine) {
        clos.current = true;
        aLaFin();
      } else setPhase({ nom: 'examen', etat: suivant });
    } finally {
      occupe.current = false;
    }
  };

  if (phase.nom === 'chargement') {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.mini.entete')} />}>
        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.examen.chargement')}</Text>
      </Ecran>
    );
  }
  if (phase.nom === 'absent' || !etat) {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.mini.entete')} onRetour={() => router.replace('/tests' as never)} />}>
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.examen.erreurTitre')} texte={t('certification.examen.erreurTexte')} />
          <Bouton libelle={t('certification.examen.retour')} onPress={() => router.replace('/tests' as never)} />
        </View>
      </Ecran>
    );
  }

  const question = etat.tentative.questions[etat.index];
  const total = etat.tentative.questions.length;
  const derniere = etat.index >= total - 1;
  const titre = t('certification.examen.entete', { n: Math.min(etat.index + 1, total), total });
  const horloge = chronometre(reste);

  return (
    <Ecran
      entete={
        <EnteteToeic
          titre={titre}
          onRetour={() => setQuitter(true)}
          droite={
            <View accessibilityRole="timer" accessibilityLabel={t('certification.examen.chrono', { temps: horloge })} style={styles.chrono}>
              <Clock size={18} color={reste < 60_000 ? theme.etat.erreur : theme.texte.principal} strokeWidth={2} />
              <Text style={[typo.donnee, { color: reste < 60_000 ? theme.etat.erreur : theme.texte.principal }]}>{horloge}</Text>
            </View>
          }
        />
      }
      pied={
        <View style={styles.pied}>
          <Bouton libelle={derniere ? t('certification.examen.derniere') : t('certification.examen.suivante')} desactive={choix === null} onPress={() => void avancer(choix)} retour />
          <Bouton variante="texte" libelle={t('certification.examen.passer')} onPress={() => void avancer(null)} />
        </View>
      }
    >
      <BarreProgression pourcent={total ? (etat.index / total) * 100 : 0} libelle={titre} />
      {question ? (
        <QuestionExercice key={question.id} question={question} choix={choix} onChoix={setChoix} unique delaiEchecS={delaiEchecS} ecran="mini_test" position={etat.index + 1} onPasser={() => void avancer(null)} />
      ) : null}
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.examen.sansCorrection')}</Text>
      <Feuille
        ouverte={quitter}
        onFermer={() => setQuitter(false)}
        titre={t('certification.examen.quitterTitre')}
        texte={t('certification.examen.quitterTexte')}
        actions={[
          { libelle: t('certification.examen.rester'), onPress: () => setQuitter(false) },
          { libelle: t('certification.examen.quitter'), onPress: () => (setQuitter(false), router.replace('/tests' as never)), variante: 'texte' },
        ]}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  pied: { gap: espace[2] },
  chrono: { flexDirection: 'row', alignItems: 'center', gap: espace[1] },
});
