import type { QuestionServie } from './types';

/**
 * Questions d'un même groupe (audio ou texte et ses questions), à partir de `index`, dans l'ordre servi. Une question sans
 * groupe forme un groupe de une. Les réponses d'un groupe se valident ensemble (« Groupe suivant »), l'audio se joue une fois.
 */
export function membresGroupe(questions: QuestionServie[], index: number): QuestionServie[] {
  const premiere = questions[index];
  if (!premiere) return [];
  if (!premiere.group) return [premiere];
  const membres: QuestionServie[] = [];
  for (let i = index; i < questions.length; i++) {
    const q = questions[i];
    if (!q || q.group?.id !== premiere.group.id) break;
    membres.push(q);
  }
  return membres;
}
