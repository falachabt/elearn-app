-- Entrepôt PostHog : lecture seule de la base Supabase par un utilisateur dédié.
-- À LANCER PAR BENNY dans l'éditeur SQL du projet « elearn » (Supabase), après relecture. Rien n'est appliqué par Claude.
-- Ne contient aucune donnée personnelle : pas d'e-mail, de numéro (même masqué), de jeton, de pièce jointe, de texte libre.
-- Retour arrière : voir la fin du fichier.

-- 1. Schéma dédié : PostHog ne lit que ce schéma.
create schema if not exists posthog_export;

-- 2. Vues. Les vues appartiennent à `postgres` : elles lisent les tables malgré la RLS, c'est voulu, et c'est pour cela
--    que seules des colonnes sans donnée personnelle y figurent.
create or replace view posthog_export.v_users as
  select id as user_id, created_at, last_sign_in_at, coalesce(is_anonymous, false) as is_anonymous,
         raw_app_meta_data->>'provider' as provider
  from auth.users;

create or replace view posthog_export.v_orders as
  select id as order_id, user_id, product_code, country, currency, amount, list_amount, status, channel, provider,
         (payment_link_id is not null) as paye_par_proche, (promo_code_id is not null) as avec_promo,
         discount_type, discount_value, failure_code, sandbox, created_at, updated_at, paid_at, refunded_at
  from public.orders;

create or replace view posthog_export.v_entitlements as
  select id, user_id, product_code, source, starts_at, ends_at, revoked_at, created_at
  from public.entitlements;

create or replace view posthog_export.v_credit_ledger as
  select id, user_id, delta, kind, action_code, balance_after, created_at
  from public.credit_ledger;

create or replace view posthog_export.v_referrals as
  select id, referrer_id, referee_id, status, captured_at, step1_at, step2_at, step3_at
  from public.referrals;

create or replace view posthog_export.v_referral_rewards as
  select id, user_id, milestone_id, granted_at, claimed_at, platform, credits_granted
  from public.referral_rewards;

create or replace view posthog_export.v_referral_milestones as
  select id, referrals_needed, reward_type, reward_value, active
  from public.referral_milestones;

create or replace view posthog_export.v_missions as
  select id, user_id, day, level, score, total, duration_s, created_at
  from public.mission_runs;

create or replace view posthog_export.v_photo_corrections as
  select id, user_id, subject, status, model, duration_ms, created_at, finished_at
  from public.photo_corrections;

create or replace view posthog_export.v_first_results as
  select id, user_id, kind, level, score, total, duration_s, taken_at
  from public.first_results;

create or replace view posthog_export.v_lesson_validations as
  select user_id, lesson_id, course_id, score, total, validated_at
  from public.lesson_validations;

create or replace view posthog_export.v_exercise_completions as
  select user_id, exercise_id, done_at
  from public.exercise_completions;

create or replace view posthog_export.v_promo_codes as
  select id, code, discount_type, discount_value, product_codes, max_uses, used_count, expires_at, active, created_at
  from public.promo_codes;

create or replace view posthog_export.v_pass_products as
  select code, duration_days, active
  from public.pass_products;

-- 3. Utilisateur en lecture seule. Remplacer le mot de passe par un mot de passe long généré (gestionnaire de mots de passe),
--    puis le saisir une seule fois dans PostHog. Ne jamais le mettre dans un dépôt ni dans un message.
create role posthog_reader with login password 'REMPLACER_PAR_UN_MOT_DE_PASSE_LONG' nosuperuser nocreatedb nocreaterole noreplication connection limit 5;

-- Rien d'autre que le schéma dédié.
revoke all on schema public from posthog_reader;
revoke all on all tables in schema public from posthog_reader;
grant usage on schema posthog_export to posthog_reader;
grant select on all tables in schema posthog_export to posthog_reader;
alter default privileges in schema posthog_export grant select on tables to posthog_reader;

-- Garde-fous : lecture seule et requêtes bornées.
alter role posthog_reader set default_transaction_read_only = on;
alter role posthog_reader set statement_timeout = '60s';

-- 4. Contrôle (à lancer ensuite) : doit renvoyer des nombres, et aucune colonne e-mail ou téléphone.
-- select count(*) from posthog_export.v_orders;
-- select column_name from information_schema.columns where table_schema = 'posthog_export' and column_name ~* '(mail|phone|msisdn|token|jeton|password)';

-- Retour arrière (supprime tout ce qui précède, sans toucher aux tables d'origine) :
-- drop schema posthog_export cascade;
-- drop role posthog_reader;
