import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireConnectivite } from '@/services/connectivite';
import { demarrerOuReprendre, progression, repondre } from '@/services/certification/diagnostic';
import { obtenirReglages, type EtatDiagnostic } from '@/services/certification/etat';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { FeuilleQuitter } from './FeuilleQuitter';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur'; horsLigne: boolean } | { nom: 'question' };

/** A6 · Question du diagnostic : pas de correction, l'audio se joue une seule fois, « Passer » compte comme faux. */
export function Diagnostic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatDiagnostic | null>(null);
  const [choix, setChoix] = useState<number | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [delaiEchecS, setDelaiEchecS] = useState(20);
  const debut = useRef(Date.now());
  const occupe = useRef(false);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [p, r] = await Promise.all([lireProfil(), obtenirReglages().catch(() => null)]);
      if (r) setDelaiEchecS(r.audioEchecSecondes);
      const e = await demarrerOuReprendre(p?.exam ?? 'toeic');
      setEtat(e);
      setPhase({ nom: 'question' });
    } catch {
      const c = lireConnectivite();
      setPhase({ nom: 'erreur', horsLigne: !c.connecte || c.backend === false });
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Nouvelle question : sélection remise à zéro, chronomètre relancé.
  const index = etat?.index ?? 0;
  useEffect(() => {
    setChoix(null);
    debut.current = Date.now();
  }, [index]);

  const question = etat?.tentative?.questions[index] ?? null;
  const { faites, total } = etat ? progression(etat) : { faites: 0, total: 0 };

  const avancer = async (chosen: number | null) => {
    if (!etat || !question || occupe.current) return;
    occupe.current = true;
    try {
      const suivant = await repondre(etat, chosen, Date.now() - debut.current);
      suivre('cert_exercise_answered', { type: question.type, partie: question.part, juste: null });
      setEtat(suivant);
      if (suivant.termine) router.replace('/certification/fin');
    } finally {
      occupe.current = false;
    }
  };

  const sortir = () => {
    if (faites > 0) setQuitter(true);
    else router.back();
  };

  if (phase.nom !== 'question' || !etat || !question) {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.arrivee.entete')} onRetour={() => router.back()} />}>
        {phase.nom !== 'erreur' ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.diagnostic.chargement')}</Text>
        ) : (
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t(phase.horsLigne ? 'certification.diagnostic.horsLigneTitre' : 'certification.diagnostic.erreurTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t(phase.horsLigne ? 'certification.diagnostic.horsLigneTexte' : 'certification.diagnostic.erreurTexte')}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.diagnostic.erreurGardees')}</Text>
            <Bouton libelle={t('certification.reessayer')} onPress={charger} />
            <Bouton variante="texte" libelle={t('certification.diagnostic.sortir')} onPress={() => router.back()} />
          </View>
        )}
      </Ecran>
    );
  }

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.diagnostic.entete', { n: Math.min(faites + 1, total), total })} onRetour={sortir} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.diagnostic.valider')} desactive={choix === null} onPress={() => void avancer(choix)} retour />
          <Bouton variante="texte" libelle={t('certification.diagnostic.passer')} onPress={() => void avancer(null)} />
        </View>
      }
    >
      <BarreProgression pourcent={total ? (faites / total) * 100 : 0} libelle={t('certification.diagnostic.entete', { n: Math.min(faites + 1, total), total })} />
      <QuestionExercice
        key={question.id}
        question={question}
        choix={choix}
        onChoix={setChoix}
        unique
        delaiEchecS={delaiEchecS}
        ecran="diagnostic"
        onPasser={() => void avancer(null)}
      />
      <FeuilleQuitter ouverte={quitter} onReprendre={() => setQuitter(false)} onQuitter={() => (setQuitter(false), router.replace('/certification/arrivee'))} />
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] }, pied: { gap: espace[2] } });
