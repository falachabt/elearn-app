# Cahier des charges v1.3 (résumé pour le dev)

**Source de vérité** (ne pas modifier depuis ce dépôt) :
- Markdown : `/mnt/project-files/refonte/sources/cahier-des-charges/cahier-des-charges.md` (dossier partagé du projet Claude « Repenser le produit et l'app »), PDF : `/mnt/project-files/refonte/Elearn-Prepa-Cahier-des-Charges.pdf`.
- Copie intégrale versionnée : dépôt **privé** `falachabt/elearn-supabase`, `docs/projet/cahier-des-charges-v1.3.md` (le texte contient des chiffres confidentiels, donc pas dans ce dépôt public).
- Toute évolution passe par le fil « Cahier des charges et récompenses » du projet, qui prévient les agents.

Version 1.3 du 30/09/2026 : v1.2 a ajouté **M15** (récompenses et parrainage), v1.3 a ajouté **M16** (sons, vibrations, animations). Priorités : **M** indispensable au lancement, **S** juste après, **C** souhaitable. Chaque exigence a un identifiant (ex. `M3-02`) à citer dans les commits, tests et PR.

## Objectifs à 6 mois après le lancement

Installations → actifs : 40 % · actifs qui reviennent le mois suivant : 35 % · écran de paiement → paiement réussi : 5 % · paiements réussis / tentés : 60 % · 11 écoles relais actives · 3 partenaires en discussion avancée.

## Modules

| Module | Contenu | Prio | Lot |
|---|---|---|---|
| M1 | Entrée sans compte et premier résultat | M | 1 |
| M2 | Compte et connexion (Google, Apple, Facebook) | M | 1 |
| M3 | Aide par photo (tuteur IA) | M | 1 |
| M4 | Mission du jour et progression | M | 1 |
| M5 | Cours et fiches courts | M | 1 |
| M6 | Annales et concours blancs | M | 1 |
| M7 | Fil des questions | S | 2 |
| M8 | Pass, paiement, lien parent ou tuteur, espace parent | M | 1 / 2 |
| M9 | Notifications et messages WhatsApp | S | 1 / 2 |
| M10 | Écoles relais (classes) | S | 2 |
| M11 | Espace partenaire | C | 3 |
| M12 | Back-office | M | 1 à 3 |
| M13 | Mesure et tableaux de bord | M | 0 et 1 |
| M14 | Multi-pays | M | 1 / 3 |
| M15 | Récompenses communautaires et parrainage | S | 1 / 2 |
| M16 | Interactivité : sons, vibrations, animations, réglages | M | 1 (socle), puis chaque module |

## Exigences clés par module (résumé)

**M1 Entrée sans compte.** M1-01 choix « élève » ou « concours », classe ou concours, pays, en 3 appuis, sans compte. M1-02 pays présélectionné. M1-03 premier résultat (mini-test de 5 questions **ou** correction par photo) en moins de 2 minutes. M1-04 progression d'invité migrée à l'inscription. M1-05 limites d'invité : 3 corrections photo, 1 sujet d'annale complet. M1-06 jauge de progression réelle.

**M2 Compte.** M2-01 Google en un appui. M2-02 Apple (obligatoire sur iOS). M2-03 Facebook (S). M2-04 numéro + code (C, seulement si peu coûteux). M2-05 « Sauvegarder ma progression » après le premier résultat, une seule fois. M2-06 **reprise des comptes existants** (rapprochement par e-mail ; comptes numéro + mot de passe : rattachement assisté). M2-07 coordonnées du parent (consentement). M2-08 **suppression du compte depuis l'app** (exigé par les stores). M2-09 plusieurs profils (C).

**M3 Aide par photo.** Photo ou import, recadrage. Réponse pas à pas (énoncé, méthode, étapes, résultat, « à retenir », lien vers le cours), 95 % en moins de 25 s en 3G. **3 corrections gratuites par jour**, compteur visible. Signaler une erreur. Partage WhatsApp. **L'IA passe uniquement par une fonction serveur** (aucune clé dans l'app), images supprimées après 30 jours, aucune donnée personnelle envoyée au fournisseur.

**M4 Mission du jour.** 3 à 5 activités (~10 min) adaptées, série de jours avec jour de grâce, fin de mission (score, corrections, points faibles), plan de révision jusqu'à l'examen (S), missions téléchargeables 7 jours (hors ligne).

**M5 Cours et fiches.** Leçons de 10 min max (objectif, contenu court, 3 questions), fiches résumées relues, hors ligne par matière, vidéo jamais obligatoire.

**M6 Annales.** Catalogue par pays, concours, année, matière ; 1 sujet complet gratuit par concours ; mode chronométré (le chrono continue en arrière-plan) ; correction détaillée en pass ; source et droits de chaque sujet ; classement facultatif et désactivable.

**M7 Fil des questions (lot 2).** L'IA répond en premier, puis la communauté ; modération ; protection des mineurs (pas de messages privés, numéros masqués).

**M8 Pass et paiement.** M8-01 offres affichées **après** le premier résultat, jamais avant. M8-02 MTN et Orange Money via **un prestataire unique (pawaPay)**. M8-03 **le statut d'un paiement n'est modifié que par le serveur** (webhook). M8-04 reçu. M8-05 échecs gérés, paiement en attente expiré après 10 min. M8-06 **« Envoyer à mon parent »** : lien de paiement web, le parent paie sans compte ni app (page `/payer/[jeton]` du site). M8-07 codes promo d'influenceurs. M8-08 droits d'accès (entitlements) avec début et fin. M8-11 lien à usage unique, 48 h, montant non modifiable. M8-13 **iOS : achat via Apple** sauf si les règles permettent le Mobile Money.

