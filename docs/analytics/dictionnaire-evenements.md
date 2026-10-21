# Dictionnaire des évènements et propriétés

Source de vérité du code : `src/services/evenements.ts` (le typage interdit tout évènement ou propriété hors de ce dictionnaire). Ce document le décrit pour les décisions produit. Mis à jour le 13 octobre 2026. Le tableau final est généré depuis le code : si un évènement est ajouté, l'ajouter dans le code puis mettre ce document à jour.

## Ce qui est ajouté à chaque évènement

| Propriété | Sens |
| --- | --- |
| `ecran` | Route affichée au moment de l'évènement, sans paramètres (`/cours/lecon`) |
| `hors_ligne` | `true` si le réseau ou le serveur ne répondait pas à cet instant |
| `version_app`, `canal`, `plateforme`, `langue_app`, `langue_telephone` | Enregistrées une fois pour tous les évènements suivants |
| `$session_id`, `$lib`, `$app_version`, `$os_name` | Ajoutées par le SDK PostHog |

Un évènement pris hors ligne garde son horodatage d'origine et son identifiant unique : il est envoyé au retour du réseau, une seule fois.

## Pages vues

PostHog `$screen`, une par changement d'écran, avec le nom de la route sans paramètres et l'écran précédent (`precedent`). Aucun identifiant, code de parrainage ou saisie n'entre dans le nom.

## Propriétés de la personne

