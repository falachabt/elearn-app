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
  seanceMinutesRecommande: number;
  objectifDefaut: number;
  objectifMin: number;
  objectifMax: number;
  /** Plan du diagnostic servi par le serveur (partie → nombre de questions) ; `null` si le serveur ne le sert pas. */
  diagComptes: Record<number, number> | null;
  /**
   * Longueur de base servie pour un mini-test par partie (`test_mini_length_by_part`, partie → nombre de questions) :
   * le serveur sert 12 questions pour les parties 3, 4 et 6 (groupes entiers), 10 pour les autres — les parties absentes
   * de la table valent 10. `null` si le serveur ne sert pas le réglage.
   */
  miniLongueursParPartie: Record<number, number> | null;
  statsMinReponses: number;
  tendanceMinPoints: number;
  validiteHorsLigneJours: number;
  plafondGainsSemaine: number;
  gainsValiditeJours: number;
  audioEchecSecondes: number;
  miniMinutesPour10: number;
  repriseToleranceMin: number;
  fenetreRemboursementMin: number;
  testsExigentCompte: boolean;
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
  /** Plan du diagnostic (`diag_counts`) : nombre de questions par partie, servi par le serveur. */
  const planDiagnostic = (): Record<number, number> | null => {
    if (!table.has('diag_counts')) return null;
    const v = brut('diag_counts');
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const sortie: Record<number, number> = {};
    for (const [partie, compte] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(compte);
      if (!Number.isFinite(n)) return null;
      sortie[Number(partie)] = n;
    }
    return sortie;
  };
  /**
   * Longueurs de base des minis par partie (`test_mini_length_by_part`) : même tolérance que le plan du diagnostic —
   * cette donnée ne sert qu'aux libellés et au minuteur, elle ne doit jamais faire échouer le chargement des réglages.
   */
  const longueursMini = (): Record<number, number> | null => {
    if (!table.has('test_mini_length_by_part')) return null;
    const v = brut('test_mini_length_by_part');
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const sortie: Record<number, number> = {};
    for (const [partie, compte] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(compte);
      if (!Number.isFinite(n) || n <= 0) return null;
      sortie[Number(partie)] = n;
    }
    return sortie;
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
    // Durée qui porte le libellé « Recommandé » d'A4 (écart E-06 : la recommandation est portée par le serveur).
    // Repli sur le défaut si la ligne est absente (anciennes lignes servies ou mises en cache) : ce libellé d'aide
    // ne doit jamais faire échouer le chargement des réglages, contrairement aux seuils de calcul ci-dessus.
    seanceMinutesRecommande: table.has('session_minutes_recommended') ? nombre('session_minutes_recommended') : nombre('session_minutes_default'),
    objectifDefaut: nombre('goal_default'),
    objectifMin: nombre('goal_min'),
    objectifMax: nombre('goal_max'),
    // Le plan ne sert qu'à l'annonce d'A5 (nombre de questions affiché avant le diagnostic) : comme
    // `session_minutes_recommended`, cette donnée d'affichage ne doit jamais faire échouer le chargement des
    // réglages si une ancienne copie servie ou mise en cache ne le contient pas encore.
    diagComptes: planDiagnostic(),
    miniLongueursParPartie: longueursMini(),
    statsMinReponses: nombre('stats_min_answers'),
    tendanceMinPoints: nombre('trend_min_points'),
    validiteHorsLigneJours: nombre('offline_validity_days'),
    plafondGainsSemaine: nombre('cert_earn_weekly_cap'),
    gainsValiditeJours: nombre('cert_earn_valid_days'),
    audioEchecSecondes: nombre('mock_audio_fail_s'),
    miniMinutesPour10: nombre('mini_minutes_per_10q'),
    repriseToleranceMin: nombre('mock_resume_grace_min'),
    fenetreRemboursementMin: nombre('mock_refund_window_min'),
    testsExigentCompte: brut('mock_requires_account') === true,
  };
}
