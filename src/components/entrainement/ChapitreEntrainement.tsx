import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireEntrainement, lireExercicesFaits, lireMeilleursScores, type Exercice, type QuizLibre } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { titreExercice, titreQuiz } from '@/services/titres';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { BoutonFermer } from '../arrivee/MiniTest';
import { CarteListe } from '../liste/CarteListe';
import { EcranErreur } from '../liste/EcranErreur';
import { Pastille } from '../liste/Pastille';
import { PastilleType } from '../liste/PastilleType';
import { Squelettes } from '../liste/Squelettes';
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

/** Un quiz est « fini » à 80 % ; sa pastille de score est verte dès 50 %. */
const SEUIL_FINI = 80;
const SEUIL_VERT = 50;

/** Entraînement d'un chapitre (M5-09, revue design écran 3) : onglets Tout / Quiz / Exercices et une seule carte pour les deux types. */
export function ChapitreEntrainement() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom, onglet } = useLocalSearchParams<{ cours: string; nom?: string; onglet?: Filtre }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [filtre, setFiltre] = useState<Filtre>(onglet === 'quiz' || onglet === 'exercices' ? onglet : 'tout');
  const pret = useSessionPrete();
  const chapitre = nom ?? '';
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

  const charger = useCallback(() => {
    if (!pret) return;
    let actif = true;
    Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireMeilleursScores(), lireExercicesFaits()])
      .then(([e, scores, faits]) => actif && setEtat({ statut: 'pret', ...e, scores, faits }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, pret]);
  useFocusEffect(charger);

  const quizFini = (e: Extract<Etat, { statut: 'pret' }>, q: QuizLibre) => (e.scores[q.id] ?? -1) >= SEUIL_FINI;
  const progression =
    etat.statut === 'pret' && etat.quiz.length + etat.exercices.length
      ? t('entrainement.progression', { n: etat.quiz.filter((q) => quizFini(etat, q)).length + etat.exercices.filter((e) => etat.faits[e.id]).length, total: etat.quiz.length + etat.exercices.length })
      : null;

  const nomQuiz = (q: QuizLibre) => {
    const { corps, numero } = titreQuiz(q.nom, chapitre, q.numero);
    if (corps) return numero ? t('entrainement.titreQuizN', { n: numero, titre: corps }) : t('entrainement.titreQuiz', { titre: corps });
    return numero ? t('entrainement.etiquetteQuizN', { n: numero }) : t('entrainement.quizChapitre');
  };

  const liste = etat.statut === 'pret' ? melanger(filtre === 'exercices' ? [] : etat.quiz, filtre === 'quiz' ? [] : etat.exercices) : [];

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{chapitre || t('entrainement.onglet')}</Text>
          {progression ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{progression}</Text> : null}
        </>
      }
    >
      {etat.statut === 'chargement' ? <Squelettes /> : null}
      {etat.statut === 'erreur' ? (
        <EcranErreur
          titre={t('entrainement.erreurTitre')}
          phrase={t('entrainement.erreurPhrase')}
          reessayer={t('entrainement.reessayer')}
          onReessayer={() => {
            setEtat({ statut: 'chargement' });
            charger();
          }}
          secours={{ libelle: t('entrainement.retourChapitre'), onPress: retour }}
        />
      ) : null}
      {etat.statut === 'pret' && !etat.quiz.length && !etat.exercices.length ? <Vide texte={t('entrainement.videChapitre')} bouton={t('entrainement.autresChapitres')} onPress={retour} /> : null}
      {etat.statut === 'pret' && (etat.quiz.length || etat.exercices.length) ? (
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
      {etat.statut === 'pret' && (etat.quiz.length || etat.exercices.length) && !liste.length ? (
        <Vide texte={t(filtre === 'quiz' ? 'entrainement.videQuiz' : 'entrainement.videExercices')} bouton={t('entrainement.autresChapitres')} onPress={retour} />
      ) : null}
      {etat.statut === 'pret' && liste.length ? (
        <View style={styles.groupe}>
          {liste.map((el) => {
            if (el.type === 'quiz') {
              const score = etat.scores[el.q.id];
              return (
                <CarteListe
                  key={el.q.id}
                  gauche={<PastilleType type="quiz" />}
                  titre={nomQuiz(el.q)}
                  sousTitre={t('entrainement.questions', { n: el.q.questions })}
                  droite={score !== undefined ? <Pastille texte={`${score} %`} vert={score >= SEUIL_VERT} /> : undefined}
                  fini={quizFini(etat, el.q)}
                  onPress={() => void ouvrirQuiz(el.q, String(cours), chapitre)}
                />
              );
            }
            const fait = !!etat.faits[el.e.id];
            return (
              <CarteListe
                key={el.e.id}
                gauche={<PastilleType type="exercice" />}
                titre={titreExercice(el.e.titre, chapitre) || t('entrainement.exerciceN', { n: el.i + 1 })}
                sousTitre={t('entrainement.exerciceRang', { n: el.i + 1, total: etat.exercices.length })}
                droite={fait ? <Pastille texte={t('entrainement.fait')} vert /> : undefined}
                fini={fait}
                onPress={() => router.push({ pathname: '/entrainement/exercice', params: { id: el.e.id, cours: String(cours) } })}
              />
            );
          })}
        </View>
      ) : null}
    </Ecran>
  );
}

function Vide({ texte, bouton, onPress }: { texte: string; bouton: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.vide}>
      <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{texte}</Text>
      <Bouton variante="secondaire" libelle={bouton} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { flex: 1, fontSize: 15, lineHeight: 20 },
  groupe: { gap: espace[4] },
  vide: { gap: espace[5], paddingVertical: espace[8] },
  centre: { textAlign: 'center' },
});
