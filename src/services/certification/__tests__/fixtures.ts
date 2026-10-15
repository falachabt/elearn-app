import { lireReglages, type LigneReglage } from '../reglages';

/** Valeurs de seed du cahier (section 4), uniquement comme jeu d'entrée de test : le code ne les connaît pas. */
export const LIGNES_SEED: LigneReglage[] = [
  { key: 'score_z', value: 1.28 },
  { key: 'score_min_answers', value: 20 },
  { key: 'mastery_halflife_days', value: 14 },
  { key: 'mastery_fragile_below', value: 0.4 },
  { key: 'mastery_acquired_from', value: 0.7 },
  { key: 'mastery_min_answers', value: 1 },
  { key: 'box_delays_days', value: [1, 3, 7, 14] },
  { key: 'words_session_size', value: 10 },
  { key: 'replay_delays_days', value: [1, 3, 7] },
  { key: 'replay_remove_after', value: 2 },
  { key: 'recent_days', value: 14 },
  { key: 'notion_cooldown_days', value: 3 },
  { key: 'session_minutes_choices', value: [10, 20, 30] },
  { key: 'session_minutes_default', value: 20 },
  {
    key: 'session_budget',
    value: {
      '10': { notion_min: 3, words: 4, replay: 3, series: 5 },
      '20': { notion_min: 3, words: 6, replay: 4, series: 10 },
      '30': { notion_min: 5, words: 10, replay: 8, series: 15 },
    },
  },
  { key: 'goal_default', value: 800 },
  { key: 'mock_audio_fail_s', value: 20 },
  { key: 'goal_min', value: 10 },
  { key: 'goal_max', value: 990 },
  { key: 'stats_min_answers', value: 5 },
  { key: 'trend_min_points', value: 20 },
  { key: 'offline_validity_days', value: 7 },
  { key: 'cert_earn_weekly_cap', value: 15 },
];

export const REGLAGES = lireReglages(LIGNES_SEED);
