import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { decoderContenu, normaliserBlocs, type Bloc } from './blocs';
import type { QuestionTiree } from './miniTest';
import { convertir, type LigneMission } from './mission';
import { signalerProgressionLocale } from './progressionLocale';
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

/** Progrès d'un chapitre sans réseau : meilleur score de ses quiz et exercices faits, tirés de la copie du chapitre (il a forcément été ouvert pour jouer). */
export type ProgresChapitre = { meilleur?: number; faits: number; quizFaits: number };

export async function lireProgresChapitres(cours: readonly number[]): Promise<Record<number, ProgresChapitre>> {
  if (!cours.length) return {};
  const [copies, scores, faits] = await Promise.all([AsyncStorage.multiGet(cours.map((c) => `entrainement.cours.${c}`)), lireMeilleursScores(), lireExercicesFaits()]);
  const sortie: Record<number, ProgresChapitre> = {};
  copies.forEach(([, brut], k) => {
    if (!brut) return;
    try {
      const e = JSON.parse(brut) as { quiz: QuizLibre[]; exercices: Exercice[] };
      const notes = e.quiz.map((q) => scores[q.id]).filter((n): n is number => n !== undefined);
      sortie[cours[k]] = { meilleur: notes.length ? Math.max(...notes) : undefined, faits: e.exercices.filter((x) => faits[x.id]).length, quizFaits: notes.length };
    } catch {
      // copie illisible : on l'ignore
    }
  });
  return sortie;
}

export const CLE_DERNIER = 'entrainement.dernier';
/** Dernier quiz ou exercice ouvert : carte « Reprendre » en tête de S'entraîner, et une copie par type pour l'accueil. */
export type Dernier = { type: 'quiz' | 'exercice'; id: string; cours: number; chapitre: string; quand?: number };
export type DernierLu = Dernier & { nom: string; numero?: number; meilleur?: number; rang: number; total: number; fait?: boolean };

export async function noterDernier(d: Dernier, maintenant = Date.now()): Promise<void> {
  const brut = JSON.stringify({ ...d, quand: maintenant });
  await AsyncStorage.multiSet([
    [CLE_DERNIER, brut],
    [`${CLE_DERNIER}.${d.type}`, brut],
  ]).catch(() => {});
}

/** Le dernier entraînement avec son titre et le meilleur score, lus dans la copie du chapitre ; null s'il n'y en a pas. */
export const lireDernier = (type?: Dernier['type']) => lireDernierDe(type ? `${CLE_DERNIER}.${type}` : CLE_DERNIER);

async function lireDernierDe(cle: string): Promise<DernierLu | null> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    if (!brut) return null;
    const d = JSON.parse(brut) as Dernier;
    const copie = await AsyncStorage.getItem(`entrainement.cours.${d.cours}`);
    if (!copie) return null;
    const e = JSON.parse(copie) as { quiz: QuizLibre[]; exercices: Exercice[] };
    if (d.type === 'quiz') {
      const q = e.quiz.find((x) => x.id === d.id);
      if (!q) return null;
      const scores = await lireMeilleursScores();
      return { ...d, nom: q.nom, numero: q.numero, meilleur: scores[q.id], rang: e.quiz.indexOf(q) + 1, total: e.quiz.length };
    }
    const k = e.exercices.findIndex((x) => x.id === d.id);
    if (k < 0) return null;
    const faits = await lireExercicesFaits();
    return { ...d, nom: e.exercices[k].titre, rang: k + 1, total: e.exercices.length, fait: !!faits[d.id] };
  } catch {
    return null;
  }
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
  signalerProgressionLocale();
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
  signalerProgressionLocale();
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
export type SessionQuiz = { le: string; score: number; total: number; questions: QuestionTiree[]; reponses: (number | null)[]; dureeS?: number };
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
  signalerProgressionLocale();
  return enregistrerScore(quiz, score, s.questions.length);
}

export type ProgressionEntrainement = {
  quiz_scores: Record<string, number>;
  exercises_done: Record<string, true>;
  quiz_sessions: Record<string, SessionQuiz[]>;
};

export async function lireProgressionEntrainement(): Promise<ProgressionEntrainement> {
  return {
    quiz_scores: await lireMeilleursScores(),
    exercises_done: await lireExercicesFaits(),
    quiz_sessions: await lireObjet<SessionQuiz[]>(CLE_SESSIONS),
  };
}

