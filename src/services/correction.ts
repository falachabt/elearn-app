import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuestionTiree } from './miniTest';

/** Dernier quiz terminé (mission, leçon, erreurs, quiz libre) : de quoi revoir chaque question hors ligne (M5-10). */
export type Correction = { source: 'mission' | 'lecon' | 'erreurs' | 'libre'; questions: QuestionTiree[]; reponses: (number | null)[]; contexte?: ContexteCorrection };
/** D'où vient le quiz : « Refaire mes erreurs » met à jour cette session (leçon validée, résultat de mission, session du quiz). */
export type ContexteCorrection = { type: 'lecon'; lecon: number; cours: number } | { type: 'mission' } | { type: 'libre'; quiz: string; le: string };
export type StatutQuestion = 'juste' | 'faux' | 'passe';

export const CLE_CORRECTION = 'quiz.correction';

export function statutQuestion(q: QuestionTiree, reponse: number | null | undefined): StatutQuestion {
  if (reponse === null || reponse === undefined || reponse < 0) return 'passe';
  return reponse === q.bonne ? 'juste' : 'faux';
}

export function statuts(c: Pick<Correction, 'questions' | 'reponses'>): StatutQuestion[] {
  return c.questions.map((q, i) => statutQuestion(q, c.reponses[i]));
}

export async function enregistrerCorrection(c: Correction): Promise<void> {
  await AsyncStorage.setItem(CLE_CORRECTION, JSON.stringify(c)).catch(() => {});
}

export async function lireCorrection(): Promise<Correction | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_CORRECTION);
    return brut ? (JSON.parse(brut) as Correction) : null;
  } catch {
    return null;
  }
}
