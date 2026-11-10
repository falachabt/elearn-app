# Cohérence des formats de tests — écarts cosmétiques I-2, I-3, I-5 de l'audit du 25 octobre : prise

- Date : 25 octobre 2026, 22 h 27 UTC
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/ReglageMini.tsx` (écran de réglage T2 du mini-test), textes fr/en (`src/i18n/fr.ts`, `src/i18n/en.ts` : intro du choix de partie, aide mini-test du plan), démo web (`src/services/certification/demo/apiDemo.ts`, `src/services/certification/demo/reglages.json`), tests. Réassignation ponctuelle à Muse, suite de l'audit `2026-10-25-2224-claude-audit-coherence-formats-tests.md`. Ni I-1 (bloquante, côté supabase), ni I-4 (décision produit en attente) ne sont touchées ici.

## Contexte

L'audit de cohérence du 25 octobre 2026 (promis = plan serveur = servi = affiché = minuteur) a confirmé que les formats tiennent leurs comptes depuis les PR supabase #171/#172. Trois écarts cosmétiques restent côté app, tous liés au passage des minis des parties 3, 4 et 6 à **12 questions** :

1. **I-2 — l'écran de réglage du mini (T2) annonce 10 pour les parties 3, 4 et 6.** `ReglageMini.tsx` affiche le sélecteur de longueur avec le palier demandé (10) et calcule la ligne Temps sur ce même palier (« 10 minutes pour 10 questions »), alors que le serveur servira 12 questions et que le minuteur réel — déjà figé sur le servi au départ — donnera 12 minutes. Le composant charge les réglages mais n'utilise pas `longueurMiniServie(partie, reglages)`.
2. **I-3 — textes statiques « 10 questions » devenus faux pour P3/P4/P6.** `certification.tests.listes.choixPartie.intro` (« Chaque mini-test porte sur une seule partie : 10 questions. ») sur l'écran de choix de partie, et `certification.monPlan.miniAide` (« 10 questions, correction à la fin ») dans Mon plan, sans partie visée dans les deux cas.
3. **I-5 — démo web : le mixte suit l'ancien plan.** `apiDemo.ts` répartit le mini mixte selon `diag_blueprint` {1,2,4,3,3,2,5} et sa fonction `tirer` tronque le dernier groupe pour tomber juste ; le serveur utilise `mini_mixed_counts` {2,2,3,3,2,4,4} depuis #171 et ne tronque jamais un groupe.

## Corrections retenues

### I-2 — annonce de la longueur servie dans ReglageMini

- Quand une partie est choisie et que le palier de base est sélectionné, la longueur annoncée est `longueurMiniServie(partie, reglages)` : le sélecteur l'affiche (libellé et pastille du cube de base) et la ligne Temps calcule `dureeMiniMin` sur cette longueur (« 12 minutes pour 12 questions » pour P3/P4/P6). Le palier 20 et le mixte sont inchangés (le mixte n'a pas de partie : sa longueur annoncée reste le palier demandé).
- Le départ continue d'envoyer le palier **demandé** (10) au serveur : c'est le contrat de `cert_mini_start`, qui sert 12 pour ces parties et débite l'action du palier. Aucun changement de coût ni d'action.

### I-3 — textes en fourchette, comme `detailMiniPartiePlage`

- `choixPartie.intro` devient « Chaque mini-test porte sur une seule partie : 10 ou 12 questions selon la partie. » (en : « Each mini-test covers one part: 10 or 12 questions depending on the part. »).
- `monPlan.miniAide` devient « 10 ou 12 questions selon la partie, correction à la fin » (en : « 10 or 12 questions depending on the part, correction at the end »).
- **Point connu, non corrigé** : le libellé d'action de crédits `credits.actions.cert_mock_mini_ten` (« Mini-test de 10 questions ») reste tel quel — nom de produit assumé par la migration #172 (le palier de base ne change ni de prix ni de nom) ; l'historique de crédits d'un mini de partie 3, 4 ou 6 affichera ce nom pour 12 questions servies. Cosmétique assumée, signalée ici comme le demande l'audit.

### I-5 — démo alignée sur le plan mixte du serveur

- `reglages.json` de la démo gagne la ligne `mini_mixed_counts` {1:2, 2:2, 3:3, 4:3, 5:2, 6:4, 7:4}, extraite de la migration comme les autres réglages.
- `apiDemo.ts` lit ce plan (`planMixte`, à la place de `diag_blueprint` qui n'est plus lu par la démo) et tire par **groupes entiers** (`tirerGroupesEntiers`, comme le diagnostic de la démo) : mini mixte à la volée (plan mis à l'échelle pour un total de 10 par la méthode du plus fort reste, comme `cert_mixed_counts`, puis appoint en unités entières jusqu'au total, comme `cert_draw_mixed`), mini par partie à la volée et séries (par partie ou mixtes).
- `tirer` (troncature du dernier groupe) ne sert plus qu'au départ des tests fixes de la démo, dont la répartition consomme la banque entière de chaque partie : aucune troncature n'y survient en pratique. Les ancrages des fiches de notion (3 questions d'exemple) restent aussi sur `tirer`, hors périmètre de l'audit.

## Tests

- `tests.test.tsx` (T2) : partie 6 au palier de base → sélecteur et ligne Temps annoncent 12 ; partie 2 → 10 inchangé ; mixte → annonce inchangée.
- Textes : les écrans de choix de partie et Mon plan affichent les nouvelles formulations (les tests existants qui lisaient les anciennes chaînes sont adaptés).
- Démo : nouveau test sur `apiDemo.demarrerMini` mixte — répartition {2,2,3,3,2,4,4} à 20 questions, groupes jamais tronqués (chaque groupe servi en entier) ; mini par partie 6 au palier de base → 12 questions en groupes entiers ; série de partie 6 → groupes entiers.
- Captures Playwright de l'écran de réglage d'un mini Partie 6 annonçant 12 questions, clair et sombre, dans `~/workspace/captures-coherence-minis/`.

Commits locaux uniquement, aucun push : un push groupé est en cours de CI ; ces correctifs partiront dans un push ultérieur décidé par Benny.
