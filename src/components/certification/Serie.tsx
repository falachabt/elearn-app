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
  repondreGroupeSerie,
  reprendreOuDemarrer,
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
  /** Option choisie par question du groupe courant, avant validation (v28 : groupes à validation unique). */
  const [choixGroupe, setChoixGroupe] = useState<Record<string, number | null>>({});
  /** « Valider » touché alors que le groupe n'est pas complet : on le signale, puis « Valider quand même ». */
  const [incomplet, setIncomplet] = useState(false);
  /** Question affichée dans le groupe (onglet) ; `null` = la première question du groupe. */
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
    setChoixGroupe({});
    setIncomplet(false);
    setVue(null);
    debut.current = Date.now();
  }, [index]);

  // Le groupe courant : une question seule, ou les questions d'une même conversation / d'un même texte (parties 3, 4, 6, 7).
  const indices = etat ? indicesGroupe(etat.questions, index) : [];
  const membres = etat ? indices.flatMap((i) => (etat.questions[i] ? [etat.questions[i]] : [])) : [];
  const dernierIndice = indices[indices.length - 1] ?? index;
  // Le groupe est validé quand toutes ses questions ont une réponse (envoyée ou en file).
  const groupeValide = !!etat && membres.length > 0 && membres.every((m) => etat.reponses.some((r) => r.question_id === m.id));
  const indiceVue = vue ?? index;
  const question = etat ? (etat.questions[indiceVue] ?? null) : null;
  const reponseVue = etat && question ? etat.reponses.find((r) => r.question_id === question.id) : undefined;
  const resultatVue = etat && question ? (etat.resultats[question.id] ?? null) : null;
  const choixVue = question ? (choixGroupe[question.id] ?? null) : null;
  const reponsesGroupe: Record<string, number | null> = groupeValide && etat ? Object.fromEntries(etat.reponses.map((r) => [r.question_id, r.chosen])) : choixGroupe;
  const choisirOnglet = (i: number) => {
    const cible = indices[i];
    if (cible === undefined) return;
    setVue(cible === index ? null : cible);
  };
  const total = etat?.questions.length ?? 0;
  const faites = etat?.reponses.length ?? 0;
  const entete = t('certification.serie.entete', { n: Math.min(index + 1, total), total });
  // En-tête de la maquette : « Partie N · Nom » dès que la partie de la question est connue, sinon « Série n / total ».
  const titre = question ? t('certification.serie.partieEntete', { n: question.part, nom: t(`certification.exercice.partieNom.${question.type}` as "certification.exercice.partieNom.photo") }) : entete;
  const positionVue = indices.indexOf(indiceVue);
  const derniereVue = indiceVue === dernierIndice;

  const fin = (e: EtatSerie) => {
    if (e.termine) router.replace('/certification/serie-fin');
  };

  /** Valide le groupe entier : une réponse par question, dans l'ordre servi. Les questions non cochées partent passées. */
  const valider = async () => {
    if (!etat || occupe.current || membres.length === 0) return;
    occupe.current = true;
    try {
      const suivant = await repondreGroupeSerie(etat, indices, choixGroupe, Date.now() - debut.current);
      for (const m of membres) suivre('cert_exercise_answered', { type: m.type, partie: m.part, juste: suivant.resultats[m.id] ? suivant.resultats[m.id]!.correct : null });
      setEtat(suivant);
      setVue(null);
    } finally {
      occupe.current = false;
    }
  };

  const passer = async () => {
    if (!etat || occupe.current || membres.length === 0) return;
    occupe.current = true;
    try {
      const repondu = await repondreGroupeSerie(etat, indices, {}, Date.now() - debut.current);
      membres.forEach((m) => suivre('cert_exercise_answered', { type: m.type, partie: m.part, juste: null }));
      const suivant = await avancer(repondu, dernierIndice + 1);
      setEtat(suivant);
      fin(suivant);
    } finally {
      occupe.current = false;
    }
  };

  /** Onglet suivant dans le groupe corrigé, ou question suivante après la dernière question du groupe. */
  const suivante = async () => {
    if (!etat || occupe.current) return;
    if (!derniereVue) {
      setVue(indices[positionVue + 1] ?? null);
      return;
    }
    occupe.current = true;
    try {
      const suivant = await avancer(etat, dernierIndice + 1);
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

  const resultat = groupeValide && resultatVue ? resultatVue : null;
  const corrigee = groupeValide && !!reponseVue;
  const pluriel = membres.length > 1;
  const nbRepondues = membres.filter((m) => m.id in choixGroupe).length;

  return (
    <Ecran
      entete={<EnteteToeic titre={titre} onRetour={sortir} />}
      pied={
        groupeValide ? undefined : (
          <View style={styles.pied}>
            <Bouton
              libelle={
                pluriel
                  ? incomplet
                    ? t('certification.exercice.validerQuandMeme', { n: nbRepondues, total: membres.length })
                    : t('certification.exercice.validerN', { n: nbRepondues, total: membres.length })
                  : t('certification.diagnostic.valider')
              }
              desactive={!pluriel && choixVue === null}
              onPress={() => {
                if (pluriel && !incomplet && !membres.every((m) => m.id in choixGroupe)) setIncomplet(true);
                else void valider();
              }}
              retour
            />
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
        choix={corrigee ? (reponseVue?.chosen ?? null) : choixVue}
        onChoix={(i) => setChoixGroupe((c) => ({ ...c, [question.id]: i }))}
        bonne={corrigee && resultat ? resultat.correct_index : undefined}
        verrouille={corrigee}
        delaiEchecS={delaiEchecS}
        ecran="serie"
        position={Math.min(indiceVue + 1, total)}
        onPasser={() => void passer()}
        enteteGroupe={pluriel ? <OngletsGroupe membres={membres} reponses={reponsesGroupe} selection={positionVue} onChoisir={choisirOnglet} /> : null}
        trouCourant={positionVue + 1}
      />
      {!groupeValide && incomplet && !membres.every((m) => m.id in choixGroupe) ? <Banniere ton="alerte" titre={t('certification.exercice.pasToutRepondu')} /> : null}
      {!groupeValide ? null : resultat ? (
        <ExplicationCert
          key={`${question.id}-correction`}
          question={question}
          resultat={resultat}
          choix={reponseVue?.chosen ?? null}
          motsAjoutes={etat.motsAjoutes}
          derniere={derniereVue && dernierIndice + 1 >= total}
          libelleSuivante={!derniereVue ? t('certification.exercice.ongletSuivant') : undefined}
          onAjouterMot={ajouterMot}
          onSuivante={() => void suivante()}
        />
      ) : (
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.serie.nonEnvoyeeTitre')} texte={`${t('certification.serie.nonEnvoyeeTexte')}`} />
          <Bouton libelle={t('certification.serie.reessayerMaintenant')} onPress={() => void reessayerEnvoi()} />
          <Bouton variante="secondaire" libelle={dernierIndice + 1 >= total ? t('certification.serie.terminer') : t('certification.serie.continuer')} onPress={() => void suivante()} />
        </View>
      )}
      <FeuilleQuitter ouverte={quitter} onReprendre={() => setQuitter(false)} onQuitter={() => (setQuitter(false), router.back())} />
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] }, pied: { gap: espace[2] } });
