# Issue #82 [TOEIC-A7] Résultat diagnostic (score exact) — implémentation

- Date : 26 octobre 2026, 12:20 UTC
- Auteur : Muse
- État : fait — validation locale complète verte, captures de recette faites, push sur `claude/project-thread-kw792g` dans la foulée (le hash de tête et le run CI/OTA sont rapportés en commentaire de l'issue #82).
- Zones touchées : voir l'échange de prise `2026-10-26-1148-claude-issue-82-score-exact-prise.md`.

## Ce qui a été fait

1. **Relecture (le manque principal)** — `resultatTentative` (`HistoriqueTests.tsx`, réutilisée par `DetailTentative`) affiche désormais le score exact quand la tentative en porte un : nouvelle clé `certification.historique.scoreExact` (fr « {{score}} sur 990 », en « {{score}} out of 990 », miroir d'`accueilToeic.scoreExact`). Repli inchangé sinon : fourchette si seuls `score_min`/`score_max` existent (données anciennes non rattrapées), puis « c sur n ». Conforme au cahier §5.R : un chiffre net sur l'Historique (T4) comme sur le résultat (A7).
2. **Fin de tentative (A7)** — déjà branchée sur `fin.score` depuis le 21/10/2026 (66b6b4f) ; seul le repli manquait : `ResultatDiagnostic` passe par `scoreEstime(fin)` — score exact du serveur (#129), sinon milieu de la fourchette pour un `fin` ancien gardé sur l'appareil (patron de l'accueil et de Moi, f7c0642), jamais la fourchette affichée, jamais « pas estimé » à tort.
3. **Commentaire de type** — `TentativeListee.score` : le diagnostic porte aussi un score exact depuis #129 (la colonne était déjà lue par `listerTentatives`).

Aucun écran redessiné, aucune structure d'écran Tests, Réviser ou Statistiques modifiée.

## Tests

- `tests.test.tsx` (T4/T7) : ligne diagnostic avec score 745 → « Diagnostic · 745 sur 990 » et absence de « 720 à 770 » ; détail T7 du même diagnostic → tuile « 745 sur 990 » ; ligne diagnostic sans score → « estimation 600 à 700 » conservée (repli verrouillé, déjà couvert) ; ligne mini mixte sans score → fourchette conservée.
- `diagnostic.test.tsx` (A7) : `fin` ancien sans `score` (650 à 730) → « 690 » affiché en un chiffre, fourchette absente ; le cas nominal 700 restait verrouillé.
- `certDiagnostic.test.ts` : `scoreEstime` exact (745) et repli (690) déjà verrouillés, inchangés.
- Validation locale complète `npm run valider` verte (typage, ESLint, Jest `--runInBand`, export Android Hermes).

## Captures de recette

Dossier `~/workspace/captures-a7-82/` (Expo web local, démo `EXPO_PUBLIC_CERT_DEMO=1`, Playwright, Chromium du cache ; états semés par localStorage : `cert.diagnostic` pour A7, `cert.demo.tentatives` pour l'historique) :

- `a7-resultat-745-390-clair.png` et `…-sombre.png` : « Ton résultat », « SCORE ESTIMÉ », **745**, « Une estimation, pas un score officiel. », maîtrise en 5 lignes — les textes exacts du cahier §5.A.
- `a7-resultat-repli-690-390-clair.png` : `fin` sans score exact (650 à 730) → **690** en un chiffre.
- `historique-diagnostic-390-clair.png` et `…-sombre.png` : ligne du 26 oct. « Diagnostic · **745 sur 990** », ligne ancienne sans score « Diagnostic · estimation 600 à 700 » (repli). La tuile d'en-tête « Score estimé » y montre encore la fourchette : c'est `derniereEstimation`/`scorePlage`, surface signalée dans l'échange de prise, non touchée (chantier du dev TOEIC).

## Reste hors #82 (signalé, non touché)

Tuiles d'en-tête Tests (T1) et Historique (T4) via `derniereEstimation` ; affichage Statistiques (ST1) ; mécanique `score_max` de `BilanMini`/`BilanDefinition`. Voir l'échange de prise pour le détail.
