import { router } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { membresGroupe } from '@/services/certification/groupes';
import { chronometre } from '@/services/certification/format';
import { cloreParTemps, lireMini, repondreMini, tempsRestantMs, type EtatMini } from '@/services/certification/miniTest';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { OngletsGroupe } from './OngletsGroupe';
import { QuestionExercice } from './QuestionExercice';
import { BarreProgression, EnteteToeic } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'absent' } | { nom: 'examen'; etat: EtatMini };

/**
 * Écran d'examen d'un mini-test : suit le thème clair ou sombre, audio joué une seule fois, aucune correction avant la fin,
 * chronomètre sur horodatage absolu (l'app en arrière-plan ne le fige pas). Fin à la dernière réponse ou au temps écoulé.
 */
export function MiniTest() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  /** Réponses du groupe en cours (une par question ; `null` = passée). Validées ensemble au « Groupe suivant ». */
  const [reponses, setReponses] = useState<Record<string, number | null>>({});
  const [onglet, setOnglet] = useState(0);
  /** « Valider » touché alors que le groupe n'est pas complet : on le signale, puis « Valider quand même ». */
  const [incomplet, setIncomplet] = useState(false);
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
    setReponses({});
    setOnglet(0);
    setIncomplet(false);
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

  const membres = etat ? membresGroupe(etat.tentative.questions, etat.index) : [];
  const question = membres[onglet] ?? membres[0];
  const choix = question ? (reponses[question.id] ?? null) : null;
  const complet = membres.length > 0 && membres.every((m) => m.id in reponses);
  const repondues = membres.filter((m) => m.id in reponses).length;

  /** Envoie les réponses du groupe, dans l'ordre servi ; le test se termine à la dernière question. */
  const envoyer = async (map: Record<string, number | null>) => {
    if (!etat || membres.length === 0 || occupe.current || clos.current) return;
    occupe.current = true;
    try {
      const ms = (Date.now() - debut.current) / membres.length;
      let suivant = etat;
      for (const m of membres) {
        suivant = await repondreMini(suivant, map[m.id] ?? null, ms);
        suivre('cert_exercise_answered', { type: m.type, partie: m.part, juste: null });
      }
      if (suivant.termine) {
        clos.current = true;
        aLaFin();
      } else setPhase({ nom: 'examen', etat: suivant });
    } finally {
      occupe.current = false;
    }
  };

  /** Passe la question en cours ; quand tout le groupe a une réponse, il part au serveur. */
  const passer = () => {
    if (!question) return;
    const suite = { ...reponses, [question.id]: null };
    setReponses(suite);
    const prochain = membres.findIndex((m) => !(m.id in suite));
    if (prochain >= 0) setOnglet(prochain);
    else void envoyer(suite);
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

  const total = etat.tentative.questions.length;
  const derniere = etat.index + membres.length >= total;
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
        <Bouton
          libelle={membres.length > 1 ? (incomplet ? t('certification.exercice.validerQuandMeme', { n: repondues, total: membres.length }) : t('certification.exercice.validerN', { n: repondues, total: membres.length })) : derniere ? t('certification.examen.derniere') : t('certification.examen.suivante')}
          onPress={() => (membres.length > 1 && !complet && !incomplet ? setIncomplet(true) : void envoyer(reponses))}
          retour
        />
      }
    >
      <BarreProgression pourcent={total ? (etat.index / total) * 100 : 0} libelle={titre} />
      {question ? (
        <QuestionExercice
          key={membres[0]?.id ?? question.id}
          question={question}
          choix={choix}
          onChoix={(i) => setReponses((r) => ({ ...r, [question.id]: i }))}
          unique
          delaiEchecS={delaiEchecS}
          ecran="mini_test"
          position={etat.index + onglet + 1}
          onPasser={passer}
          enteteGroupe={membres.length > 1 ? <OngletsGroupe membres={membres} reponses={reponses} selection={onglet} onChoisir={setOnglet} /> : null}
          trouCourant={onglet + 1}
        />
      ) : null}
      {incomplet && !complet ? <Banniere ton="alerte" titre={t('certification.exercice.pasToutRepondu')} /> : null}
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
  chrono: { flexDirection: 'row', alignItems: 'center', gap: espace[1] },
});
