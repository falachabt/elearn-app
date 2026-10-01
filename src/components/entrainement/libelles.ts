import type { useTraduction } from '@/i18n/useTraduction';
import { titreQuiz } from '@/services/titres';

type T = ReturnType<typeof useTraduction>['t'];

/** « Quiz 2 · Circuits », « Quiz 3 », « Quiz du chapitre » ou « Quiz du chapitre 2 » (revue design, règle 6). */
/** `rang` : numéro d'ordre parmi les quiz sans nom du chapitre, quand il y en a plusieurs (« Quiz du chapitre 2 »). */
export function libelleQuiz(t: T, nom: string, chapitre: string, numero?: number, rang?: number): string {
  const { corps, numero: n } = titreQuiz(nom, chapitre, numero);
  if (corps) return n ? t('entrainement.titreQuizN', { n, titre: corps }) : t('entrainement.titreQuiz', { titre: corps });
  if (n) return t('entrainement.etiquetteQuizN', { n });
  return rang ? t('entrainement.quizChapitreN', { n: rang }) : t('entrainement.quizChapitre');
}

/** Rang de chaque quiz « sans nom » d'une liste, seulement s'il y en a plusieurs. */
export function rangsSansNom(quiz: readonly { id: string; nom: string; numero?: number }[], chapitre: string): Record<string, number> {
  const sansNom = quiz.filter((q) => {
    const r = titreQuiz(q.nom, chapitre, q.numero);
    return !r.corps && !r.numero;
  });
  return sansNom.length > 1 ? Object.fromEntries(sansNom.map((q, i) => [q.id, i + 1])) : {};
}
