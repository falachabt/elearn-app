# Plan : connecter la base Postgres à PostHog (entrepôt de données)

Statut : plan seulement, rien n'est installé. Toute création de rôle ou de vue en production demande l'accord de Benny et passe par `elearn-supabase` (migration additive via `supabase/schemas/*.sql` puis `supabase db diff`, PR, jamais de push sur `main`). Les noms de colonnes ci-dessous sont à confirmer contre le schéma réel au moment de la migration.

## But

Croiser dans PostHog ce que l'app mesure (pages, boutons, parcours) avec ce que la base sait vraiment (paiements confirmés, crédits, parrainage, missions, corrections IA), pour des analyses du type : « quel parcours mène à un paiement confirmé », « rétention des élèves payants contre gratuits », « coût en crédits par élève actif ». Le chiffre d'affaires reste calculé dans la base ; PostHog sert à expliquer le comportement qui le précède.

## Identifiant commun

`user_id` de la base (identifiant Supabase Auth, invité inclus) = `distinct_id` PostHog. L'app identifie l'invité et le compte par cet identifiant, et un invité qui change d'utilisateur est fusionné par alias. La jointure HogQL se fait donc entre `persons` (ou `events.distinct_id`) et `user_id`. Autres clés : `order_id` (paiement), code de parrainage (public), identifiants de contenu (leçon, unité). Aucun e-mail, téléphone ni jeton ne sert de clé.

## Tables à synchroniser (par vues, jamais les tables brutes)

Créer un schéma dédié `posthog_export` qui ne contient que des vues sans donnée personnelle. PostHog lit ce schéma seulement.

| Vue | Source | Contenu utile | Synchro |
| --- | --- | --- | --- |
| `v_users` | `auth.users` et profil | identifiant, date de création, invité ou compte, pays, classe, statut, langue, Pass actif | incrémentale `updated_at` |
| `v_orders` | `orders`, `order_events` | commande, utilisateur, offre, montant, devise, pays, prestataire, statut, date de paiement, code promo, payeur (élève ou parent) | incrémentale |
| `v_entitlements` | `entitlements`, `pass_products` | utilisateur, offre, début, fin, source | incrémentale |
| `v_credit_ledger` | `credit_ledger`, `credit_actions` | utilisateur, type, action, variation, solde après, date | incrémentale `created_at` |
| `v_referrals` | `referrals`, `referral_rewards`, `referral_milestones` | parrain, filleul, étape (clic, compte, achat), récompense, date | incrémentale |
| `v_missions` | `mission_runs` | utilisateur, jour, score, total, durée, série | incrémentale |
| `v_photo_corrections` | `photo_corrections` | utilisateur, matière, statut, durée, date (sans image ni texte) | incrémentale |
| `v_learning` | `lesson_validations`, `user_step_progress`, `exercise_completions`, `practice_progress` | utilisateur, type, référence, score, date | incrémentale |
| `v_promo` | `promo_codes`, `promo_attempts` | code, type, valeur, utilisations, tentatives | complète (petite) |
| `v_catalogue` | `pass_products`, `pass_prices`, `countries` | offres, prix, pays | complète (petite) |

À exclure absolument : e-mail et téléphone de `auth.users`, `guardian_contacts`, `parent_contacts`, `parent_outbox`, `discussion_messages` et pièces jointes, `support_*`, `whatsapp_webhook_events`, `payment_webhook_events`, `payment_links` (jetons), `order_invoices`, `credit_devices` (identifiants d'appareil), `account_deletion_requests`.

## Branchement

1. Rôle `posthog_reader` en lecture seule, avec `SELECT` sur le schéma `posthog_export` uniquement et rien sur `public` ni `auth`. Mot de passe dans le gestionnaire de secrets, jamais dans un dépôt.
2. Connexion par le pooleur Supabase en SSL ; adresses IP de sortie de PostHog (région US) autorisées si la restriction réseau est active.
3. PostHog : Données, Sources, Postgres ; choisir les vues du schéma `posthog_export` ; mode incrémental sur `updated_at` ou `created_at` ; fréquence quotidienne au début, horaire plus tard si utile.
4. Dans PostHog, joindre chaque vue à `persons` par `user_id`, puis enregistrer des requêtes enregistrées pour les analyses récurrentes.
5. Contrôle : comparer le nombre de commandes payées d'une semaine entre la vue et la base ; vérifier qu'aucune colonne ne contient d'e-mail ni de téléphone.

## Évènements serveur à émettre (en plus de la synchro)

La synchro donne l'état, pas le moment du comportement. Quelques évènements doivent partir du serveur, parce que l'app ne les voit pas ou que la confirmation vient d'un tiers :

| Évènement | Où | Identifiant d'évènement |
| --- | --- | --- |
| `payment_succeeded_server` | webhook pawaPay confirmé (Edge Function) | `uuid` = `order_id`, donc jamais en double |
| `referral_activated` | premier paiement du filleul | `uuid` = identifiant de la récompense |
| `reward_granted`, `reward_expired` | portefeuille de récompenses | identifiant de la ligne de récompense |
| `parent_link_opened`, `parent_payment_opened` | site `elearn-site`, page `/p/[token]` | sans le jeton, avec l'`order_id` |

Appel : API de capture PostHog côté serveur avec `distinct_id` = `user_id`, clé de projet publique en variable de l'Edge Function (pas dans le dépôt), `uuid` fixe pour l'idempotence.

## Ordre conseillé

1. Vues `posthog_export` et rôle `posthog_reader` (migration additive, test pgTAP : le rôle ne lit rien d'autre).
2. Source Postgres dans PostHog sur deux vues d'abord (`v_orders`, `v_users`), contrôle des chiffres.
3. Autres vues, puis évènements serveur.