**M9 Notifications.** Rappel quotidien à l'heure choisie (défaut 19 h–21 h), 1 par jour max ; WhatsApp aux parents avec consentement (lot 2) ; jamais plus d'un message marketing par semaine.

**M10 Écoles relais.** Classe avec code et lien d'invitation (route `rejoindre/[code]`), suivi des inscrits, mission commune (C), origine des inscriptions par école (commission).

**M12 Back-office** (dépôt `falachabt/elearn`, `staff.elearnprepa.com`) : contenu, offres et prix par pays sans nouvelle version de l'app, suivi des paiements, support, modération, tableau de bord, rôles.

**M13 Mesure.** Chaque étape de l'entonnoir est mesurée, y compris le **paiement réussi (événement serveur)**. Le chiffre d'affaires se calcule depuis la base, pas depuis PostHog.

**M14 Multi-pays.** Configuration par pays (devise, prix, programmes, concours, langue), packs locaux, ouverture par drapeau de fonctionnalité, français par défaut, anglais prévu (déjà en place dans l'app).

**M15 Récompenses.** Voir `01-produit-et-decisions.md`. Portefeuille unique `reward_ledger` écrit par le serveur seul ; crédits utilisés **après** le quota gratuit du jour (« 3 gratuites + N crédits ») ; paliers déclarés dans le back-office ; jauge sur l'accueil ; parrainage (lien et code personnels, saisie possible 7 jours) ; anti-abus serveur ; page publique « Comment gagner des récompenses ».

**M16 Interactivité.** M16-01 service de retours unique, aucun écran ne joue un son ou une vibration en direct. M16-02 Paramètres › Sons et vibrations (3 interrupteurs + aperçu). M16-03 préférences mémorisées (aussi en invité), copiées dans le profil à l'inscription. M16-04 mode silencieux respecté. M16-05 « réduire les animations » du téléphone appliqué par défaut. M16-07 sons < 300 Ko, CC0, préchargés. M16-09 60 i/s visées, durées 120 / 200 / 300 ms. M16-10 mode concentration pendant les épreuves chronométrées. M16-12 états succès/erreur/chargement/vide pour chaque écran.

## Exigences non fonctionnelles

Android 8+ et iOS ; téléphones de 2 Go de mémoire ; utilisable en 3G et avec coupures ; ouverture < 3 s ; premier résultat < 2 min ; tuteur < 25 s (95 %) ; contrastes AA, cibles tactiles larges ; aucune information donnée seulement par un son ; réponse visible à tout appui < 100 ms ; journal d'erreurs et alertes.

## Sécurité (section 7)

S-01 aucun secret dans le code ni le dépôt. S-02 RLS sur toutes les tables, revue avant chaque mise en production. S-03 limitation de débit (IA, messages). S-04 données des mineurs au minimum, pas de messages privés entre élèves. S-05 consentements enregistrés. S-07 journal des actions sensibles du back-office.

## Événements PostHog (dictionnaire, section 8.1)

`app_first_open`, `onboarding_choice_made`, `first_result_seen`, `signup_prompt_seen`, `signup_completed`, `login_started` / `login_completed` / `login_failed`, `mission_started` / `mission_completed`, `ai_request_sent` / `ai_answer_seen` / `ai_answer_reported`, `quota_reached`, `paywall_viewed`, `offer_selected`, `payment_initiated`, **`payment_succeeded` (serveur)**, `payment_failed`, `parent_link_sent` / `parent_link_opened` / `parent_payment_opened`, `school_class_created`, `class_member_joined`, `partner_lead_created`, `notification_opened`, `referral_link_shared` / `referral_signup` / `referral_activated`, `reward_granted` / `reward_spent` / `reward_expired` (serveur), `milestone_reached` / `milestone_reward_claimed`, `shared_content_opened`, `feedback_setting_changed`, `celebration_seen`. Propriétés de personne `sound_on`, `haptics_on`, `reduced_motion`.

L'app a un dictionnaire typé des événements dans `src/services/evenements.ts` (branche de dev) ; on y ajoute tout nouvel événement.

## Modèle de données proposé (section 9.1, à valider)

`profiles`, `parent_links` / `payment_links`, `missions` / `mission_items` / `mission_runs`, `ai_requests`, `products` / `prices`, `orders` / `order_events` (un seul journal de paiements), `entitlements`, `schools` / `classes` / `class_members`, `partners` / `campaigns` / `leads`, `countries` / `country_packs`, `reward_ledger`, `referral_codes` / `referrals`, `community_milestones` / `milestone_claims`, `share_links` / `share_opens`. Déjà créées (branche de dev de `elearn-supabase`) : `referrals`, `first_results`.

## Recette (section 13), critères de fin

Toutes les exigences M du lot validées ; test terrain avec 20 élèves (premier résultat < 2 min pour 80 %) ; 10 paiements réels MTN et Orange de bout en bout ; événements remontés dont `payment_succeeded` ; revue de sécurité passée ; 3G simulé et hors ligne ; lien parent de bout en bout ; M16 vérifié sur Android d'entrée de gamme et iPhone (normal, silencieux, animations réduites) ; test rapide iOS et web.
