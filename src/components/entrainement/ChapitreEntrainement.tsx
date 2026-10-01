import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireEntrainement, lireExercicesFaits, lireMeilleursScores, type Exercice, type QuizLibre } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Ligne } from './Ligne';
import { ouvrirQuiz } from './ouvrirQuiz';

type Filtre = 'tout' | 'quiz' | 'exercices';
type Element = { type: 'quiz'; q: QuizLibre } | { type: 'exercice'; e: Exercice; i: number };

/** « Tout » : quiz et exercices alternés dans une seule liste, chacun reconnaissable à sa pastille. */
function melanger(quiz: QuizLibre[], exercices: Exercice[]): Element[] {
  const liste: Element[] = [];
  for (let k = 0; k < Math.max(quiz.length, exercices.length); k++) {
    if (quiz[k]) liste.push({ type: 'quiz', q: quiz[k] });
    if (exercices[k]) liste.push({ type: 'exercice', e: exercices[k], i: k });
  }
  return liste;
}

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; quiz: QuizLibre[]; exercices: Exercice[]; scores: Record<string, number>; faits: Record<string, true> };

/** Entraînement d'un chapitre (M5-09) : onglets Tout / Quiz / Exercices ; quiz avec le meilleur score, exercices faits cochés. */
export function ChapitreEntrainement() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom } = useLocalSearchParams<{ cours: string; nom?: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const pret = useSessionPrete();

  useFocusEffect(
    useCallback(() => {
      if (!pret) return;
      let actif = true;
      Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireMeilleursScores(), lireExercicesFaits()])
        .then(([e, scores, faits]) => actif && setEtat({ statut: 'pret', ...e, scores, faits }))
        .catch(() => actif && setEtat({ statut: 'erreur' }));
      return () => {
        actif = false;
      };
    }, [cours, pret]),
  );

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom || t('entrainement.onglet')}</Text>
        </>
      }
    >
      {etat.statut === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('entrainement.chargement')}</Text> : null}
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('entrainement.erreur')} /> : null}
      {etat.statut === 'pret' && !etat.quiz.length && !etat.exercices.length ? <Banniere ton="info" titre={t('entrainement.videChapitre')} /> : null}
      {etat.statut === 'pret' && etat.quiz.length && etat.exercices.length ? (
        <Onglets
          valeurs={[
            { valeur: 'tout', libelle: t('entrainement.tout') },
            { valeur: 'quiz', libelle: t('entrainement.quiz') },
            { valeur: 'exercices', libelle: t('entrainement.exercices') },
          ]}
          valeur={filtre}
          onChange={setFiltre}
        />
      ) : null}
      {etat.statut === 'pret' ? (
        <View style={styles.groupe}>
          {melanger(filtre === 'exercices' ? [] : etat.quiz, filtre === 'quiz' ? [] : etat.exercices).map((el) =>
            el.type === 'quiz' ? (
              <Ligne
                key={el.q.id}
                icone="help-circle-outline"
                genre={{ type: 'quiz', libelle: el.q.numero ? t('entrainement.etiquetteQuizN', { n: el.q.numero }) : t('entrainement.etiquetteQuiz') }}
                titre={el.q.nom}
                details={[t('entrainement.questions', { n: el.q.questions }), etat.scores[el.q.id] !== undefined ? t('entrainement.meilleur', { n: etat.scores[el.q.id] }) : null].filter(Boolean).join(' · ')}
                fait={etat.scores[el.q.id] === 100}
                onPress={() => void ouvrirQuiz(el.q, String(cours), nom ?? '')}
              />
            ) : (
              <Ligne
                key={el.e.id}
                icone="create-outline"
                genre={{ type: 'exercice', libelle: t('entrainement.exercice', { n: el.i + 1, total: etat.exercices.length }) }}
                titre={el.e.titre}
                details={etat.faits[el.e.id] ? t('entrainement.fait') : undefined}
                fait={!!etat.faits[el.e.id]}
                onPress={() => router.push({ pathname: '/entrainement/exercice', params: { id: el.e.id, cours: String(cours) } })}
              />
            ),
          )}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, groupe: { gap: espace[4] } });
