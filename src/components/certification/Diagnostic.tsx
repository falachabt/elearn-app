import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireConnectivite } from '@/services/connectivite';
import { demarrerOuReprendre, progression, repondre } from '@/services/certification/diagnostic';
import { obtenirReglages, type EtatDiagnostic } from '@/services/certification/etat';
import { membresGroupe } from '@/services/certification/groupes';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { FeuilleQuitter } from './FeuilleQuitter';
import { OngletsGroupe } from './OngletsGroupe';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

/** Une nouvelle tentative silencieuse après une erreur passagère ; « contenu indisponible » n'est pas passager. */
async function essayerEncore<T>(appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (erreur) {
    if (erreur instanceof Error && erreur.message.includes('contenu indisponible')) throw erreur;
    await new Promise((resoudre) => setTimeout(resoudre, 1500));
    return appel();
  }
}

type Phase = { nom: 'chargement' } | { nom: 'erreur'; horsLigne: boolean } | { nom: 'vide' } | { nom: 'question' };

/** A6 · Question du diagnostic : pas de correction, l'audio se joue une seule fois, « Passer » compte comme faux. */
export function Diagnostic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatDiagnostic | null>(null);
  /** Réponses du groupe en cours (une par question ; `null` = passée). Validées ensemble au « Groupe suivant ». */
  const [reponses, setReponses] = useState<Record<string, number | null>>({});
  const [onglet, setOnglet] = useState(0);
  const [quitter, setQuitter] = useState(false);
  const [delaiEchecS, setDelaiEchecS] = useState(20);
  const debut = useRef(0);
  const occupe = useRef(false);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [p, r] = await Promise.all([lireProfil(), obtenirReglages().catch(() => null)]);
      if (r) setDelaiEchecS(r.audioEchecSecondes);
      // Secours silencieux : une erreur passagère au premier appel ne doit pas afficher l'écran d'erreur.
      const e = await essayerEncore(() => demarrerOuReprendre(p?.exam ?? 'toeic'));
      setEtat(e);
      setPhase({ nom: 'question' });
    } catch (e) {
      // Pas de questions publiées côté serveur : ce n'est ni une panne ni une coupure, il n'y a rien à réessayer.
      if (e instanceof Error && e.message.includes('contenu indisponible')) {
        setPhase({ nom: 'vide' });
        return;
      }
      const c = lireConnectivite();
      setPhase({ nom: 'erreur', horsLigne: !c.connecte || c.backend === false });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  // Nouveau groupe : réponses remises à zéro, premier onglet, chronomètre relancé.
  const index = etat?.index ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReponses({});
    setOnglet(0);
    debut.current = Date.now();
  }, [index]);

  const membres = etat?.tentative ? membresGroupe(etat.tentative.questions, index) : [];
  const question = membres[onglet] ?? membres[0] ?? null;
  const choix = question ? (reponses[question.id] ?? null) : null;
  const complet = membres.length > 0 && membres.every((m) => m.id in reponses);
  const { faites, total } = etat ? progression(etat) : { faites: 0, total: 0 };

  /** Passe la question en cours ; quand tout le groupe a une réponse, il part au serveur. */
  const passer = () => {
    if (!question) return;
    const suite = { ...reponses, [question.id]: null };
    setReponses(suite);
    const prochain = membres.findIndex((m) => !(m.id in suite));
    if (prochain >= 0) setOnglet(prochain);
    else void envoyer(suite);
  };

  const envoyer = async (map: Record<string, number | null>) => {
    if (!etat || membres.length === 0 || occupe.current) return;
    occupe.current = true;
    try {
      const ms = (Date.now() - debut.current) / membres.length;
      let suivant = etat;
      for (const m of membres) {
        suivant = await repondre(suivant, map[m.id] ?? null, ms);
        suivre('cert_exercise_answered', { type: m.type, partie: m.part, juste: null });
      }
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
        {phase.nom === 'vide' ? (
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.diagnostic.videTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.diagnostic.videTexte')}</Text>
            <Bouton variante="texte" libelle={t('certification.diagnostic.sortir')} onPress={() => router.back()} />
          </View>
        ) : phase.nom === 'chargement' ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.diagnostic.chargement')}</Text>
        ) : phase.nom === 'erreur' ? (
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t(phase.horsLigne ? 'certification.diagnostic.horsLigneTitre' : 'certification.diagnostic.erreurTitre')}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t(phase.horsLigne ? 'certification.diagnostic.horsLigneTexte' : 'certification.diagnostic.erreurTexte')}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.diagnostic.erreurGardees')}</Text>
            <Bouton libelle={t('certification.reessayer')} onPress={charger} />
            <Bouton variante="texte" libelle={t('certification.diagnostic.sortir')} onPress={() => router.back()} />
          </View>
        ) : null}
      </Ecran>
    );
  }

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.diagnostic.entete', { n: Math.min(faites + 1, total), total })} onRetour={sortir} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={membres.length > 1 ? t('certification.exercice.groupeSuivant') : t('certification.diagnostic.valider')} desactive={!complet} onPress={() => void envoyer(reponses)} retour />
          <Bouton variante="texte" libelle={t('certification.diagnostic.passer')} onPress={passer} />
        </View>
      }
    >
      <BarreProgression pourcent={total ? (faites / total) * 100 : 0} libelle={t('certification.diagnostic.entete', { n: Math.min(faites + 1, total), total })} />
      <QuestionExercice
        key={membres[0]?.id ?? question.id}
        question={question}
        choix={choix}
        onChoix={(i) => setReponses((r) => ({ ...r, [question.id]: i }))}
        unique
        delaiEchecS={delaiEchecS}
        ecran="diagnostic"
        position={Math.min(faites + onglet + 1, total)}
        onPasser={passer}
        enteteGroupe={membres.length > 1 ? <OngletsGroupe membres={membres} reponses={reponses} selection={onglet} onChoisir={setOnglet} /> : null}
        trouCourant={onglet + 1}
      />
      <FeuilleQuitter ouverte={quitter} onReprendre={() => setQuitter(false)} onQuitter={() => (setQuitter(false), router.replace('/certification/arrivee'))} />
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] }, pied: { gap: espace[2] } });
