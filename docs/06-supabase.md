# Supabase : ce que l'app attend et comment travailler

Le backend est dans le dépôt **privé** `falachabt/elearn-supabase` (migrations, tests, fonctions serveur, audit de sécurité). Voir son `CLAUDE.md` et `docs/`. Ce fichier résume ce qui concerne l'app.

## Règles

- Même projet Supabase de production que l'ancienne app (contenu et ~6 400 comptes). **Ne jamais y toucher** sans accord de Benny (migrations, SQL, config auth, secrets). Lectures seules en prod : seulement s'il les autorise.
- **Pas de branche Supabase payante.** Tout se teste en local : Docker + CLI Supabase. Démarrage (dans `elearn-supabase`) : lancer `dockerd` en arrière-plan puis `npx supabase start -x studio,imgproxy,vector,mailpit,logflare,edge-runtime` ; tests : `npx supabase test db` (CLI épinglée à 2.118.0 en CI, la version « latest » a atteint la limite de l'API GitHub).
- Ajouts seulement tant que l'ancienne app est en ligne : nouvelles tables, jamais de suppression ni de renommage avant la bascule.
- Toute nouvelle table a la **RLS activée dans la même migration**, avec tests pgTAP. Le statut d'un paiement et le journal de récompenses ne s'écrivent **que côté serveur** (clé de service).
- Dans l'app : **clé anon uniquement** (`EXPO_PUBLIC_SUPABASE_ANON_KEY`). Aucune clé de service, aucun secret de fournisseur d'IA ou de paiement dans l'app. L'IA et les paiements passent par des fonctions serveur.
- Anonymous sign-ins : activés en prod par Benny (la session invité en dépend). En local : `enable_anonymous_sign_ins = true`.

## Ce que l'app utilise déjà

- Session invité (`SessionProvider`, `useSession`) → utilisateur `is_anonymous = true`.
- Conversion invité → compte : `auth.updateUser({ email, password, data })` (même utilisateur, progression gardée). Google : `linkIdentity` (nécessite `enable_manual_linking = true` et la redirection `elearnprepa://auth/callback`). Apple : `signInWithIdToken` (nonce `expo-crypto`). Facebook : OAuth Supabase quand le fournisseur est activé.
- Parrainage : metadata utilisateur `referral_code` → table `referrals` (RLS : lecture de sa propre ligne, aucune écriture client) remplie par un trigger sur `auth.users`. Migration `20260930130000_referrals_capture.sql`.
- Premier résultat : table `first_results` (migration `20260930150000_first_results.sql`, M1-03/M1-04).
- Trigger d'inscription en SECURITY DEFINER : `20260930120000_auth_insert_trigger_security_definer.sql`.

## Pas encore appliqué en production

Les 3 migrations ci-dessus ne sont **pas** en prod. Elles ne sont appliquées qu'après relecture de Benny, avec le reste de la liste de `10-avant-la-production.md`.

## Ce qui viendra (phases 3 et 4)

Fonctions serveur : liens de paiement parent (`GET /payment-links/:jeton`, `POST …/pay`, `GET …/status`, `GET /parent-summaries/:jeton`, `GET /shares/:id`, contrat décrit dans `elearn-site/src/lib/liens-paiement.ts`), webhook pawaPay → `payment_succeeded`, droits d'accès, `reward_ledger`, aide par photo (IA), paliers.
