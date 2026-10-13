# Plan : connecter la base Postgres à PostHog (entrepôt de données)

Statut : prêt à brancher, rien n'est installé (le SQL est livré, pas appliqué). Toute création de rôle ou de vue en production demande l'accord de Benny et passe par `elearn-supabase` (migration additive via `supabase/schemas/*.sql` puis `supabase db diff`, PR, jamais de push sur `main`). Les noms de colonnes ci-dessous sont à confirmer contre le schéma réel au moment de la migration.

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

## Branchement : étapes exactes pour Benny

Claude ne peut pas créer la source : le mot de passe doit être saisi par Benny dans PostHog, et la création du rôle touche la production (accord de Benny requis). Tout est prêt, il reste trois gestes.

1. **Créer le rôle et les vues** : relire puis lancer `docs/analytics/entrepot-postgres.sql` dans l'éditeur SQL Supabase du projet « elearn ». Remplacer d'abord `REMPLACER_PAR_UN_MOT_DE_PASSE_LONG` par un mot de passe long généré (le garder dans le gestionnaire de mots de passe). Le fichier crée le schéma `posthog_export` (14 vues sans donnée personnelle), l'utilisateur `posthog_reader` (lecture seule, 5 connexions au plus, requêtes limitées à 60 s) et donne la requête de contrôle ainsi que le retour arrière.
2. **Relever les paramètres de connexion** : dans Supabase, bouton **Connect** en haut, onglet **Direct**, choisir **Session pooler**. Prendre l'hôte affiché.
3. **Créer la source dans PostHog** : Data pipeline, Sources, New source, **Supabase**, puis saisir :

| Champ | Valeur |
| --- | --- |
| Host | l'hôte du **Session pooler** relevé à l'étape 2 (forme `aws-0-eu-central-1.pooler.supabase.com`, région du projet : eu-central-1) |
| Port | `5432` |
| Database | `postgres` |
| User | `posthog_reader.yhznbitjlzeslvudbsil` (nom du rôle, point, référence du projet) |
| Password | le mot de passe de l'étape 1 |
| Schema | `posthog_export` |

Pourquoi le **Session pooler** et pas la connexion directe : l'hôte direct `db.<ref>.supabase.co` n'est joignable qu'en IPv6, et PostHog n'y arrive pas ; le Session pooler répond en IPv4. Aucune liste d'adresses IP à autoriser n'est nécessaire avec le pooleur ; si une restriction réseau a été activée sur le projet, il faut y ajouter les adresses de sortie de PostHog (région US), données par PostHog à l'écran de création.

Tables à cocher et fréquence : cocher les 14 vues `v_*`. Les vues n'ont pas de clé primaire, donc PostHog ne propose pas la synchro incrémentale : choisir **Full table** (rafraîchissement complet), **une fois par jour** au début. Les volumes sont petits (quelques milliers de lignes), le coût est négligeable. Quand `v_credit_ledger` ou `v_missions` grossissent, passer cette vue en table suivie par un curseur `created_at` (demande à Claude de préparer la migration).

Contrôle après la première synchro : dans PostHog, requête SQL `select count() from v_orders` ; comparer avec `select count(*) from orders` dans Supabase. Vérifier ensuite qu'aucune colonne ne ressemble à un e-mail ou un téléphone (requête de contrôle en fin de fichier SQL). Jointure avec les évènements : `v_orders.user_id` = identifiant de la personne PostHog (`events.distinct_id`).

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
