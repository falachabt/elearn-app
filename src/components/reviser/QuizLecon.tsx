import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import type { QuestionTiree } from '@/services/miniTest';
import { lireQuizLecon } from '@/services/reviser';
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

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | { statut: 'vide' }
  | { statut: 'quiz'; questions: QuestionTiree[] }
  | { statut: 'fini'; score: number; total: number };

/** 3 questions pour vérifier une leçon (M5-01) : même lecteur que la mission, score à la fin. */
export function QuizLecon() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, lecon } = useLocalSearchParams<{ cours: string; lecon: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireQuizLecon(getSupabase(), { cours: Number(cours), lecon: Number(lecon), vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') } })
      .then((questions) => actif && setEtat(questions.length ? { statut: 'quiz', questions } : { statut: 'vide' }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
    // Libellés Vrai/Faux figés au tirage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cours, lecon, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

  if (etat.statut === 'quiz') {
    return (
      <MiniTest
        questions={etat.questions}
        libelleFin={t('reviser.quizTerminer')}
        libelleFermer={t('reviser.quizFermer')}
        onFermer={retour}
        onTermine={({ questions, reponses }) => {
          const score = questions.filter((q, i) => reponses[i] === q.bonne).length;
          suivre('lesson_quiz_completed', { score, total: questions.length });
          setEtat({ statut: 'fini', score, total: questions.length });
        }}
      />
    );
  }

  const reussi = etat.statut === 'fini' && etat.score === etat.total;
  return (
    <Ecran pied={etat.statut === 'chargement' ? undefined : <Bouton libelle={t('reviser.quizRetour')} onPress={retour} retour />}>
      <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
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
            <Text style={[typo.texte, styles.texte, { color: theme.texte.secondaire }]}>{t(reussi ? 'reviser.quizBravo' : 'reviser.quizRelire')}</Text>
          </View>
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
});
