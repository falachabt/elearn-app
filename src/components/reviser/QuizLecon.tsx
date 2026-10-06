import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { noterActionConfiguration } from '@/services/assistantConfiguration';
import { suivre } from '@/services/analytics';
import { apresDerniereLecon } from '@/services/entrainement';
import { enregistrerCorrection, lireCorrection, statuts as statutsDe, type StatutQuestion } from '@/services/correction';
import type { QuestionTiree } from '@/services/miniTest';
import { lireQuizLecon, marquerLue, quizReussi } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Apparition } from '../Apparition';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Rebond } from '../Rebond';
import { BoutonFermer, MiniTest } from '../arrivee/MiniTest';
import { ResultatsQuiz } from '../quiz/ResultatsQuiz';

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | { statut: 'vide' }
  | { statut: 'quiz'; questions: QuestionTiree[] }
  | { statut: 'fini'; score: number; total: number; statuts: StatutQuestion[] };

/**
 * 3 questions pour valider une leçon (M5-01) : même lecteur que la mission. 2 bonnes réponses sur 3 valident la
 * leçon (elle compte dans la progression) ; sinon, relire ou réessayer. Une leçon sans questions est validée d'office.
 */
export function QuizLecon() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, lecon, suivante, matiere } = useLocalSearchParams<{ cours: string; lecon: string; suivante?: string; matiere?: string }>();
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireQuizLecon(getSupabase(), { cours: Number(cours), lecon: Number(lecon), vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') } })
      .then(async (questions) => {
        if (!questions.length) await marquerLue(Number(lecon), Number(cours), getSupabase());
        if (actif) setEtat(questions.length ? { statut: 'quiz', questions } : { statut: 'vide' });
      })
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
    // Libellés Vrai/Faux figés au tirage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cours, lecon, pret, essai]);

  // Au retour de « Refaire mes erreurs » : la correction de cette leçon a été mise à jour (score, grille, validation).
  const fini = etat.statut === 'fini';
  useFocusEffect(
    useCallback(() => {
      if (!fini) return;
      let actif = true;
      lireCorrection()
        .then((c) => {
          if (!actif || c?.contexte?.type !== 'lecon' || c.contexte.lecon !== Number(lecon)) return;
          const s = statutsDe(c);
          setEtat({ statut: 'fini', score: s.filter((x) => x === 'juste').length, total: s.length, statuts: s });
        })
        .catch(() => {});
      return () => {
        actif = false;
      };
    }, [fini, lecon]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

  if (etat.statut === 'quiz') {
    return (
      <MiniTest
        questions={etat.questions}
        libelleFin={t('reviser.quizTerminer')}
        libelleFermer={t('reviser.quizFermer')}
        onFermer={retour}
        onTermine={async ({ questions, reponses }) => {
          const score = questions.filter((q, i) => reponses[i] === q.bonne).length;
          suivre('lesson_quiz_completed', { score, total: questions.length });
          // La correction est enregistrée AVANT tout le reste : c'est elle que « Refaire mes erreurs » relit. Si une
          // écriture suivante échouait (stockage hors ligne), elle ne doit pas empêcher ce relecture — sans quoi
          // l'écran de reprise annoncerait « aucune erreur » alors qu'il y en a.
          await enregistrerCorrection({ source: 'lecon', questions, reponses, contexte: { type: 'lecon', lecon: Number(lecon), cours: Number(cours) } });
          void noterActionConfiguration('quiz').catch((erreur: unknown) => console.warn('Impossible d’enregistrer cette étape de configuration.', erreur));
          // Attendue : au retour sur le chapitre, la case de la leçon doit déjà être cochée. Un échec local ne bloque pas le score.
          if (quizReussi(score, questions.length)) await marquerLue(Number(lecon), Number(cours), getSupabase(), { score, total: questions.length }).catch(() => {});
          setEtat({ statut: 'fini', score, total: questions.length, statuts: statutsDe({ questions, reponses }) });
        }}
      />
    );
  }

  const reussi = etat.statut === 'fini' && quizReussi(etat.score, etat.total);
  const valide = reussi || etat.statut === 'vide';
  const allerSuivante = () => router.replace({ pathname: '/cours/lecon', params: { id: String(suivante), cours: String(cours), matiere: matiere ?? '' } });
  const reessayer = () => {
    setEtat({ statut: 'chargement' });
    setEssai((n) => n + 1);
  };
  const pied =
    etat.statut === 'chargement' ? undefined : (
      <View style={styles.pied}>
        {valide && suivante ? <Bouton libelle={t('reviser.quizSuivante')} onPress={allerSuivante} retour /> : null}
        {valide && !suivante ? <Bouton libelle={t('reviser.finChapitre')} onPress={() => void apresDerniereLecon(Number(cours), () => router.replace({ pathname: '/cours/fin', params: { cours: String(cours) } }), retour)} retour /> : null}
        {etat.statut === 'fini' && !reussi ? <Bouton libelle={t('reviser.quizReessayer')} onPress={reessayer} /> : null}
        <Bouton variante={valide ? 'secondaire' : etat.statut === 'fini' && !reussi ? 'secondaire' : undefined} libelle={t('reviser.quizRetour')} onPress={retour} />
      </View>
    );
  return (
    <Ecran pied={pied} entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
      {etat.statut === 'chargement' ? <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('reviser.quizChargement')}</Text> : null}
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('reviser.quizErreur')} /> : null}
      {etat.statut === 'vide' ? <Banniere ton="info" titre={t('reviser.quizVide')} /> : null}
      {etat.statut === 'fini' ? (
        <Apparition>
          <View style={styles.resultat}>
            <Rebond declencheur={1} echelle={1.08} moment={reussi ? 'celebrate' : 'success'}>
              <View style={[styles.pastille, { backgroundColor: reussi ? theme.marque.principale : theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Ionicons name={reussi ? 'checkmark' : 'book-outline'} size={34} color={theme.texte.surCouleur} />
              </View>
            </Rebond>
            <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('reviser.quizScore', { score: etat.score, total: etat.total })}</Text>
            <Text style={[typo.texte, styles.texte, { color: theme.texte.secondaire }]}>{t(reussi ? 'reviser.quizValidee' : 'reviser.quizNonValidee')}</Text>
          </View>
          <ResultatsQuiz statuts={etat.statuts} />
        </Apparition>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center', marginTop: espace[8] },
  resultat: { alignItems: 'center', gap: espace[4], marginTop: espace[7] },
  pastille: { width: 72, height: 72, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { textAlign: 'center' },
  pied: { gap: espace[3] },
});
