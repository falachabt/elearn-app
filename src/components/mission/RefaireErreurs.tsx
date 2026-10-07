import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { enregistrerCorrection, lireCorrection, statuts } from '@/services/correction';
import { appliquerRefaire } from '@/services/refaire';
import { getSupabase } from '@/services/supabase';
import { lireErreurs } from '@/services/mission';
import type { QuestionTiree } from '@/services/miniTest';

import { EcranVide } from '../EcranVide';
import { MiniTest } from '../arrivee/MiniTest';

const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** « Refaire mes erreurs » (M4-03, M5-10) : les questions ratées du dernier quiz, sans toucher à la série ; les nouvelles réponses mettent à jour ce quiz. */
export function RefaireErreurs() {
  const { t } = useTraduction();
  const [questions, setQuestions] = useState<QuestionTiree[] | null>(null);

  useEffect(() => {
    let actif = true;
    // Les questions ratées du dernier quiz terminé, quel qu'il soit ; sinon celles de la dernière mission.
    void (async () => {
      let ratees: QuestionTiree[] = [];
      try {
        const c = await lireCorrection();
        ratees = c ? c.questions.filter((_, i) => statuts(c)[i] !== 'juste') : await lireErreurs();
      } catch {
        // Lecture impossible : l'écran « aucune erreur » vaut mieux qu'une page blanche.
      }
      if (actif) setQuestions(ratees);
    })();
    return () => {
      actif = false;
    };
  }, []);

  if (!questions) return null;
  if (!questions.length) return <EcranVide titre={t('mission.aucuneErreur')} phrase={t('mission.aucuneErreurTexte')} />;

  return (
    <MiniTest
      questions={questions}
      libelleFin={t('mission.fin')}
      libelleFermer={t('mission.fermer')}
      onFermer={retour}
      onTermine={async ({ questions: q, reponses }) => {
        suivre('mission_errors_retried', { score: q.filter((x, i) => reponses[i] === x.bonne).length, total: q.length });
        // La session d'origine est mise à jour, puis on y revient : grille, score et compteurs recalculés.
        const misAJour = await appliquerRefaire({ questions: q, reponses }, getSupabase()).catch(() => null);
        if (misAJour && router.canGoBack()) return router.back();
        // Session à part seulement quand il n'y a vraiment aucune session d'origine à mettre à jour.
        if (!misAJour && !(await lireCorrection())) await enregistrerCorrection({ source: 'erreurs', questions: q, reponses });
        router.replace('/quiz/resultats');
      }}
    />
  );
}
