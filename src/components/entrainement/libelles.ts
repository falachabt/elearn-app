import type { useTraduction } from '@/i18n/useTraduction';
import { titreQuiz } from '@/services/titres';

type T = ReturnType<typeof useTraduction>['t'];

/** « Quiz 2 · Circuits », « Quiz 3 » ou « Quiz du chapitre » (revue design, règle 6). */
export function libelleQuiz(t: T, nom: string, chapitre: string, numero?: number): string {
  const { corps, numero: n } = titreQuiz(nom, chapitre, numero);
  if (corps) return n ? t('entrainement.titreQuizN', { n, titre: corps }) : t('entrainement.titreQuiz', { titre: corps });
  return n ? t('entrainement.etiquetteQuizN', { n }) : t('entrainement.quizChapitre');
}
