import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import {
  ajouterMotCarnet,
  avancer,
  envoyerEnAttente,
  questionCourante,
  questionRepondue,
  repondreSerie,
  reprendreOuDemarrer,
  resultatCourant,
  type EtatSerie,
} from '@/services/certification/serie';
import type { MotCle } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { ExplicationCert } from './ExplicationCert';
import { FeuilleQuitter } from './FeuilleQuitter';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'question' };

/** B1 à B7 · Série d'entraînement : choisir, valider, corrigé (B9), question suivante, fin (B11). */
export function Serie() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ part?: string; notion?: string }>();
  const part = params.part ? Number(params.part) : undefined;
  const notion = params.notion || undefined;
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatSerie | null>(null);
  const [choix, setChoix] = useState<number | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [delaiEchecS, setDelaiEchecS] = useState(20);
  const debut = useRef(0);
  const occupe = useRef(false);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [p, r] = await Promise.all([lireProfil(), obtenirReglages().catch(() => null)]);
      if (r) setDelaiEchecS(r.audioEchecSecondes);
      const e = await reprendreOuDemarrer(p?.exam ?? 'toeic', { part: part && !Number.isNaN(part) ? part : undefined, notion });
      setEtat(e);
      setPhase({ nom: 'question' });
    } catch {
      setPhase({ nom: 'erreur' });
    }
  }, [part, notion]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const index = etat?.index ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoix(null);
    debut.current = Date.now();
  }, [index]);

  const question = etat ? questionCourante(etat) : null;
  const repondue = etat ? questionRepondue(etat) : false;
  const total = etat?.questions.length ?? 0;
  const faites = etat?.reponses.length ?? 0;
  const entete = t('certification.serie.entete', { n: Math.min(index + 1, total), total });

  const fin = (e: EtatSerie) => {
    if (e.termine) router.replace('/certification/serie-fin');
  };

  const valider = async () => {
    if (!etat || !question || choix === null || occupe.current) return;
    occupe.current = true;
    try {
      const suivant = await repondreSerie(etat, choix, Date.now() - debut.current);
      const r = resultatCourant(suivant);
      suivre('cert_exercise_answered', { type: question.type, partie: question.part, juste: r ? r.correct : null });
      setEtat(suivant);
    } finally {
      occupe.current = false;
    }
  };

  const passer = async () => {
    if (!etat || !question || occupe.current) return;
    occupe.current = true;
    try {
      const repondu = await repondreSerie(etat, null, Date.now() - debut.current);
      suivre('cert_exercise_answered', { type: question.type, partie: question.part, juste: null });
      const suivant = await avancer(repondu);
      setEtat(suivant);
      fin(suivant);
    } finally {
      occupe.current = false;
    }
  };

  const suivante = async () => {
    if (!etat || occupe.current) return;
    occupe.current = true;
    try {
      const suivant = await avancer(etat);
      setEtat(suivant);
      fin(suivant);
    } finally {
      occupe.current = false;
    }
  };

  const reessayerEnvoi = async () => {
    if (!etat) return;
    setEtat(await envoyerEnAttente(etat));
  };

  const ajouterMot = async (mot: MotCle) => {
    if (!etat) return;
    setEtat(await ajouterMotCarnet(etat, mot));
  };

  const sortir = () => {
    if (faites > 0) setQuitter(true);
    else router.back();
  };

  if (phase.nom !== 'question' || !etat || !question) {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.serie.entete', { n: 1, total: etat?.questions.length ?? 0 })} onRetour={() => router.back()} />}>
        {phase.nom !== 'erreur' ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.serie.chargement')}</Text>
        ) : (
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.serie.erreurTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.serie.erreurTexte')}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.serie.erreurGardees')}</Text>
            <Bouton libelle={t('certification.reessayer')} onPress={charger} />
            <Bouton variante="texte" libelle={t('certification.serie.revenir')} onPress={() => router.back()} />
          </View>
        )}
      </Ecran>
    );
  }

  const resultat = resultatCourant(etat);
  const reponse = etat.reponses.find((r) => r.question_id === question.id);

  return (
    <Ecran
      entete={<EnteteToeic titre={repondue ? t('certification.explication.entete') : entete} onRetour={sortir} />}
      pied={
        repondue ? undefined : (
          <View style={styles.pied}>
            <Bouton libelle={t('certification.diagnostic.valider')} desactive={choix === null} onPress={() => void valider()} retour />
          </View>
        )
      }
    >
      <BarreProgression pourcent={total ? (faites / total) * 100 : 0} libelle={entete} />
      {!repondue ? (
        <QuestionExercice key={question.id} question={question} choix={choix} onChoix={setChoix} delaiEchecS={delaiEchecS} ecran="serie" onPasser={() => void passer()} />
      ) : resultat ? (
        <ExplicationCert
          key={question.id}
          question={question}
          resultat={resultat}
          choix={reponse?.chosen ?? null}
          motsAjoutes={etat.motsAjoutes}
          derniere={index + 1 >= total}
          onAjouterMot={ajouterMot}
          onSuivante={() => void suivante()}
        />
      ) : (
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.serie.nonEnvoyeeTitre')} texte={`${t('certification.serie.nonEnvoyeeTexte')}`} />
          <Bouton libelle={t('certification.serie.reessayerMaintenant')} onPress={() => void reessayerEnvoi()} />
          <Bouton variante="secondaire" libelle={index + 1 >= total ? t('certification.serie.terminer') : t('certification.serie.continuer')} onPress={() => void suivante()} />
        </View>
      )}
      <FeuilleQuitter ouverte={quitter} onReprendre={() => setQuitter(false)} onQuitter={() => (setQuitter(false), router.back())} />
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] }, pied: { gap: espace[2] } });
