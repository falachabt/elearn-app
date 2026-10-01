import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { QuestionTiree } from './miniTest';
import { convertir, type LigneMission } from './mission';
import { avecCopie, rpc } from './reviser';

type Client = Pick<SupabaseClient, 'rpc'>;

/** Entraînement libre (M5-09) : les quiz et les exercices d'un chapitre, à refaire à volonté. */
export type QuizLibre = { id: string; nom: string; questions: number };
export type Exercice = { id: string; titre: string; enonce: string };
export type Compteur = { quiz: number; exercices: number };

export const TAILLE_QUIZ_LIBRE = 20;
export const CLE_SCORES = 'entrainement.scores';
export const CLE_EXERCICES_FAITS = 'entrainement.exercicesFaits';

/** Nombre de quiz et d'exercices par chapitre ; les chapitres sans entraînement sont absents. */
export async function lireCompteurs(client: Client, cours: readonly number[], cle: string): Promise<Record<number, Compteur>> {
  if (!cours.length) return {};
  return avecCopie(`entrainement.compteurs.${cle}`, async () => {
    const lignes = await rpc<{ course_id: number; quizzes: number; exercises: number }>(client, 'practice_counts', { p_courses: cours.slice(0, 500) });
    return Object.fromEntries(lignes.map((l) => [l.course_id, { quiz: l.quizzes, exercices: l.exercises }]));
  });
}

export async function lireEntrainement(client: Client, cours: number): Promise<{ quiz: QuizLibre[]; exercices: Exercice[] }> {
  return avecCopie(`entrainement.cours.${cours}`, async () => {
    const [quiz, exercices] = await Promise.all([
      rpc<{ quiz_id: string; name: string; questions: number }>(client, 'course_quizzes', { p_course: cours }),
      rpc<{ exercise_id: string; title: string; statement: string }>(client, 'course_exercises', { p_course: cours }),
    ]);
    return {
      quiz: quiz.map((q) => ({ id: q.quiz_id, nom: q.name.trim(), questions: q.questions })),
      exercices: exercices.map((e) => ({ id: e.exercise_id, titre: e.title.trim(), enonce: e.statement.trim() })),
    };
  });
}

/** Une partie d'un quiz : ses questions mélangées, 20 au plus. En ligne seulement. */
export async function lireQuizLibre(client: Client, p: { quiz: string; vraiFaux: { vrai: string; faux: string } }): Promise<QuestionTiree[]> {
  const lignes = await rpc<LigneMission>(client, 'practice_quiz', { p_quiz: p.quiz, p_size: TAILLE_QUIZ_LIBRE });
  return lignes.map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => q !== null);
}

async function lireObjet<T>(cle: string): Promise<Record<string, T>> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

/** Meilleur score par quiz, en pourcentage. */
export const lireMeilleursScores = () => lireObjet<number>(CLE_SCORES);

/** Garde le meilleur score du quiz ; renvoie true si c'est un nouveau record. */
export async function enregistrerScore(quiz: string, score: number, total: number): Promise<boolean> {
  if (!total) return false;
  const scores = await lireMeilleursScores();
  const pct = Math.round((score / total) * 100);
  if ((scores[quiz] ?? -1) >= pct) return false;
  await AsyncStorage.setItem(CLE_SCORES, JSON.stringify({ ...scores, [quiz]: pct }));
  return true;
}

export const lireExercicesFaits = () => lireObjet<true>(CLE_EXERCICES_FAITS);

export async function basculerExerciceFait(exercice: string): Promise<boolean> {
  const faits = await lireExercicesFaits();
  const fait = !faits[exercice];
  const suite = { ...faits };
  if (fait) suite[exercice] = true;
  else delete suite[exercice];
  await AsyncStorage.setItem(CLE_EXERCICES_FAITS, JSON.stringify(suite));
  return fait;
}

export const CLE_FINS_VUES = 'entrainement.finsVues';

/** La fin d'un chapitre terminé ne s'affiche qu'une fois (M5-11) ; l'entraînement reste ouvert depuis le chapitre. */
export async function finChapitreVue(cours: number): Promise<boolean> {
  return !!(await lireObjet<true>(CLE_FINS_VUES))[cours];
}

export async function noterFinChapitreVue(cours: number): Promise<void> {
  const vues = await lireObjet<true>(CLE_FINS_VUES);
  if (!vues[cours]) await AsyncStorage.setItem(CLE_FINS_VUES, JSON.stringify({ ...vues, [cours]: true }));
}

/** Après la dernière leçon : la fin de chapitre si elle n'a pas encore été vue, sinon le retour habituel. */
export async function apresDerniereLecon(cours: number, aller: () => void, retour: () => void): Promise<void> {
  if (await finChapitreVue(cours)) retour();
  else aller();
}
