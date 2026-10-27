# Grille de crédits appliquée — prix relevés et gains quotidiens divisés par 3

- Date : 27 octobre 2026
- Auteur : Muse
- État : fait
- Zones touchées : elearn-supabase (PR #190, migration `20261027120000_grille_credits_blocage.sql`, déployée) ; elearn-app (commit direct sur `claude/project-thread-kw792g`)

## Décision de Benny (27/10/2026)

Appliquer la grille corrigée issue des analyses « économie des crédits » des 26/10/2026 (`2026-10-26-muse-economie-credits-simulation.md` et `2026-10-26-muse-economie-credits-blocage-mardi.md`) : prix relevés pour qu'un élève actif épuise sa recharge du lundi (25 crédits, inchangée) dès le mardi, et gains quotidiens divisés par 3 — le « robinet » qui permettait jusqu'à +175 crédits/semaine de récompenses accumulables. La correction d'annale est à **10** (prix fixé par Benny, pas les 6 proposés dans l'analyse).

## Serveur — elearn-supabase PR #190, migration `20261027120000_grille_credits_blocage.sql`

### Prix des déblocages (`credit_actions`)

| Action | Avant | Après |
|---|---|---|
| quiz_explanation | 1 | 1 (inchangé) |
| cert_explanation | 1 | 1 (inchangé) |
| cert_mock_mini_ten (mini TOEIC 12 q) | 1 | **3** |
| exercise_solution | 2 | **3** |
| cert_mock_mini_twenty (mini TOEIC 20 q) | 2 | **4** |
| document_pdf | 3 | **4** |
| cert_mock_review (corrigé de test TOEIC) | 3 | **5** |
| course_video | 3 | **6** |
| ai_question | 10 relevé en production (5 à l'origine) | **6** (prix décidé) |
| exam_correction (correction d'annale) | 5 | **10** |
| cert_mock_half (demi-test TOEIC) | 8 | **12** |
| cert_mock_full (test complet TOEIC) | 15 | **20** |

Note `ai_question` : les analyses annonçaient 5, mais le relevé en production avant application a montré **10** (retouche passée par le back-office, invisible depuis les migrations). C'est le prix décidé de **6** qui a été appliqué, comme validé par Benny.

### Gains quotidiens divisés par 3

Les montants vivaient dans les corps de fonctions ; elles sont remplacées à l'identique, seuls les montants changent :

- `claim_daily_action` : visiter le site 10 → **3**, Facebook 5 → **2**, Instagram 5 → **2**
- `grant_share_reward` : partage d'une correction photo 5 → **2**

Inchangés : gains TOEIC, parrainage, recharge du lundi (25), bonus de bienvenue (40). Les récompenses déjà gagnées et en réserve ne sont pas reprises (seuls les gains futurs changent) ; les déblocages déjà payés restent acquis (les nouveaux prix ne touchent que les nouveaux déblocages).

### Tests pgTAP

- Nouveau : `supabase/tests/credits/08_grille_credits.sql` (19 assertions : les 12 prix du catalogue, les 4 gains, l'anti-abus quotidien, le total de 9 au journal).
- Mis à jour : `02_daily_actions.sql` (nouveaux montants) et `07_credits_videos.sql` (vidéo à 6 crédits).
- CI de la PR : pgTAP + fonctions **verts** ; run de déploiement sur `main` après fusion : pgTAP, fonctions et **deploy success** (migration appliquée par `supabase db push`).

## Vérification production (après déploiement)

Catalogue relu en production (lecture publique PostgREST) : **12 prix sur 12 conformes** à la grille décidée (quiz_explanation 1, cert_explanation 1, cert_mock_mini_ten 3, exercise_solution 3, cert_mock_mini_twenty 4, document_pdf 4, cert_mock_review 5, course_video 6, ai_question 6, exam_correction 10, cert_mock_half 12, cert_mock_full 20).

Les 4 montants de gains vivent dans les corps de fonctions, non relisibles par l'API publique : ils sont garantis par la migration déployée (job deploy success) et prouvés par le pgTAP de la CI, qui rejoue toutes les migrations et réclame chaque gain (site 3, Facebook 2, Instagram 2, partage 2).

## App — elearn-app, commit direct sur kw792g

Les prix affichés (feuille de coût, pastille prix des vidéos) sont lus depuis le catalogue serveur : rien à changer de ce côté. En revanche, les gains quotidiens affichés étaient codés en dur :

- `src/services/actionsCredits.ts` : `ACTIONS_QUOTIDIENNES` — site 10 → **3**, Facebook 5 → **2**, Instagram 5 → **2** (l'écran Crédits affiche ces valeurs) ; commentaire associé mis à jour.
- `src/i18n/fr.ts` et `src/i18n/en.ts` : textes du partage de correction photo « +5 crédits » → **+2 crédits** (texte de découverte et toast de récompense).
- `src/services/__tests__/actionsCredits.test.ts` : attentes ajustées (site 3, Instagram 2).

Validation locale : typage OK, lint 0 erreur, suites ciblées vertes (actionsCredits, credits, creditsVideos, creditsPage, photo : 5 suites, 65 tests), export Android/Hermes OK. Commit `67a52c71` ; CI « Contrôles et EAS preview » **verte** sur ce commit (run 40491447889, validation complète + OTA preview publiée).
