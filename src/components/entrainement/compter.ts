import type { Compteur } from '@/services/entrainement';

type T = (cle: 'entrainement.unQuiz' | 'entrainement.nQuiz' | 'entrainement.unExercice' | 'entrainement.nExercices', p?: { n: number }) => string;

/** « 2 quiz · 5 exercices », sans les parties vides. */
export function decrireCompteur(t: T, c: Compteur): string {
  return [
    c.quiz ? (c.quiz === 1 ? t('entrainement.unQuiz') : t('entrainement.nQuiz', { n: c.quiz })) : null,
    c.exercices ? (c.exercices === 1 ? t('entrainement.unExercice') : t('entrainement.nExercices', { n: c.exercices })) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
