# Issue #82 [TOEIC-A7] Résultat diagnostic (score exact) — prise

- Date : 26 octobre 2026, 11:48 UTC
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/ResultatDiagnostic.tsx` (affichage du score), `src/components/certification/HistoriqueTests.tsx` (fonction partagée `resultatTentative`, relecture du diagnostic dans l'historique T4 et le détail T7), `src/services/certification/types.ts` (commentaire du champ `score`), textes fr/en `certification.historique.scoreExact`, tests `diagnostic.test.tsx` et `tests.test.tsx`.

## Mandat

Réassignation ponctuelle de Benny à Muse pour cette seule issue (chaîne choisie par Benny le 26/10/2026 : supabase #129 puis app #82). Le volet serveur (elearn-supabase #129) est déployé en production le 26/10/2026 : `cert_attempt_finish` renvoie désormais `score` (exact, 10 à 990, multiple de 5) pour les tentatives `diagnostic`, y compris en rejeu, et la colonne `score` de `cert_mock_attempts` est rattrapée pour les diagnostics terminés avant ce jour.

## État de l'existant (vérifié dans le code, pas supposé)

- **Fin de tentative (A7)** : déjà branché depuis le 21/10/2026 (commit 66b6b4f, dev TOEIC) — `ResultatDiagnostic` affiche `fin.score` en un chiffre net, test verrouillé (« 700 », absence de « 650 à 730 »). Il ne manquait que la valeur serveur, livrée par #129. Reste un trou : si `score` est absent d'un `fin` ancien gardé sur l'appareil, l'écran affiche « pas estimé » alors que la fourchette existe. Correctif retenu : passer par `scoreEstime(fin)` (exact, sinon milieu de la fourchette) — le patron déjà validé sur l'accueil et Moi (commit f7c0642).
- **Relecture** : `listerTentatives` lit déjà la colonne `score` (api.ts), et `suivi.ts`/`pointsCourbe` l'utilisent, mais `resultatTentative` (HistoriqueTests, réutilisée par DetailTentative) l'ignore : une ligne de diagnostic y affiche encore « estimation 720 à 770 ». C'est le reste à faire principal de #82.
- **Cahier** : §5.R (v1.18/v1.19) — le score estimé s'affiche en un chiffre net partout (accueil, Statistiques, Historique T4, Moi, résultat A7), la fourchette n'est plus utilisée comme résultat. A7, textes exacts : « Score estimé », « 745 », « Estimation, pas un score officiel. » (déjà en place).

## Changements prévus (minimaux, aucun écran redessiné)

1. `ResultatDiagnostic` : score affiché via `scoreEstime(fin)`.
2. `resultatTentative` : si la tentative porte un score exact, l'afficher (« 745 sur 990 », nouvelle clé `certification.historique.scoreExact` fr/en, miroir de `accueilToeic.scoreExact`) ; sinon comportement inchangé (fourchette en repli, puis « c sur n »).
3. Commentaire de `TentativeListee.score` : le diagnostic porte aussi un score exact depuis #129.
4. Tests : A7 avec `score` absent → milieu de fourchette affiché ; historique — ligne diagnostic avec score 745 → « 745 sur 990 », ligne diagnostic sans score → fourchette conservée (déjà verrouillée), détail T7 d'un diagnostic à score exact.

## Surfaces signalées, non touchées (hors #82)

- Tuiles d'en-tête de l'onglet Tests (T1) et de l'Historique (T4) : `derniereEstimation` + `scorePlage` affichent la fourchette de la dernière estimation, tous types confondus — chantier du dev TOEIC (issues #108/#109), le type `{min, max}` ne porte pas le score exact.
- Statistiques (ST1) : `lireStats` mappe déjà `score.valeur` (exact) ; l'affichage relève de l'écran du dev TOEIC.
- `BilanMini`/`BilanDefinition` : mécanique `score_max` des tests composés, sans rapport avec le diagnostic.

## Changelog OTA (à publier côté base par le canal habituel)

- FR : « Ton résultat de diagnostic s'affiche maintenant en un seul chiffre exact, dans le résultat et dans ton historique. »
- EN : « Your diagnostic result now shows as one exact score, on the result screen and in your history. »
