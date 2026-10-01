import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { enregistrerCorrection } from '@/services/correction';
import { enregistrerSession, lireQuizLibre } from '@/services/entrainement';
import type { QuestionTiree } from '@/services/miniTest';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { BoutonFermer, MiniTest } from '../arrivee/MiniTest';

const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

/** Quiz libre (M5-09) : même lecteur que la mission, résultats et correction communs (M5-10), sans toucher à la série. */
export function QuizLibreEcran() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, cours, nom } = useLocalSearchParams<{ id: string; cours?: string; nom?: string }>();
  const [questions, setQuestions] = useState<QuestionTiree[] | null | undefined>(undefined);
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireQuizLibre(getSupabase(), { quiz: String(id), vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') } })
      .then((q) => {
        // Le chapitre du quiz, pour « Relire le cours » sur l'écran de résultats.
        const chapitre = cours ? { id: Number(cours), nom: nom ?? '' } : null;
        if (actif) setQuestions(q.length ? q.map((x) => ({ ...x, cours: x.cours ?? chapitre })) : null);
      })
      .catch(() => actif && setQuestions(null));
    return () => {
      actif = false;
    };
    // Libellés Vrai/Faux figés au tirage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cours, pret]);

  if (questions) {
    return (
      <MiniTest
        questions={questions}
        libelleFin={t('entrainement.quizTerminer')}
        libelleFermer={t('entrainement.quizFermer')}
        onFermer={retour}
        onTermine={async ({ questions: q, reponses }) => {
          const score = q.filter((x, i) => reponses[i] === x.bonne).length;
          const record = await enregistrerSession(String(id), { questions: q, reponses });
          suivre('practice_quiz_completed', { score, total: q.length, record });
          await enregistrerCorrection({ source: 'libre', questions: q, reponses });
          router.replace('/quiz/resultats');
        }}
      />
    );
  }
  return (
    <Ecran entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
      {questions === undefined ? <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('entrainement.quizChargement')}</Text> : null}
      {questions === null ? <Banniere ton="erreur" titre={t('entrainement.quizErreur')} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ centre: { textAlign: 'center', marginTop: espace[8] } });