| Propriété | Valeurs | Mise à jour |
| --- | --- | --- |
| `invite` | `true` pour un invité, `false` pour un compte | Connexion, création de compte |
| `statut` | `eleve` ou `concours` | Choix du profil |
| `classe` | `6e` à `Tle` (élève) | Choix du profil |
| `serie` | série du lycée choisie (`Série C`, `Série D`…) | Choix du profil |
| `filiere` | filière du candidat (`sante`, `ingenieurs`) | Choix du profil |
| `concours` | sigle du concours choisi | Choix du concours |
| `pays` | pays choisi dans le profil | Choix du profil |
| `langue_app` | langue de l'interface (`fr`, `en`) | Changement de langue |
| `langue_telephone`, `region_telephone` | langue et région du téléphone | Démarrage |
| `plateforme`, `version_app`, `canal` | Android, iOS, web ; version ; canal de mise à jour | Démarrage |
| `pass_actif`, `pass_offre` | avec ou sans Pass, et l'offre | Chaque lecture de l'accès |
| `taille_texte_reglage` | `auto` (taille selon l'écran) ou la taille manuelle choisie (`80` à `130`) | Démarrage, chaque changement de taille |

Jamais de nom, e-mail, numéro de téléphone ou contenu de question.

## Identité

- Au démarrage, la session invité (utilisateur anonyme du serveur) est identifiée par son identifiant.
- Un invité qui crée un compte e-mail garde le même identifiant : la propriété `invite` passe à `false`.
- Un invité qui se connecte à un autre compte (Apple, ancien compte, compte existant) : le profil de l'invité est rattaché au compte par un alias PostHog (un seul profil).
- À la déconnexion : l'évènement `deconnexion` part d'abord, la file est vidée (1,5 s au plus hors ligne), puis l'identité est remise à zéro. Le prochain invité repart d'un nouveau profil.

## Vie privée et consentement

- Garde-fou (`src/services/confidentialite.ts`) appliqué à tout évènement avant envoi : clés interdites retirées (`email`, `telephone`, `mot_de_passe`, `jeton`, `question`, `texte`, `reponse`), e-mails, numéros et jetons masqués dans les textes, textes tronqués à 300 caractères.
- Réglage Paramètres, « Aider à améliorer l'application » : activé par défaut. Refus : le refus est annoncé (`analytics_consent_changed`), la file est envoyée une dernière fois, puis plus rien ne part, au démarrage suivant non plus.
- Les boutons ne sont suivis que par un nom stable (`suivi`) : jamais le libellé d'une réponse de quiz ni un texte de question.

## Suivi des erreurs

- PostHog Error Tracking : exceptions JavaScript non gérées et refus de promesse (SDK), erreurs de rendu attrapées par la frontière d'erreur (`$exception` avec `origine`, `ecran`, `version_app`, `plateforme`).
- Journal local des 50 dernières erreurs (`erreurs.journal`, lisible sans PostHog) avec écran, version, plateforme.
- Pas encore : crashs natifs (Java, Kotlin, C++). Ils demandent le module `@posthog/react-native-plugin` et un nouvel APK (AGENTS.md §17).

## Évènements côté serveur ou web (pas dans l'app)

À poser dans `elearn-supabase` et `elearn-site` (voir `entrepot-postgres.md`) : `payment_succeeded_server` (webhook pawaPay confirmé), `parent_link_opened` et `parent_payment_opened` (page `/p/[token]` du site, sans le jeton), `referral_activated` (premier paiement du filleul), `reward_expired`, `class_member_joined` (écoles relais), `partner_lead_created`, `warmup_*` (M17, pas construit).

## Évènements de l'app

| Évènement | Quand | Propriétés |
| --- | --- | --- |
| `app_opened` | Chaque ouverture de l'app | `{ plateforme: string }` |
| `session_invite_creee` | Création de la session invité (connexion anonyme) | `Record<string, never>` |
| `feedback_setting_changed` | Réglage de sons, vibrations ou animations modifié | `{ setting: 'sounds' \| 'haptics' \| 'reduced_motion' \| 'volume'; value: boolean \| 'faible' \| 'normal'; sound_on: boolean; haptics_on: boolean; reduced_motion: boolean }` |
| `celebration_seen` | Célébration (fin de mission ou de quiz) affichée | `{ sound_on: boolean; haptics_on: boolean; reduced_motion: boolean }` |
| `onboarding_choice_made` | Profil choisi à l'arrivée (élève, concours ou certification ; classe, série éventuelle et pays pour les deux premiers) | `{ profil: 'eleve' \| 'concours'; niveau: string; pays: string; serie?: string } \| { profil: 'certification'; pays?: string }` |
| `first_result_seen` | Premier résultat affiché (mini-test ou photo) | `{ type: 'mini_test' \| 'photo'; duree_s: number; score?: number; total?: number }` |
| `signup_prompt_seen` | Invitation à créer un compte vue après le score | `{ source: 'score' }` |
| `paywall_viewed` | Écran des offres affiché | `{ declencheur: 'score' \| 'moi' \| 'limite' }` |
| `offer_selected` | Offre choisie | `{ offre: 'week' \| 'month' \| 'contest' }` |
| `parent_link_created` | Lien parent créé | `{ offre: 'week' \| 'month' \| 'contest'; montant: number }` |
| `parent_link_sent` | Lien parent envoyé (WhatsApp ou copie) | `{ canal: 'whatsapp' \| 'copie' }` |
| `payment_initiated` | Paiement lancé | `{ offre: 'week' \| 'month' \| 'contest'; pays: string; operateur?: string; mode?: string }` |
| `promo_code_opened` | Champ code promo ouvert | `{ ecran: 'e1' \| 'e2' }` |
| `promo_code_applied` | Code promo appliqué | `{ ecran: 'e1' \| 'e2'; type: 'pct' \| 'fixe'; nb_pass_valables: number }` |
| `promo_code_failed` | Code promo refusé | `{ ecran: 'e1' \| 'e2'; raison: string }` |
| `promo_code_removed` | Code promo retiré | `{ ecran: 'e1' \| 'e2' }` |
| `promo_code_unusable` | Code promo sans effet sur l'offre | `{ offre: 'week' \| 'month' \| 'contest' }` |
| `web_app_banner_shown` | Web : bandeau « installer l'application » affiché | `{ plateforme: 'android' \| 'ios' \| 'bureau' }` |
| `web_app_banner_clicked` | Web : lien du magasin touché | `{ magasin: 'play' \| 'appstore' }` |
| `web_app_banner_dismissed` | Web : bandeau fermé | `Record<string, never>` |
| `payment_succeeded` | Paiement confirmé (côté app) | `{ offre: 'week' \| 'month' \| 'contest'; pays: string }` |
| `payment_failed` | Paiement échoué ou abandonné | `{ offre: 'week' \| 'month' \| 'contest'; pays: string; motif?: string }` |
| `mission_started` | Mission du jour commencée | `{ source: 'serveur' \| 'locale'; total: number }` |
| `mission_completed` | Mission terminée (score, durée, série) | `{ score: number; total: number; duree_s: number; serie: number }` |
| `mission_lesson_review_opened` | Revoir une leçon ratée depuis la fin de mission ou les résultats | `{ cours: number }` |
| `mission_errors_retried` | Refaire mes erreurs terminé | `{ score: number; total: number }` |
| `lesson_quiz_completed` | Quiz de leçon terminé | `{ score: number; total: number }` |
| `practice_quiz_completed` | Quiz libre terminé | `{ score: number; total: number; record: boolean }` |
| `practice_exercise_done` | Exercice libre terminé | `{ fait: boolean }` |
| `document_opened` | Document ou sujet PDF ouvert | `{ hors_ligne: boolean }` |
| `chapter_end_shown` | Fin de chapitre affichée | `{ complet: boolean; quiz: number; exercices: number }` |
| `guardian_contact_saved` | Contact du parent ou tuteur enregistré | `Record<string, never>` |
| `profile_class_changed` | Classe, série, pays ou statut modifié | `{ niveau: string; pays: string; statut: 'eleve' \| 'concours'; serie?: string }` |
| `guardian_contact_withdrawn` | Contact du parent retiré | `Record<string, never>` |
| `account_deletion_requested` | Suppression du compte demandée | `Record<string, never>` |
| `summary_opened` | Fiche de cours ouverte | `{ cours: number }` |
| `photo_sent` | Photo envoyée à l'IA | `{ matiere: string; source: 'camera' \| 'galerie' }` |
| `photo_corrected` | Correction reçue | `{ matiere: string; duree_s: number; etapes: number }` |
| `photo_unreadable` | Photo illisible | `Record<string, never>` |
| `photo_failed` | Échec de la correction | `{ type: string }` |
| `photo_rated` | Correction notée | `{ avis: 'clair' \| 'pas_compris' }` |
| `photo_reported` | Correction signalée | `{ motif: string }` |
| `photo_shared` | Correction partagée | `{ id?: string }` |
| `share_reward_claimed` | Gain obtenu pour un partage | `{ gain: number; type: string }` |
| `question_posted` | Question publiée dans l'entraide | `{ matiere: string; photos: number }` |
| `connexion_echec` | Échec d'une connexion sociale | `{ cle: string; code: string \| null; message: string }` |
| `lesson_quiz_invited` | Invitation à faire le quiz après une leçon | `{ lecon: number }` |
| `class_document_opened` | Document de classe ouvert | `{ correction: boolean }` |
| `legal_opened` | CGU ou confidentialité ouvertes | `{ page: 'cgu' \| 'confidentialite' }` |
| `notification_prompt_shown` | Proposition d'activer les notifications | `{ source: 'fin_mission' \| 'fin_quiz' \| 'fin_chapitre' }` |
| `notification_prompt_answered` | Réponse à la proposition | `{ choix: 'accepte' \| 'refuse' \| 'plus_tard' }` |
| `notification_opened` | Notification ouverte | `{ type: string }` |
| `notification_setting_changed` | Rappel quotidien activé ou coupé | `{ rappel: boolean }` |
| `display_setting_changed` | Thème ou taille du texte modifié | `{ theme?: 'clair' \| 'sombre' \| 'systeme'; taille?: number; mode?: 'auto' \| 'manuel' }` |
| `settings_opened` | Paramètres ouverts | `{ source: 'moi' }` |
| `contest_chosen` | Concours choisi | `{ filiere: string; concours: string }` |
| `mission_goal_set` | Objectif de mission réglé | `{ minutes: number \| null; questions: number; origine: 'fin_mission' \| 'parametres' }` |
| `account_prompt_shown` | Invitation à créer un compte affichée (paiement, parent, rappel, question) | `{ raison: 'paiement' \| 'parent' \| 'rappel' \| 'question' }` |
| `account_prompt_dismissed` | Invitation à créer un compte fermée | `{ raison: 'paiement' \| 'parent' \| 'rappel' \| 'question' }` |
| `referral_code_captured` | Code de parrainage reçu par lien ou saisi | `{ source: 'lien' \| 'saisie' }` |
| `compte_cree` | Compte créé, avec ou sans conversion d'invité | `{ methode: 'email' \| 'google' \| 'apple' \| 'facebook'; conversion_invite: boolean; avec_parrainage: boolean }` |
| `connexion_reussie` | Connexion aboutie | `{ methode: 'email' \| 'google' \| 'apple' \| 'facebook' \| 'telephone' }` |
| `oauth_repli_connexion` | Repli de la connexion Google ou Facebook | `{ methode: 'google' \| 'facebook'; raison: string }` |
| `identite_rattachee` | Un fournisseur est rattaché à un compte existant | `{ methode: 'google' \| 'apple' \| 'facebook' }` |
| `deconnexion` | Déconnexion (envoyée avant la remise à zéro de l'identité) | `Record<string, never>` |
| `credits_spent` | Crédits dépensés | `{ action: string; cout: number; solde: number }` |
| `credits_exhausted` | Solde insuffisant : feuille Recharger ou Gagner | `{ action: string; cout: number; solde: number }` |
| `week_recap_shown` | Résumé hebdomadaire ouvert | `{ source: 'auto' \| 'push' \| 'inbox'; semaine: string }` |
| `week_recap_card_viewed` | Carte du résumé vue | `{ index: number; semaine: string }` |
| `week_recap_cta` | Bouton du résumé touché | `{ cta: 'refaire_erreurs' \| 'aller_reviser' \| 'faire_mission' \| 'reessayer' \| 'fermer'; semaine: string }` |
| `week_recap_closed` | Résumé fermé | `{ derniere_carte: number; semaine: string }` |
| `support_confirmation_vue` | Écran de confirmation du support WhatsApp ouvert | `{ demandes: number }` |
| `support_confirmation_reponse` | Réponse à la demande de vérification du support | `{ reponse: 'accepted' \| 'refused' \| 'expiree' \| 'erreur' }` |
| `erreur_ecran` | Ancien évènement, plus émis : remplacé par les exceptions PostHog | `{ message: string; pile?: string; origine: 'boundary' \| 'global'; fatale?: boolean }` |
| `app_first_open` | Premier lancement sur l'appareil, une seule fois | `{ pays: string \| null; langue: string; plateforme: string }` |
| `button_pressed` | Appui sur un Bouton, une ligne de lien ou un interrupteur nommé | `{ bouton: string }` |
| `connectivity_lost` | Le réseau ou le serveur ne répond plus | `Record<string, never>` |
| `connectivity_restored` | Retour du réseau ; la file hors ligne est vidée aussitôt | `{ duree_s: number }` |
| `analytics_consent_changed` | Réglage « Aider à améliorer l'application » modifié | `{ actif: boolean }` |
| `pwa_install_prompt` | Web : le navigateur propose d'installer la PWA | `{ choix: 'propose' \| 'accepte' \| 'refuse' }` |
| `pwa_installed` | Web : la PWA vient d'être installée | `Record<string, never>` |
| `login_started` | Début d'une connexion (e-mail, Google, Facebook, Apple, ancien compte) | `{ methode: 'email' \| 'google' \| 'apple' \| 'facebook' \| 'ancien_compte' }` |
| `welcome_credits_seen` | Écran des crédits de bienvenue affiché (montant lu du serveur) | `{ montant: number }` |
| `credits_refilled` | Recharge hebdomadaire vue (toast du lundi) | `{ montant: number }` |
| `credits_gained` | Crédits gagnés par une action quotidienne (visite du site, réseaux) | `{ source: string; montant: number }` |
| `signup_from_credits` | Création de compte demandée depuis les crédits | `{ source: 'epuise' \| 'bienvenue' \| 'compteur' }` |
| `quota_reached` | Limite de questions IA du jour atteinte | `{ action: string; limite: number }` |
| `reward_granted` | Récompense observée dans l'app (palier versé, partage de correction) | `{ type: string; valeur: number }` |
| `referral_page_opened` | Écran Parrainage ouvert | `Record<string, never>` |
| `referral_link_shared` | Lien parrain partagé ou code copié | `{ canal: 'whatsapp' \| 'copie' \| 'autre' }` |
| `referral_signup` | Compte créé avec un code de parrainage | `Record<string, never>` |
| `milestone_reached` | Palier de parrainage vu pour la première fois | `{ palier: number; filleuls: number }` |
| `referral_discount_applied` | Réservé : remise de parrainage appliquée (serveur) | `{ code: string; pct: number }` |
| `correction_shared` | Correction partagée | `{ source: 'photo' \| 'quiz' }` |
| `shared_content_opened` | Lien partagé ouvert | `{ type: 'correction' \| 'exercice' \| 'parrainage'; nouvel_appareil: boolean }` |
| `quiz_started` | Quiz de leçon ou libre démarré | `{ type: 'lecon' \| 'libre' \| 'mission' \| 'erreurs' }` |
| `exercise_opened` | Exercice libre ouvert | `Record<string, never>` |
| `annale_timer_started` | Chronomètre d'une annale lancé (officiel, perso, libre) | `{ mode: 'officiel' \| 'perso' \| 'libre'; minutes: number \| null }` |
| `annale_ai_started` | Correction par l'IA d'un ancien sujet : feuilles prises ou importées | `{ source: 'photos' \| 'galerie' }` |
| `annale_ai_sent` | Feuilles envoyées à l'IA | `{ feuilles: number }` |
| `annale_ai_done` | Correction reçue (points et total, jamais le contenu) | `{ points: number; total: number }` |
| `annale_ai_failed` | Correction non aboutie (type d'issue) | `{ raison: string }` |
| `annale_visite_vue` | Visite guidée d'un écran de la correction du travail fermée (terminée ou passée) | `{ terminee: boolean; ecran: 'photos' \| 'apercu' \| 'ordre' }` |
| `annale_correction_toggle` | Bascule sujet / correction dans le lecteur | `{ vers: 'correction' \| 'sujet' }` |
| `ai_answer_seen` | Réponse de l'IA affichée (durée de bout en bout) | `{ source: 'photo' \| 'question'; duree_s: number }` |
| `compte_echec` | Échec de création de compte par e-mail (code d'erreur seulement, jamais le message ni l'adresse) | `{ methode: 'email'; etape: 'inscription' \| 'mise_a_jour'; raison: string }` |
| `ai_correction_complete` | Correction photo reçue, en millisecondes (issue #14) | `{ duration_ms: number; matiere: string; etapes: number }` |
| `app_cold_start` | Démarrage à froid : du chargement du module jusqu'à l'écran prêt, une fois par lancement (issue #14) | `{ duration_ms: number }` |
| `requete_reseau` | Requête vers Supabase : nom de la ressource (table, rpc, fonction, auth, storage), durée, statut (0 = échec réseau), octets envoyés et reçus (`null` si non annoncés). Jamais l'URL complète ni les filtres (issue #14) | `{ nom: string; duration_ms: number; statut: number; octets_envoyes: number; octets_recus: number \| null }` |
| `ecran_pret` | Délai entre l'ouverture d'un écran et sa première réponse serveur réussie, une fois par écran. Approximation : une requête de fond peut compter (issue #14) | `{ ecran_cible: string; duration_ms: number }` |
| `whatsapp_opened` | Ouverture de WhatsApp (support, aide) | `{ contexte: 'support' \| 'parent' \| 'parrainage' \| 'aide' \| 'autre' }` |
| `notification_received` | Notification reçue (app ouverte ou non) | `{ type: string; premier_plan: boolean }` |
| `school_class_created` | Réservé (écoles relais, lot 2) | `{ class_id: string; concours: string }` |

## Profil certification (TOEIC)

Aucune donnée personnelle ni contenu de question : seulement des types, parties, bornes de score et noms de notions ou d'actions. Les montants viennent de la configuration serveur.

| Évènement | Quand | Propriétés |
| --- | --- | --- |
| `cert_exam_chosen` | Certification choisie à l'écran A2 | `{ examen: string }` |
| `cert_goal_set` | Objectif de score enregistré (A3) | `{ score: number; date_renseignee: boolean }` |
| `cert_goal_skipped` | « Passer » à l'écran objectif | `Record<string, never>` |
| `cert_daily_time_set` | Temps par jour choisi (A4) | `{ minutes: number }` |
| `cert_diagnostic_started` | Début du diagnostic (A5) | `Record<string, never>` |
| `cert_diagnostic_completed` | Résultat du diagnostic affiché (A7) | `{ score_min: number \| null; score_max: number \| null }` |
| `cert_exercise_answered` | Une question répondue ; `juste` est `null` quand la correction n'est pas montrée (diagnostic) | `{ type: string; partie: number; juste: boolean \| null }` |
| `cert_why_missed` | Raison d'une erreur indiquée | `{ raison: string }` |
| `cert_notion_opened` | Fiche de notion ouverte | `{ notion: string; source: string }` |
| `cert_word_state_changed` | Un mot change de boîte | `{ mot: string; boite_avant: number; boite_apres: number }` |
| `cert_session_started` | Séance du jour lancée | `{ composition: string }` |
| `cert_session_completed` | Séance du jour terminée | `{ composition: string }` |
| `cert_mastery_viewed` | Maîtrise par partie affichée | `{ ecran: string }` |
| `cert_stats_viewed` | Statistiques ouvertes | `{ periode: string }` |
| `cert_stats_period_changed` | Période des statistiques changée | `{ periode: string }` |
| `cert_error_reported` | Erreur de contenu signalée | `{ type: string }` |
| `cert_audio_error` | Audio indisponible | `{ ecran: string; code: string }` |
| `cert_offline_answer_queued` | Réponses mises en file hors ligne | `{ nb: number }` |
| `cert_offline_answer_flushed` | File de réponses envoyée au retour du réseau | `{ nb: number }` |
| `cert_credit_gate_viewed` | Feuille de coût en crédits affichée | `{ action: string }` |
| `cert_credit_spent` | Crédits dépensés | `{ action: string; cout: number }` |
| `cert_credit_refunded` | Crédits rendus | `{ action: string; cout: number }` |
| `cert_paywall_to_pass` | Passage de la feuille de coût vers le Pass | `{ source: string }` |
| `cert_tests_tab_viewed` | Onglet Tests ouvert | `Record<string, never>` |
| `cert_mock_started` | Test blanc démarré | `{ kind: string }` |
| `cert_mock_completed` | Test blanc terminé | `{ kind: string; score_min: number \| null; score_max: number \| null }` |
| `cert_mock_abandoned` | Test blanc abandonné | `{ kind: string; minute: number }` |
| `cert_mock_resumed` | Test blanc repris | `{ kind: string; minute: number }` |
| `cert_earn_claimed` | Gain de crédits TOEIC réclamé (G1) ; `statut` est la réponse du serveur (`granted`, `already`, `cap_reached`, `not_eligible`, `account_required`) | `{ code: string; statut: string }` |
