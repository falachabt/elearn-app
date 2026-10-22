import type { TentativeListee, Tentative } from './types';

/** Suivi d'un type de test : combien de fois il est fait, et le résultat de la dernière tentative terminée. */
export type SuiviTest = { fois: number; derniere: TentativeListee | null };

/** Une tentative correspond à un type donné (demi-test écoute, mini-test mixte, etc.). */
export function correspond(t: TentativeListee, kind: Tentative['kind'], part?: number | null): boolean {
  if (t.kind !== kind) return false;
  return part === undefined || t.part === part;
}

/** Suivi d'un type de test à partir de la liste des tentatives (la plus récente d'abord). Les tentatives abandonnées ne comptent pas. */
export function suiviDe(liste: TentativeListee[], kind: Tentative['kind'], part?: number | null): SuiviTest {
  const finies = liste.filter((t) => t.status === 'finished' && correspond(t, kind, part));
  return { fois: finies.length, derniere: finies[0] ?? null };
}
