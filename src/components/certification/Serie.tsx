import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { indicesGroupe } from '@/services/certification/groupes';
import {
  MESSAGE_SERIE_VIDE,
  ajouterMotCarnet,
  avancer,
  envoyerEnAttente,
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
import { OngletsGroupe } from './OngletsGroupe';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'vide' } | { nom: 'question' };

/** B1 à B7 · Série d'entraînement : choisir, valider, corrigé (B9), question suivante, fin (B11). */
export function Serie() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ part?: string; notion?: string; rejeu?: string; ancrage?: string; taille?: string; origine?: string }>();
  const part = params.part ? Number(params.part) : undefined;
  const notion = params.notion || undefined;
  const rejeu = params.rejeu === '1';
  const ancrage = params.ancrage === '1';
  const taille = params.taille ? Number(params.taille) : undefined;
  const origine = params.origine === 'seance' ? 'seance' : undefined;
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatSerie | null>(null);
  const [choix, setChoix] = useState<number | null>(null);
  /** Question affichée dans le groupe quand ce n'est pas la question courante (onglet d'une question déjà corrigée). */
  const [vue, setVue] = useState<number | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [delaiEchecS, setDelaiEchecS] = useState(20);
  const debut = useRef(0);
  const occupe = useRef(false);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [p, r] = await Promise.all([lireProfil(), obtenirReglages().catch(() => null)]);
      if (r) setDelaiEchecS(r.audioEchecSecondes);
      const e = await reprendreOuDemarrer(p?.exam ?? 'toeic', { part: part && !Number.isNaN(part) ? part : undefined, notion, rejeu, ancrage }, { taille: taille && !Number.isNaN(taille) ? taille : undefined, origine });
      setEtat(e);
      setPhase({ nom: 'question' });
    } catch (e) {
      // Aucune question à servir (ex. rien à rejouer aujourd'hui) : ce n'est pas une panne, il n'y a rien à réessayer.
      setPhase({ nom: e instanceof Error && e.message === MESSAGE_SERIE_VIDE ? 'vide' : 'erreur' });
    }
  }, [part, notion, rejeu, ancrage, taille, origine]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const index = etat?.index ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoix(null);
    setVue(null);
    debut.current = Date.now();
  }, [index]);

  // Onglets du groupe : les questions déjà corrigées se consultent ; la question courante reste la seule à répondre (la série est servie dans l'ordre).
  const indices = etat ? indicesGroupe(etat.questions, index) : [];
  const indiceVue = vue ?? index;
  const estCourante = indiceVue === index;
  const question = etat ? (etat.questions[indiceVue] ?? null) : null;
  const reponseVue = etat && question ? etat.reponses.find((r) => r.question_id === question.id) : undefined;
  const repondue = !!reponseVue;
  const resultatVue = etat && question ? (etat.resultats[question.id] ?? null) : null;
  const reponsesGroupe = etat ? Object.fromEntries(etat.reponses.map((r) => [r.question_id, r.chosen])) : {};
  const membres = etat ? indices.flatMap((i) => (etat.questions[i] ? [etat.questions[i]] : [])) : [];
  const choisirOnglet = (i: number) => {
    const cible = indices[i];
    if (cible === undefined || cible > index) return;
    setVue(cible === index ? null : cible);
  };
  const total = etat?.questions.length ?? 0;
  const faites = etat?.reponses.length ?? 0;
  const entete = t('certification.serie.entete', { n: Math.min(index + 1, total), total });
  // En-tête de la maquette : « Partie N · Nom » dès que la partie de la question est connue, sinon « Série n / total ».
  const titre = question ? t('certification.serie.partieEntete', { n: question.part, nom: t(`certification.exercice.partieNom.${question.type}` as "certification.exercice.partieNom.photo") }) : entete;

  const fin = (e: EtatSerie) => {
    if (e.termine) router.replace('/certification/serie-fin');
  };

  const valider = async () => {
    if (!etat || !question || !estCourante || choix === null || occupe.current) return;
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
    if (!etat || !question || !estCourante || occupe.current) return;
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
    if (!estCourante) {
      setVue(null);
      return;
    }
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
      <Ecran entete={<EnteteToeic titre={t('certification.serie.titre')} onRetour={() => router.back()} />}>
        {phase.nom === 'chargement' ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.serie.chargement')}</Text>
        ) : phase.nom === 'vide' ? (
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.serie.videTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{rejeu ? t('certification.serie.videRejeu') : t('certification.serie.videTexte')}</Text>
            <Bouton variante="texte" libelle={t('certification.serie.revenir')} onPress={() => router.back()} />
          </View>
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

  const resultat = estCourante ? resultatCourant(etat) : resultatVue;
  const reponse = reponseVue;

  return (
    <Ecran
      entete={<EnteteToeic titre={titre} onRetour={sortir} />}
      pied={
        repondue || !estCourante ? undefined : (
          <View style={styles.pied}>
            <Bouton libelle={t('certification.diagnostic.valider')} desactive={choix === null} onPress={() => void valider()} retour />
          </View>
        )
      }
    >
      <BarreProgression pourcent={total ? (faites / total) * 100 : 0} libelle={entete} />
      {/* B1 à B7 : la question reste à l'écran après validation (photo, audio, passage gardés) ; le corrigé s'ajoute dessous.
          Clé par groupe : l'audio d'un groupe (parties 3, 4, 6, 7) n'est pas relancé d'une question à l'autre. */}
      <QuestionExercice
        key={`groupe-${question.group?.id ?? question.id}`}
        question={question}
        choix={repondue ? (reponse?.chosen ?? null) : choix}
        onChoix={setChoix}
        bonne={repondue && resultat ? resultat.correct_index : undefined}
        verrouille={repondue}
        delaiEchecS={delaiEchecS}
        ecran="serie"
        position={Math.min(indiceVue + 1, total)}
        onPasser={() => void passer()}
        enteteGroupe={membres.length > 1 ? <OngletsGroupe membres={membres} reponses={reponsesGroupe} selection={indices.indexOf(indiceVue)} onChoisir={choisirOnglet} /> : null}
        trouCourant={indices.indexOf(indiceVue) + 1}
      />
      {!repondue ? null : resultat ? (
        <ExplicationCert
          key={`${question.id}-correction`}
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
