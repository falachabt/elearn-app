import { lireDernier, type DernierLu } from './entrainement';
import { lireDerniereLecon, lireLues, nomCourt, type Cours, type DerniereLecon } from './reviser';

/** Seuil au-delà duquel un quiz compte comme fini (même règle que la liste du chapitre). */
export const QUIZ_FINI = 80;

export type ElementReprise =
  | { type: 'lecon'; quand: number; matiere: string; chapitre: string; lecon: DerniereLecon }
  | { type: 'quiz' | 'exercice'; quand: number; matiere: string; chapitre: string; dernier: DernierLu };

/**
 * Accueil · Reprendre (C1) : la dernière leçon, le dernier quiz et le dernier exercice commencés et pas finis, un par
 * type au plus, du plus récent au plus ancien. `cours` sert à retrouver la matière et le nom du chapitre.
 */
export async function lireReprise(cours: readonly Cours[]): Promise<ElementReprise[]> {
  const [lecon, quiz, exercice, lues] = await Promise.all([lireDerniereLecon(), lireDernier('quiz'), lireDernier('exercice'), lireLues()]);
  const contexte = (id: number) => {
    const c = cours.find((x) => x.id === id);
    return { matiere: c ? nomCourt(c.matiere) : '', chapitre: c?.nom ?? '' };
  };
  const sortie: ElementReprise[] = [];
  if (lecon && lues[lecon.id] === undefined) sortie.push({ type: 'lecon', quand: lecon.quand, ...contexte(lecon.cours), lecon });
  if (quiz && (quiz.meilleur ?? 0) < QUIZ_FINI) sortie.push({ type: 'quiz', quand: quiz.quand ?? 0, ...contexte(quiz.cours), dernier: quiz });
  if (exercice && !exercice.fait) sortie.push({ type: 'exercice', quand: exercice.quand ?? 0, ...contexte(exercice.cours), dernier: exercice });
  return sortie.sort((a, b) => b.quand - a.quand);
}
