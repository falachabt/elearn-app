import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { statutsDesQuestions } from '@/services/certification/bilanMini';
import { indicesGroupe } from '@/services/certification/groupes';
import { effacerMini, lireMini, type EtatMini } from '@/services/certification/miniTest';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { CarteCorrection } from './CarteCorrection';
import { GrilleQuestions } from './GrilleQuestions';
import { OngletsGroupe } from './OngletsGroupe';
import { QuestionExercice } from './QuestionExercice';
import { EnteteToeic, Squelette } from './ui';

/**
 * Revue d'un Examen terminé (v28, REV-PHOTO et REV-GRP) : une question à la fois, avec sa réponse, la bonne réponse et sa
 * notion. Les groupes gardent leurs onglets et leur audio réécoutable ; une question sans réponse le dit.
 */
export function MiniRevue() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<EtatMini | null | 'chargement'>('chargement');
  const [curseur, setCurseur] = useState(0);

  useEffect(() => {
    void lireMini().then((e) => {
      if (!e?.fin) {
        router.replace('/tests' as never);
        return;
      }
      setEtat(e);
    });
  }, []);

  if (etat === 'chargement') {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.revue.entete')} />}>
        <Squelette lignes={3} />
      </Ecran>
    );
  }
  if (etat === null || !etat.fin) return null;

  const questions = etat.tentative.questions;
  const resultats = etat.fin.results;
  const statuts = statutsDesQuestions(questions.map((q) => q.id), resultats);
  const membresIdx = indicesGroupe(questions, curseur);
  const membres = membresIdx.map((i) => questions[i]!);
  const question = questions[curseur];
  if (!question) return null;
  const resultat = resultats.find((r) => r.question_id === question.id);
  const choix = etat.reponses.find((r) => r.question_id === question.id)?.chosen ?? null;
  const reponsesGroupe = Object.fromEntries(membres.map((m) => [m.id, etat.reponses.find((r) => r.question_id === m.id)?.chosen ?? null]));
  const dernierIdx = membresIdx[membresIdx.length - 1] ?? curseur;
  const derniere = dernierIdx + 1 >= questions.length;
  const titre = membres.length > 1 ? t('certification.revue.partie', { p: question.part, n: curseur + 1 }) : t('certification.revue.position', { n: curseur + 1, total: questions.length });
  const suivante = () => {
    if (derniere) {
      void effacerMini().then(() => router.replace('/tests' as never));
      return;
    }
    setCurseur(dernierIdx + 1);
  };

  return (
    <Ecran
      entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}
      pied={<Bouton libelle={derniere ? t('certification.revue.terminer') : t('certification.revue.suivante')} onPress={suivante} retour />}
    >
      <GrilleQuestions statuts={statuts} actif={curseur} onChoisir={setCurseur} />
      <QuestionExercice
        key={membres[0]?.id ?? question.id}
        question={question}
        choix={choix}
        onChoix={() => {}}
        bonne={resultat?.correct_index ?? null}
        verrouille
        ecran="mini_revue"
        delaiEchecS={0}
        onPasser={() => {}}
        position={curseur + 1}
        enteteGroupe={membres.length > 1 ? <OngletsGroupe membres={membres} reponses={reponsesGroupe} selection={membresIdx.indexOf(curseur)} onChoisir={(i) => setCurseur(membresIdx[i]!)} /> : null}
      />
      {choix === null ? (
        <Carte style={{ gap: espace[1] }}>
          <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.revue.sansReponse')}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.revue.sansReponseAide', { n: curseur + 1 })}</Text>
        </Carte>
      ) : null}
      {resultat ? (
        <CarteCorrection
          badge={t('certification.revue.corrige')}
          juste={resultat.correct}
          question={question}
          choix={choix}
          bonne={resultat.correct_index}
          notion={resultat.notion}
          piege={resultat.trap}
        />
      ) : null}
    </Ecran>
  );
}
