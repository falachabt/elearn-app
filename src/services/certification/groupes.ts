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

/**
 * Indices, dans la séance, de tout le groupe qui contient `index` (avant et après). Sert aux onglets de la série, où les
 * questions déjà corrigées restent consultables. Une question sans groupe forme un groupe de une.
 */
export function indicesGroupe(questions: QuestionServie[], index: number): number[] {
  const premiere = questions[index];
  if (!premiere) return [];
  if (!premiere.group) return [index];
  let debut = index;
  while (debut > 0 && questions[debut - 1]?.group?.id === premiere.group.id) debut--;
  const indices: number[] = [];
  for (let i = debut; i < questions.length && questions[i]?.group?.id === premiere.group.id; i++) indices.push(i);
  return indices;
}

/** Numéros officiels des questions d'un groupe, sans les questions qui n'en ont pas (sert aux trous d'un texte à trous). */
export const numerosDuGroupe = (membres: QuestionServie[]): number[] => membres.flatMap((m) => (m.number === null ? [] : [m.number]));
