import type { Reglages } from './reglages';

/** F1 / F2 : score estimé sur 990 et fourchette. Même calcul que `cert_score_range` côté serveur. */
export type Section = { bonnes: number; repondues: number };
export type PlageScore =
  | { estime: false; reponses: number }
  | { estime: true; score: number; min: number; max: number };

const arrondir5 = (x: number) => Math.round(x / 5) * 5;

/** Score d'une section pour une proportion p : clamp(5, 495, 5 + 490 p), au multiple de 5 le plus proche. */
export function scoreSection(p: number): number {
  return arrondir5(Math.min(495, Math.max(5, 5 + 490 * p)));
}

/** Intervalle de Wilson ; une section sans réponse vaut [0 ; 1]. */
export function wilson(bonnes: number, repondues: number, z: number): [number, number] {
  if (repondues <= 0) return [0, 1];
  const n = repondues;
  const p = Math.min(1, Math.max(0, bonnes / n));
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const demi = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - demi), Math.min(1, centre + demi)];
}

export function plageScore(listening: Section, reading: Section, r: Pick<Reglages, 'scoreZ' | 'scoreMinReponses'>): PlageScore {
  const total = listening.repondues + reading.repondues;
  if (total < r.scoreMinReponses) return { estime: false, reponses: total };
  const [ll, lh] = wilson(listening.bonnes, listening.repondues, r.scoreZ);
  const [rl, rh] = wilson(reading.bonnes, reading.repondues, r.scoreZ);
  const proportion = (s: Section) => (s.repondues === 0 ? 0 : s.bonnes / s.repondues);
  const bas = scoreSection(ll) + scoreSection(rl);
  const haut = scoreSection(lh) + scoreSection(rh);
  return {
    estime: true,
    score: scoreSection(proportion(listening)) + scoreSection(proportion(reading)),
    min: Math.min(990, Math.max(10, Math.floor(bas / 10) * 10)),
    max: Math.min(990, Math.max(10, Math.ceil(haut / 10) * 10)),
  };
}

/** Section d'une partie : Listening = P1 à P4, Reading = P5 à P7. */
export const sectionDe = (partie: number): 'listening' | 'reading' => (partie <= 4 ? 'listening' : 'reading');
