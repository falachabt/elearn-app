/**
 * Paramètres des formules du cahier TOEIC (section 4). Ils viennent de `cert_settings` (serveur) : aucune valeur
 * n'est écrite dans le code (R-04). `lireReglages` échoue si une clé manque, pour ne jamais deviner un seuil.
 */
export type BudgetSeance = { notionMin: number; mots: number; rejeu: number; serie: number };

export type Reglages = {
  scoreZ: number;
  scoreMinReponses: number;
  maitriseDemiVieJours: number;
  maitriseFragileSous: number;
  maitriseAcquiseDe: number;
  maitriseMinReponses: number;
  delaisBoitesJours: number[];
  tailleSeanceMots: number;
  delaisRejeuJours: number[];
  rejeuRetraitApres: number;
  budgetSeance: Record<string, BudgetSeance>;
  joursRecents: number;
  refroidissementNotionJours: number;
  seanceMinutesChoix: number[];
  seanceMinutesDefaut: number;
  objectifDefaut: number;
  objectifMin: number;
  objectifMax: number;
  statsMinReponses: number;
  tendanceMinPoints: number;
  validiteHorsLigneJours: number;
  plafondGainsSemaine: number;
  audioEchecSecondes: number;
};

export type LigneReglage = { key: string; value: unknown };

export function lireReglages(lignes: LigneReglage[]): Reglages {
  const table = new Map(lignes.map((l) => [l.key, l.value]));
  const brut = (cle: string): unknown => {
    if (!table.has(cle)) throw new Error(`Paramètre TOEIC absent : ${cle}`);
    return table.get(cle);
  };
  const nombre = (cle: string): number => {
    const v = Number(brut(cle));
    if (!Number.isFinite(v)) throw new Error(`Paramètre TOEIC illisible : ${cle}`);
    return v;
  };
  const liste = (cle: string): number[] => {
    const v = brut(cle);
    if (!Array.isArray(v) || v.some((x) => !Number.isFinite(Number(x)))) throw new Error(`Paramètre TOEIC illisible : ${cle}`);
    return v.map(Number);
  };
  const budget = brut('session_budget') as Record<string, { notion_min: number; words: number; replay: number; series: number }>;
  return {
    scoreZ: nombre('score_z'),
    scoreMinReponses: nombre('score_min_answers'),
    maitriseDemiVieJours: nombre('mastery_halflife_days'),
    maitriseFragileSous: nombre('mastery_fragile_below'),
    maitriseAcquiseDe: nombre('mastery_acquired_from'),
    maitriseMinReponses: nombre('mastery_min_answers'),
    delaisBoitesJours: liste('box_delays_days'),
    tailleSeanceMots: nombre('words_session_size'),
    delaisRejeuJours: liste('replay_delays_days'),
    rejeuRetraitApres: nombre('replay_remove_after'),
    budgetSeance: Object.fromEntries(
      Object.entries(budget).map(([k, b]) => [k, { notionMin: b.notion_min, mots: b.words, rejeu: b.replay, serie: b.series }]),
    ),
    joursRecents: nombre('recent_days'),
    refroidissementNotionJours: nombre('notion_cooldown_days'),
    seanceMinutesChoix: liste('session_minutes_choices'),
    seanceMinutesDefaut: nombre('session_minutes_default'),
    objectifDefaut: nombre('goal_default'),
    objectifMin: nombre('goal_min'),
    objectifMax: nombre('goal_max'),
    statsMinReponses: nombre('stats_min_answers'),
    tendanceMinPoints: nombre('trend_min_points'),
    validiteHorsLigneJours: nombre('offline_validity_days'),
    plafondGainsSemaine: nombre('cert_earn_weekly_cap'),
    audioEchecSecondes: nombre('mock_audio_fail_s'),
  };
}
