import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Onglets } from '../Onglets';

import { useTraduction } from '@/i18n/useTraduction';
import { statutsDesQuestions } from '@/services/certification/bilanMini';
import { indicesGroupe } from '@/services/certification/groupes';
import { effacerMini, lireMini } from '@/services/certification/miniTest';
import type { FinTentative, ReponseEnvoyee, Tentative } from '@/services/certification/types';
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

/** Ce que la revue lit : l'Examen (mini-test) et le diagnostic gardent la même forme de tentative, de réponses et de fin. */
type EtatRevue = { tentative: Tentative | null; fin: FinTentative | null; reponses: ReponseEnvoyee[] };
/** Une revue n'est affichée qu'une fois la tentative et sa fin connues. */
type EtatAffiche = { tentative: Tentative; fin: FinTentative; reponses: ReponseEnvoyee[] };

type Props = {
  lire?: () => Promise<EtatRevue | null>;
  /** Où revenir à la fin : les tests (Examen) ou le résultat (diagnostic). Le diagnostic ne se remet pas à zéro. */
  retourFin?: 'tests' | 'resultat';
};

/**
 * Revue d'un Examen terminé (v28, REV-PHOTO et REV-GRP) : une question à la fois, avec sa réponse, la bonne réponse et sa
 * notion. Les groupes gardent leurs onglets et leur audio réécoutable ; une question sans réponse le dit.
 */
export function MiniRevue({ lire = lireMini, retourFin = 'tests' }: Props = {}) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<EtatAffiche | null | 'chargement'>('chargement');
  const [curseur, setCurseur] = useState(0);
  const [filtre, setFiltre] = useState<'toutes' | 'erreurs'>('toutes');
  const sortie = retourFin === 'resultat' ? '/certification/resultat' : '/tests';

  useEffect(() => {
    void lire().then((e) => {
      if (!e?.tentative || !e.fin) {
        router.replace(sortie as never);
        return;
      }
      setEtat({ tentative: e.tentative, fin: e.fin, reponses: e.reponses });
    });
  }, [lire, sortie]);

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
  // « Mes erreurs » (maquette M-REV) : seules les questions fausses ou sans réponse se suivent ; la grille reste complète.
  const estErreur = (i: number) => statuts[i] !== 'juste';
  const prochaine = filtre === 'erreurs' ? questions.findIndex((_, i) => i > dernierIdx && estErreur(i)) : dernierIdx + 1;
  const sansSuite = prochaine < 0 || prochaine >= questions.length;
  const changerFiltre = (v: 'toutes' | 'erreurs') => {
    setFiltre(v);
    if (v === 'erreurs' && !estErreur(curseur)) {
      const premiere = questions.findIndex((_, i) => estErreur(i));
      if (premiere >= 0) setCurseur(premiere);
    }
  };
  const suivante = () => {
    if (sansSuite) {
      if (retourFin === 'resultat') router.replace(sortie as never);
      else void effacerMini().then(() => router.replace(sortie as never));
      return;
    }
    setCurseur(prochaine);
  };

  return (
    <Ecran piedBordure
      entete={<EnteteToeic titre={titre} onRetour={() => router.back()} />}
      pied={<Bouton libelle={sansSuite ? t(retourFin === 'resultat' ? 'certification.revue.retourResultat' : 'certification.revue.terminer') : t('certification.revue.suivante')} onPress={suivante} retour />}
    >
      <Onglets valeurs={[{ valeur: 'toutes', libelle: t('certification.revue.toutes') }, { valeur: 'erreurs', libelle: t('certification.revue.mesErreurs') }]} valeur={filtre} onChange={changerFiltre} />
      <GrilleQuestions statuts={statuts} actif={curseur} onChoisir={setCurseur} />
      <QuestionExercice
        key={membres[0]?.id ?? question.id}
        question={question}
        choix={choix}
        onChoix={() => {}}
        bonne={resultat?.correct_index ?? null}
        verrouille
        motsRevue
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
