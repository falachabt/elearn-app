/** Dictionnaire des événements d'analytics : nom de l'événement -> propriétés autorisées. */
export type Evenements = {
  app_opened: { plateforme: string };
  session_invite_creee: Record<string, never>;
  feedback_setting_changed: { setting: 'sounds' | 'haptics' | 'reduced_motion' | 'volume'; value: boolean | 'faible' | 'normal'; sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  celebration_seen: { sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  onboarding_choice_made: { profil: 'eleve' | 'concours'; niveau: string; pays: string; serie?: string } | { profil: 'certification'; pays?: string };
  first_result_seen: { type: 'mini_test' | 'photo'; duree_s: number; score?: number; total?: number };
  signup_prompt_seen: { source: 'score' };
  paywall_viewed: { declencheur: 'score' | 'moi' | 'limite' | 'recharge-pass' };
  offer_selected: { offre: 'week' | 'month' | 'contest' };
  parent_link_created: { offre: 'week' | 'month' | 'contest'; montant: number };
  parent_link_sent: { canal: 'whatsapp' | 'copie' };
  payment_initiated: { offre: 'week' | 'month' | 'contest'; pays: string; operateur?: string; mode?: string };
  promo_code_opened: { ecran: 'e1' | 'e2' };
  promo_code_applied: { ecran: 'e1' | 'e2'; type: 'pct' | 'fixe'; nb_pass_valables: number };
  promo_code_failed: { ecran: 'e1' | 'e2'; raison: string };
  promo_code_removed: { ecran: 'e1' | 'e2' };
  promo_code_unusable: { offre: 'week' | 'month' | 'contest' };
  web_app_banner_shown: { plateforme: 'android' | 'ios' | 'bureau' };
  web_app_banner_clicked: { magasin: 'play' | 'appstore' };
  web_app_banner_dismissed: Record<string, never>;
  payment_succeeded: { offre: 'week' | 'month' | 'contest'; pays: string };
  payment_failed: { offre: 'week' | 'month' | 'contest'; pays: string; motif?: string };
  planning_opened: { source: 'accueil' | 'push' | 'inbox' };
  planning_time_chosen: { minutes: number };
  planning_day_checked: { fait: boolean };
  planning_task_opened: { genre: 'lecon' | 'quiz' | 'exercice' | 'annales' | 'revisionFinale' | 'revisionLibre' };
  planning_sheet_opened: { source: 'voir_tout' };
  planning_created: { minutes_jour: number; jours_repos: number; matieres_choisies: number };
  planning_step_completed: { etape: number; nom: string };
  planning_session_returned: { jour: string };
  mission_started: { source: 'serveur' | 'locale'; total: number };
  mission_completed: { score: number; total: number; duree_s: number; serie: number };
  mission_lesson_review_opened: { cours: number };
  mission_errors_retried: { score: number; total: number };
  lesson_quiz_completed: { score: number; total: number };
  practice_quiz_completed: { score: number; total: number; record: boolean };
  practice_exercise_done: { fait: boolean };
  document_opened: { hors_ligne: boolean };
  chapter_end_shown: { complet: boolean; quiz: number; exercices: number };
  guardian_contact_saved: Record<string, never>;
  profile_class_changed: { niveau: string; pays: string; statut: 'eleve' | 'concours'; serie?: string };
  guardian_contact_withdrawn: Record<string, never>;
  account_deletion_requested: Record<string, never>;
  summary_opened: { cours: number };
  photo_sent: { matiere: string; source: 'camera' | 'galerie' };
  photo_corrected: { matiere: string; duree_s: number; etapes: number };
  photo_unreadable: Record<string, never>;
  photo_failed: { type: string };
  photo_rated: { avis: 'clair' | 'pas_compris' };
  photo_reported: { motif: string };
  photo_shared: { id?: string };
  share_reward_claimed: { gain: number; type: string };
  question_posted: { matiere: string; photos: number };
  connexion_echec: { cle: string; code: string | null; message: string };
  lesson_quiz_invited: { lecon: number };
  class_document_opened: { correction: boolean };
  legal_opened: { page: 'cgu' | 'confidentialite' };
  notification_prompt_shown: { source: 'fin_mission' | 'fin_quiz' | 'fin_chapitre' };
  notification_prompt_answered: { choix: 'accepte' | 'refuse' | 'plus_tard' };
  notification_opened: { type: string };
  notification_setting_changed: { rappel: boolean };
  display_setting_changed: { theme?: 'clair' | 'sombre' | 'systeme'; taille?: number; mode?: 'auto' | 'manuel' };
  settings_opened: { source: 'moi' };
  contest_chosen: { filiere: string; concours: string };
  mission_goal_set: { minutes: number | null; questions: number; origine: 'fin_mission' | 'parametres' };
  account_prompt_shown: { raison: 'paiement' | 'parent' | 'rappel' | 'question' };
  account_prompt_dismissed: { raison: 'paiement' | 'parent' | 'rappel' | 'question' };
  offline_prompt_shown: { variante: 'absent' | 'partiel' };
  offline_prompt_answered: { choix: 'telecharger' | 'plus_tard'; variante: 'absent' | 'partiel' };
  referral_code_captured: { source: 'lien' | 'saisie' };
  compte_cree: { methode: 'email' | 'google' | 'apple' | 'facebook'; conversion_invite: boolean; avec_parrainage: boolean };
  compte_echec: { methode: 'email'; etape: 'inscription' | 'mise_a_jour'; raison: string };
  connexion_reussie: { methode: 'email' | 'google' | 'apple' | 'facebook' | 'telephone' };
  oauth_repli_connexion: { methode: 'google' | 'facebook'; raison: string };
  identite_rattachee: { methode: 'google' | 'apple' | 'facebook' };
  deconnexion: Record<string, never>;
  credits_spent: { action: string; cout: number; solde: number };
  credits_exhausted: { action: string; cout: number; solde: number };
  week_recap_shown: { source: 'auto' | 'push' | 'inbox'; semaine: string };
  week_recap_card_viewed: { index: number; semaine: string };
  week_recap_cta: { cta: 'refaire_erreurs' | 'aller_reviser' | 'faire_mission' | 'reessayer' | 'fermer'; semaine: string };
  week_errors_viewed: { semaine: string; n: number };
  week_errors_retried: { semaine: string; score: number; total: number };
  week_recap_closed: { derniere_carte: number; semaine: string };
  support_confirmation_vue: { demandes: number };
  support_confirmation_reponse: { reponse: 'accepted' | 'refused' | 'expiree' | 'erreur' };
  erreur_ecran: { message: string; pile?: string; origine: 'boundary' | 'global'; fatale?: boolean };

  // Cycle de vie, navigation, réseau et consentement. `ecran` et `hors_ligne` sont ajoutés à tous les évènements.
  app_first_open: { pays: string | null; langue: string; plateforme: string };
  button_pressed: { bouton: string };
  connectivity_lost: Record<string, never>;
  connectivity_restored: { duree_s: number };
  analytics_consent_changed: { actif: boolean };
  pwa_install_prompt: { choix: 'propose' | 'accepte' | 'refuse' };
  pwa_installed: Record<string, never>;
  login_started: { methode: 'email' | 'google' | 'apple' | 'facebook' | 'ancien_compte' };

  // Crédits et récompenses.
  welcome_credits_seen: { montant: number };
  credits_refilled: { montant: number };
  credits_gained: { source: string; montant: number };
  signup_from_credits: { source: 'epuise' | 'bienvenue' | 'compteur' };
  quota_reached: { action: string; limite: number };
  reward_granted: { type: string; valeur: number };

  // Parrainage et partage.
  referral_page_opened: Record<string, never>;
  referral_link_shared: { canal: 'whatsapp' | 'copie' | 'autre' };
  referral_signup: Record<string, never>;
  milestone_reached: { palier: number; filleuls: number };
  referral_discount_applied: { code: string; pct: number };
  correction_shared: { source: 'photo' | 'quiz' };
  shared_content_opened: { type: 'correction' | 'exercice' | 'parrainage'; nouvel_appareil: boolean };

  // Apprentissage : les ouvertures de cours, leçons et annales sont des pages vues (`$screen`).
  quiz_started: { type: 'lecon' | 'libre' | 'mission' | 'erreurs' };
  exercise_opened: Record<string, never>;
  annale_timer_started: { mode: 'officiel' | 'perso' | 'libre'; minutes: number | null };
  annale_ai_started: { source: 'photos' | 'galerie' };
  annale_ai_sent: { feuilles: number };
  annale_ai_done: { points: number; total: number };
  annale_ai_failed: { raison: string };
  annale_visite_vue: { terminee: boolean; ecran: 'photos' | 'apercu' | 'ordre' };
  annale_correction_toggle: { vers: 'correction' | 'sujet' };
  ai_answer_seen: { source: 'photo' | 'question'; duree_s: number };
  // Performance (issue #14). Durées en millisecondes, volumes en octets (`null` si le serveur n'annonce pas la taille).
  app_cold_start: { duration_ms: number };
  ai_correction_complete: { duration_ms: number; matiere: string; etapes: number };
  requete_reseau: { nom: string; duration_ms: number; statut: number; octets_envoyes: number; octets_recus: number | null };
  ecran_pret: { ecran_cible: string; duration_ms: number };
  xp_earned: { gain: number; total: number; source: string; niveau: number };

  // Support et notifications.
  whatsapp_opened: { contexte: 'support' | 'parent' | 'parrainage' | 'aide' | 'autre' };
  notification_received: { type: string; premier_plan: boolean };

  // Profil TOEIC (certifications, cahier des charges section 7). Aucune donnée personnelle ni contenu de question.
  cert_exam_chosen: { examen: string };
  cert_goal_set: { score: number; date_renseignee: boolean };
  cert_goal_skipped: Record<string, never>;
  cert_daily_time_set: { minutes: number };
  cert_diagnostic_started: Record<string, never>;
  cert_diagnostic_completed: { score_min: number | null; score_max: number | null };
  cert_exercise_answered: { type: string; partie: number; juste: boolean | null };
  cert_why_missed: { raison: string };
  cert_notion_opened: { notion: string; source: string };
  cert_word_state_changed: { mot: string; boite_avant: number; boite_apres: number };
  cert_session_started: { composition: string };
  cert_session_completed: { composition: string };
  cert_mastery_viewed: { ecran: string };
  cert_stats_viewed: { periode: string };
  cert_stats_period_changed: { periode: string };
  cert_error_reported: { type: string };
  cert_audio_error: { ecran: string; code: string };
  cert_start_error: { ecran: string; etape: string; motif: string; code: string };
  cert_offline_answer_queued: { nb: number };
  cert_offline_answer_flushed: { nb: number };
  cert_credit_gate_viewed: { action: string };
  cert_credit_spent: { action: string; cout: number };
  cert_credit_refunded: { action: string; cout: number };
  cert_paywall_to_pass: { source: string };
  cert_tests_tab_viewed: Record<string, never>;
  cert_mock_started: { kind: string };
  cert_mock_completed: { kind: string; score_min: number | null; score_max: number | null };
  cert_mock_abandoned: { kind: string; minute: number };
  cert_mock_resumed: { kind: string; minute: number };
  cert_earn_claimed: { code: string; statut: string };

  // Réservé : posé quand la fonctionnalité existe (écoles relais, lot 2).
  school_class_created: { class_id: string; concours: string };
};

export type NomEvenement = keyof Evenements;
