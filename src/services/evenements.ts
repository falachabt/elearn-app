/** Dictionnaire des événements d'analytics : nom de l'événement -> propriétés autorisées. */
export type Evenements = {
  app_opened: { plateforme: string };
  session_invite_creee: Record<string, never>;
  feedback_setting_changed: { setting: 'sounds' | 'haptics' | 'reduced_motion' | 'volume'; value: boolean | 'faible' | 'normal'; sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  celebration_seen: { sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  onboarding_choice_made: { profil: 'eleve' | 'concours'; niveau: string; pays: string };
  first_result_seen: { type: 'mini_test' | 'photo'; duree_s: number; score?: number; total?: number };
  signup_prompt_seen: { source: 'score' };
  paywall_viewed: { declencheur: 'score' | 'moi' | 'limite' };
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
  profile_class_changed: { niveau: string; pays: string; statut: 'eleve' | 'concours' };
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
  display_setting_changed: { theme?: 'clair' | 'sombre' | 'systeme'; taille?: number };
  settings_opened: { source: 'moi' };
  contest_chosen: { filiere: string; concours: string };
  mission_goal_set: { minutes: number | null; questions: number; origine: 'fin_mission' | 'parametres' };
  account_prompt_shown: { raison: 'paiement' | 'parent' | 'rappel' | 'question' };
  account_prompt_dismissed: { raison: 'paiement' | 'parent' | 'rappel' | 'question' };
  referral_code_captured: { source: 'lien' | 'saisie' };
  compte_cree: { methode: 'email' | 'google' | 'apple' | 'facebook'; conversion_invite: boolean; avec_parrainage: boolean };
  connexion_reussie: { methode: 'email' | 'google' | 'apple' | 'facebook' | 'telephone' };
  oauth_repli_connexion: { methode: 'google' | 'facebook'; raison: string };
  identite_rattachee: { methode: 'google' | 'apple' | 'facebook' };
  deconnexion: Record<string, never>;
  credits_spent: { action: string; cout: number; solde: number };
  credits_exhausted: { action: string; cout: number; solde: number };
  week_recap_shown: { source: 'auto' | 'push' | 'inbox'; semaine: string };
  week_recap_card_viewed: { index: number; semaine: string };
  week_recap_cta: { cta: 'refaire_erreurs' | 'aller_reviser' | 'faire_mission' | 'reessayer' | 'fermer'; semaine: string };
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
  ai_answer_seen: { source: 'photo' | 'question'; duree_s: number };
  xp_earned: { gain: number; total: number; source: string; niveau: number };

  // Support et notifications.
  whatsapp_opened: { contexte: 'support' | 'parent' | 'parrainage' | 'aide' | 'autre' };
  notification_received: { type: string; premier_plan: boolean };

  // Réservé : posé quand la fonctionnalité existe (écoles relais, lot 2).
  school_class_created: { class_id: string; concours: string };
};

export type NomEvenement = keyof Evenements;
