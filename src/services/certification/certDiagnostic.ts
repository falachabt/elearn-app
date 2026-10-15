import { maitrise, type EtatMaitrise } from './certMaitrise';
import type { Jour } from './jours';
import type { Reglages } from './reglages';
import type { NotionLiee, QuestionServie, ResultatReponse } from './types';

/**
 * Diagnostic (A6 à A7). Ordre : Listening puis Reading, parties P1 à P7, sans mélange à l'intérieur d'une section ; un
 * groupe (audio ou texte et ses questions) reste d'un seul tenant (D-19). Le tri est stable : l'ordre servi dans une
 * partie est conservé.
 */
export function ordonnerDiagnostic(questions: QuestionServie[]): QuestionServie[] {
  return questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) => a.q.part - b.q.part || a.i - b.i)
    .map((x) => x.q);
}

/** Lignes de la carte de maîtrise du résultat (A7) : P1 à P2, P3 à P4, P5, P6, P7. */
export const GROUPES_MAITRISE = [
  { id: 'p1p2', parties: [1, 2] },
  { id: 'p3p4', parties: [3, 4] },
  { id: 'p5', parties: [5] },
  { id: 'p6', parties: [6] },
  { id: 'p7', parties: [7] },
] as const;

export type LigneMaitrise = { id: (typeof GROUPES_MAITRISE)[number]['id']; parties: readonly number[]; repondues: number; bonnes: number; m: number | null; etat: EtatMaitrise };

type ParPartie = Record<string, { answered: number; correct: number }>;

/** F4 regroupée. Toutes les réponses datent d'aujourd'hui : la décroissance ne joue pas, M = bonnes / répondues. */
export function maitriseParGroupe(parPartie: ParPartie, r: Pick<Reglages, 'maitriseFragileSous' | 'maitriseAcquiseDe' | 'maitriseMinReponses' | 'maitriseDemiVieJours'>): LigneMaitrise[] {
  return GROUPES_MAITRISE.map((g) => {
    let repondues = 0;
    let bonnes = 0;
    for (const p of g.parties) {
      repondues += parPartie[String(p)]?.answered ?? 0;
      bonnes += parPartie[String(p)]?.correct ?? 0;
    }
    const reponses = [...Array(repondues)].map((_, i) => ({ juste: i < bonnes, jour: '2000-01-01' as Jour }));
    const m = maitrise(reponses, '2000-01-01', r);
    return { id: g.id, parties: g.parties, repondues, bonnes, m: m.m, etat: m.etat };
  });
}

export type PointFaible =
  | { genre: 'notion'; notion: NotionLiee; partie: number; ratees: number; m: number }
  | { genre: 'vocabulaire'; theme: string | null; mots: number };

/**
 * Trois points à travailler : les notions de plus faible maîtrise parmi celles qui ont au moins une erreur (avec le
 * nombre de questions ratées et leur partie), plus, s'il y a des mots à revoir, une ligne « Vocabulaire ». Jamais plus
 * de trois lignes au total ; moins s'il y a moins de notions ratées.
 */
export function pointsFaibles(
  questions: QuestionServie[],
  resultats: ResultatReponse[],
  mots: { total: number; theme: string | null },
  r: Pick<Reglages, 'maitriseFragileSous' | 'maitriseAcquiseDe' | 'maitriseMinReponses' | 'maitriseDemiVieJours'>,
  max = 3,
): PointFaible[] {
  const partieDe = new Map(questions.map((q) => [q.id, q.part]));
  const parNotion = new Map<string, { notion: NotionLiee; reponses: { juste: boolean; jour: Jour; poids: number }[]; ratees: number; parties: Map<number, number> }>();
  for (const res of resultats) {
    const liees: [NotionLiee, number][] = [];
    if (res.notion) liees.push([res.notion, 1]);
    for (const n of res.notions ?? []) liees.push([n, 0.5]);
    for (const [notion, poids] of liees) {
      const e = parNotion.get(notion.id) ?? { notion, reponses: [] as { juste: boolean; jour: Jour; poids: number }[], ratees: 0, parties: new Map<number, number>() };
      e.reponses.push({ juste: res.correct, jour: '2000-01-01', poids });
      if (!res.correct) {
        e.ratees += 1;
        const p = partieDe.get(res.question_id) ?? 0;
        e.parties.set(p, (e.parties.get(p) ?? 0) + 1);
      }
      parNotion.set(notion.id, e);
    }
  }
  const notions: PointFaible[] = [...parNotion.values()]
    .filter((e) => e.ratees > 0)
    .map((e) => {
      const partie = [...e.parties.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
      return { genre: 'notion' as const, notion: e.notion, partie, ratees: e.ratees, m: maitrise(e.reponses, '2000-01-01', r).m ?? 0 };
    })
    .sort((a, b) => (a.genre === 'notion' && b.genre === 'notion' ? a.m - b.m || b.ratees - a.ratees || a.notion.title.localeCompare(b.notion.title) : 0));
  const vocab: PointFaible[] = mots.total > 0 ? [{ genre: 'vocabulaire', theme: mots.theme, mots: mots.total }] : [];
  return [...notions.slice(0, Math.max(0, max - vocab.length)), ...vocab];
}

/** « 650 à 730 » : la fourchette F2. Sans estimation, aucune valeur (jamais de faux chiffre). */
export function formaterPlage(min: number | null, max: number | null): string | null {
  return min === null || max === null ? null : `${min} à ${max}`;
}