export async function appliquerProgressionEntrainement(distante: ProgressionEntrainement): Promise<void> {
  const locale = await lireProgressionEntrainement();
  const scores = { ...locale.quiz_scores };
  for (const [quiz, score] of Object.entries(distante.quiz_scores)) {
    scores[quiz] = Math.max(scores[quiz] ?? 0, score);
  }
  const faits = { ...locale.exercises_done, ...distante.exercises_done };
  const sessions = { ...locale.quiz_sessions };
  for (const [quiz, tentatives] of Object.entries(distante.quiz_sessions)) {
    const parDate = new Map<string, SessionQuiz>();
    for (const session of [...(sessions[quiz] ?? []), ...tentatives]) parDate.set(session.le, session);
    sessions[quiz] = [...parDate.values()].sort((a, b) => b.le.localeCompare(a.le)).slice(0, MAX_SESSIONS);
  }
  await AsyncStorage.multiSet([
    [CLE_SCORES, JSON.stringify(scores)],
    [CLE_EXERCICES_FAITS, JSON.stringify(faits)],
    [CLE_SESSIONS, JSON.stringify(sessions)],
  ]);
}

/** Exercice complet : contexte, énoncé et corrigé en blocs (même format que les leçons). */
/** `aCorrige` : un corrigé existe ; il ne s'ouvre qu'avec `ouvrirCorrige` (crédits, M18-04). */
export type DetailExercice = { id: string; titre: string; contexte: Bloc[]; enonce: Bloc[]; aCorrige: boolean; difficulte?: Difficulte };
export type Difficulte = 'facile' | 'moyen' | 'difficile';

const texteBloc = (b: Bloc) => ('segments' in b ? b.segments.map((x) => x.texte).join('') : '');
const META = /^\s*(titre|description|difficult[ée])\s*:\s*/i;

/**
 * Beaucoup d'énoncés commencent par des lignes brutes « Titre : … », « Description : … », « Difficulté : … »
 * (revue design, écran 5 v2). Le titre est déjà en en-tête, la difficulté passe en pastille ; la description reste
 * comme question, sans son étiquette.
 */
export function separerMeta(blocs: readonly Bloc[]): { enonce: Bloc[]; difficulte?: Difficulte } {
  let difficulte: Difficulte | undefined;
  const enonce: Bloc[] = [];
  for (const b of blocs) {
    const m = (b.type === 'paragraphe' || b.type === 'puce') && META.exec(texteBloc(b));
    if (!m) {
      enonce.push(b);
      continue;
    }
    const valeur = texteBloc(b).slice(m[0].length).trim();
    const cle = m[1].toLowerCase();
    if (cle.startsWith('difficult')) {
      const v = valeur.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      difficulte = /diffic/.test(v) ? 'difficile' : /moyen|interm/.test(v) ? 'moyen' : /facile|simple/.test(v) ? 'facile' : difficulte;
    } else if (cle === 'description' && valeur) {
      enonce.push({ type: 'paragraphe', segments: [{ texte: valeur }], retrait: 0 });
    }
  }
  return { enonce, difficulte };
}

export async function lireExercice(client: Client, exercice: string, description = ''): Promise<DetailExercice> {
  const detail = await lireExerciceBrut(client, exercice, description);
  const { enonce, difficulte } = separerMeta(detail.enonce);
  return { ...detail, enonce, difficulte };
}

async function lireExerciceBrut(client: Client, exercice: string, description: string): Promise<DetailExercice> {
  return avecCopie(`entrainement.exercice.${exercice}`, async () => {
    type Ligne = {
      exercise_id: string;
      title: string;
      statement: string | null;
      context: unknown;
      context_compressed: string | null;
      content: unknown;
      content_compressed: string | null;
      has_correction: boolean | null;
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
      aCorrige: !!l.has_correction,
    };
  });
}

/** Blocs du corrigé renvoyés par `depenser_credits('exercise_solution')`. */
export function blocsCorrige(contenu: { correction?: unknown; correction_compressed?: string | null } | null): Bloc[] {
  if (!contenu) return [];
  return normaliserBlocs(decoderContenu({ compresse: contenu.correction_compressed ?? null, brut: contenu.correction ?? null }));
}
