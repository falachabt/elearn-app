import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireErreurs } from '@/services/mission';
import type { QuestionTiree } from '@/services/miniTest';

import { EcranVide } from '../EcranVide';
import { MiniTest } from '../arrivee/MiniTest';

const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** « Refaire mes erreurs » (M4-03) : les questions ratées de la dernière mission, sans toucher à la série. */
export function RefaireErreurs() {
  const { t } = useTraduction();
  const [questions, setQuestions] = useState<QuestionTiree[] | null>(null);

  useEffect(() => {
    let actif = true;
    lireErreurs().then((q) => actif && setQuestions(q));
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
      onTermine={({ questions: q, reponses }) => {
        suivre('mission_errors_retried', { score: q.filter((x, i) => reponses[i] === x.bonne).length, total: q.length });
        retour();
      }}
    />
  );
}
