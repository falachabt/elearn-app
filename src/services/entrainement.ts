import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { decoderContenu, normaliserBlocs, type Bloc } from './blocs';
import type { QuestionTiree } from './miniTest';
import { convertir, type LigneMission } from './mission';
import { avecCopie, rpc } from './reviser';

type Client = Pick<SupabaseClient, 'rpc'>;

/** Entraînement libre (M5-09) : les quiz et les exercices d'un chapitre, à refaire à volonté. */
export type QuizLibre = { id: string; nom: string; questions: number; numero?: number };
export type Exercice = { id: string; titre: string; enonce: string };
export type Compteur = { quiz: number; exercices: number };

export const TAILLE_QUIZ_LIBRE = 20;

/** « 10mouvement dans… » → numéro 10 et « Mouvement dans… » : les quiz sont souvent numérotés collés au titre. */
export function nettoyerNomQuiz(brut: string): { nom: string; numero?: number } {
  const nom = brut.trim();
  const m = /^(\d{1,3})\s*[-.:)]?\s*(\p{L}.*)$/u.exec(nom);
  if (!m) return { nom };
  return { nom: m[2].charAt(0).toUpperCase() + m[2].slice(1), numero: Number(m[1]) };
}
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
      quiz: quiz.map((q) => ({ id: q.quiz_id, ...nettoyerNomQuiz(q.name), questions: q.questions })),
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

/** Une partie de quiz libre terminée, gardée pour la revoir depuis la page du quiz. */
export type SessionQuiz = { le: string; score: number; total: number; questions: QuestionTiree[]; reponses: (number | null)[] };
export const CLE_SESSIONS = 'entrainement.sessions';
export const MAX_SESSIONS = 10;

export async function lireSessions(quiz: string): Promise<SessionQuiz[]> {
  return (await lireObjet<SessionQuiz[]>(CLE_SESSIONS))[quiz] ?? [];
}

/** Garde la session en tête de liste (10 au plus par quiz) et met à jour le meilleur score ; true si c'est un record. */
export async function enregistrerSession(quiz: string, s: Omit<SessionQuiz, 'le' | 'score' | 'total'>, maintenant = new Date()): Promise<boolean> {
  const score = s.questions.filter((q, i) => s.reponses[i] === q.bonne).length;
  const toutes = await lireObjet<SessionQuiz[]>(CLE_SESSIONS);
  const session: SessionQuiz = { le: maintenant.toISOString(), score, total: s.questions.length, ...s };
  await AsyncStorage.setItem(CLE_SESSIONS, JSON.stringify({ ...toutes, [quiz]: [session, ...(toutes[quiz] ?? [])].slice(0, MAX_SESSIONS) }));
  return enregistrerScore(quiz, score, s.questions.length);
}

/** Exercice complet : contexte, énoncé et corrigé en blocs (même format que les leçons). */
export type DetailExercice = { id: string; titre: string; contexte: Bloc[]; enonce: Bloc[]; corrige: Bloc[] };

export async function lireExercice(client: Client, exercice: string, description = ''): Promise<DetailExercice> {
  return avecCopie(`entrainement.exercice.${exercice}`, async () => {
    type Ligne = {
      exercise_id: string;
      title: string;
      statement: string | null;
      context: unknown;
      context_compressed: string | null;
      content: unknown;
      content_compressed: string | null;
      correction: unknown;
      correction_compressed: string | null;
    };
    const [l] = await rpc<Ligne>(client, 'exercise_detail', { p_exercise: exercice });
    if (!l) throw new Error('exercice introuvable');
    const blocs = (compresse: string | null, brut: unknown) => normaliserBlocs(decoderContenu({ compresse, brut }));
    const enonce = blocs(l.content_compressed, l.content);
    const texte = (l.statement ?? description).trim();
    return {
      id: l.exercise_id,
      titre: l.title.trim(),
      contexte: blocs(l.context_compressed, l.context),
      // Sans énoncé structuré, la description en sert.
      enonce: enonce.length ? enonce : texte ? [{ type: 'paragraphe', segments: [{ texte }], retrait: 0 }] : [],
      corrige: blocs(l.correction_compressed, l.correction),
    };
  });
}
