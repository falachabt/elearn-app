import type { ProgressionTest, TentativeListee, Tentative } from './types';

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

/**
 * Progression d'un demi-test sur la carte (maquette v33) : une moitié en cours d'abord, puis une interrompue (elle
 * n'a alors aucune moitié en cours), puis la plus récemment faite, sinon l'écoute.
 */
export function progressionDemi(liste: ProgressionTest[]): ProgressionTest | undefined {
  const moities = liste.filter((p) => p.kind !== 'full');
  const trouver = (statut: ProgressionTest['statut']) => moities.find((p) => p.statut === statut);
  const enCours = trouver('en_cours');
  if (enCours) return enCours;
  const interrompue = trouver('interrompu');
  if (interrompue) return interrompue;
  const faites = moities.filter((p) => p.derniereDate).sort((a, b) => (b.derniereDate ?? '').localeCompare(a.derniereDate ?? ''));
  return faites[0] ?? moities.find((p) => p.kind === 'half_listening');
}

/** Tentatives d'un type de test (demi-tests : écoute et lecture ; complet), la plus récente d'abord. */
export function tentativesDeType(liste: TentativeListee[], type: 'half' | 'full'): TentativeListee[] {
  const kinds: Tentative['kind'][] = type === 'full' ? ['full'] : ['half_listening', 'half_reading'];
  return liste.filter((t) => kinds.includes(t.kind)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Meilleur score d'un type : seules les tentatives terminées comptent. Une tentative interrompue n'écrase ni le meilleur
 * score ni le dernier (maquette v33).
 */
export function meilleurScore(liste: TentativeListee[]): number | null {
  const scores = liste.filter((t) => t.status === 'finished' && t.score !== null && t.score !== undefined).map((t) => t.score as number);
  return scores.length ? Math.max(...scores) : null;
}
