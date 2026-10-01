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
import { BoutonFermer } from '../arrivee/MiniTest';
import { Ligne } from './Ligne';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; quiz: QuizLibre[]; exercices: Exercice[]; scores: Record<string, number>; faits: Record<string, true> };

/** Entraînement d'un chapitre (M5-09) : ses quiz avec le meilleur score, ses exercices avec ceux déjà faits. */
export function ChapitreEntrainement() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom } = useLocalSearchParams<{ cours: string; nom?: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
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
      {etat.statut === 'pret' && etat.quiz.length ? (
        <View style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('entrainement.quiz')}</Text>
          {etat.quiz.map((q) => (
            <Ligne
              key={q.id}
              icone="help-circle-outline"
              titre={q.nom}
              details={[t('entrainement.questions', { n: q.questions }), etat.scores[q.id] !== undefined ? t('entrainement.meilleur', { n: etat.scores[q.id] }) : null].filter(Boolean).join(' · ')}
              fait={etat.scores[q.id] === 100}
              onPress={() => router.push({ pathname: '/entrainement/quiz', params: { id: q.id } })}
            />
          ))}
        </View>
      ) : null}
      {etat.statut === 'pret' && etat.exercices.length ? (
        <View style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('entrainement.exercices')}</Text>
          {etat.exercices.map((e, i) => (
            <Ligne
              key={e.id}
              icone="create-outline"
              titre={e.titre}
              details={[t('entrainement.exercice', { n: i + 1, total: etat.exercices.length }), etat.faits[e.id] ? t('entrainement.fait') : null].filter(Boolean).join(' · ')}
              fait={!!etat.faits[e.id]}
              onPress={() => router.push({ pathname: '/entrainement/exercice', params: { id: e.id, cours: String(cours) } })}
            />
          ))}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, groupe: { gap: espace[4] } });
