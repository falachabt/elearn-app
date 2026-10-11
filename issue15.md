## Tables (migration `20261003030000_parrainage_systeme.sql`)

referral_codes(id, user_id, code unique, created_at)

referral_milestones(id, referrals_needed int, reward_type text,
  reward_value int, label_fr text, label_en text, active bool)

referral_rewards(id, user_id, milestone_id, granted_at, claimed_at)

referrals(id, referrer_id, referee_id, code, status,
  referee_activated_at, purchase_reward_granted_at)

referral_abuse_log(id, event_type, user_id, details jsonb, created_at)

RLS : chaque utilisateur voit uniquement ses propres lignes.

## Fonctions (migration `20261003031000_parrainage_fonctions.sql`)
- `get_my_referral_code()` — renvoie ou cree le code personnel
- `apply_referral_on_signup(p_code text)` — rattache filleul au parrain
- `check_referral_milestones(p_user_id uuid)` — verifie paliers, accorde recompenses
- `claim_referral_reward(p_reward_id uuid)` — marque la recompense reclamee
- `get_referral_stats()` — filleuls actifs, recompenses en attente, rang
- `discount_for_new_referee(p_user_id uuid)` — reduction 15% premier achat filleul
- Anti-abus : meme appareil ou meme IP dans les 24h -> logguer dans `referral_abuse_log`

## Missions de parrainage (migration `20261003032000_parrainage_missions.sql`)
Missions speciales "Parrainer 1 ami -> +50 credits" dans le systeme de mission existant.

## Criteres d'acceptation
- Un utilisateur obtient un code unique a la demande.
- Un filleul qui s'inscrit avec le code est rattache au parrain.
- Les paliers accordent des recompenses automatiquement.
- L'anti-abus bloque les auto-parrainages evidents.

## 🔔 Nouveauté (Règles Métier et Notifications)
**Étapes de parrainage, Récompenses et Notifications Push :**
Le système backend doit gérer le déclenchement des notifications et l'attribution des crédits/récompenses selon les 3 étapes suivantes :

1. **Clic/Utilisation du lien (Guest)** : Le parrain est notifié ("X a utilisé ton lien") et reçoit une récompense.
2. **Inscription complète (Création de compte)** : Le parrain est notifié ("Ton filleul X a créé son compte") et reçoit sa 2ème récompense. Le **filleul** reçoit sa récompense de bienvenue à ce moment-là.
3. **Conversion (Achat d'un Pass)** : Le parrain est notifié ("Ton filleul X a pris son pass") et reçoit un bonus.

*Implémentation : Prévoir l'appel à public.notify_student pour chaque étape.*
