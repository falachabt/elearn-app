import { router } from 'expo-router';

import { lireSessions, type QuizLibre } from '@/services/entrainement';

/** Premier passage : la session démarre tout de suite. Ensuite : la page du quiz, avec les sessions passées. */
export async function ouvrirQuiz(q: QuizLibre, cours: string, nom: string): Promise<void> {
  const params = { id: q.id, cours, nom };
  if ((await lireSessions(q.id)).length) {
    router.push({ pathname: '/entrainement/detail', params: { ...params, titre: q.nom, questions: String(q.questions), numero: q.numero ? String(q.numero) : '' } });
  } else {
    router.push({ pathname: '/entrainement/quiz', params });
  }
}
