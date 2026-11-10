---
date: 2026-10-26 18:14 UTC
auteur: muse
sujet: Correctif suite #82 — implémentation : le score exact fait foi avant la porte `estimated` dans `scoreEstime`
etat: fait
zones: src/services/certification/certDiagnostic.ts (scoreEstime), src/services/certification/__tests__/certDiagnostic.test.ts, src/components/certification/__tests__/diagnostic.test.tsx
---

# Implémentation — correctif « Pas encore » (suite de l'issue #82)

Prise : `echanges/2026-10-26-1743-muse-correctif-pas-encore-replay-prise.md`.

## Changement (un seul point)

`scoreEstime` (`src/services/certification/certDiagnostic.ts`) : le score exact du serveur est désormais renvoyé **dès qu'il est présent**, avant le test `estimated`. Le paramètre `estimated` devient optionnel dans la signature, car la forme « replay » de `cert_attempt_finish` ne le porte pas. Logique inchangée sinon : sans score exact, milieu de la fourchette si `estimated` et fourchette présente ; `null` sinon.

Les trois surfaces consommatrices (résultat A7, accueil via `chargerAccueil`, Moi via `ProgressionToeic`/`chargerAccueil`) partagent ce point unique ; aucune n'affichait volontairement « pas encore » pour un score présent — pas de régression.

## Tests

- Nouveau verrou unitaire : forme replay (`score: 745`, fourchette 720/770, pas de clé `estimated`) → 745.
- Nouveau verrou écran A7 : `fin` semé en forme replay dans le diagnostic stocké → « 745 » affiché, « Pas encore » absent.
- Verrous existants conservés : score exact nominal, repli milieu de fourchette (690), cas sans rien → `null`.
- Validation locale complète `npm run valider` verte : typage, ESLint, **234 suites / 2 599 tests**, export Android Hermes. (Premier passage : un timeout de 5 s sur le test du tour de première fois #123, sous charge — serveur de captures actif ; le fichier passait seul avant, et le second passage complet, machine libre, est vert de bout en bout.)

## Preuve visuelle

Dossier `~/workspace/captures-a7-82-replay/` (Expo web local, démo `EXPO_PUBLIC_CERT_DEMO=1`, Playwright, Chromium du cache ; état `cert.diagnostic` semé en forme replay exacte : `score: 745`, fourchette, `replay: true`, aucune clé `estimated`) :

- `a7-replay-avant-390-clair.png` : avant le correctif, « Pas encore » — reproduction à l'identique de la capture terrain de Benny.
- `a7-replay-apres-390-clair.png` et `a7-replay-apres-390-sombre.png` : après le correctif, « 745 » en un chiffre.

## Suite

Push sur `claude/project-thread-kw792g` dans la foulée ; commentaire sur l'issue #82. L'issue reste ouverte pour la validation terrain de Benny (rouvrir son résultat de diagnostic après application de l'OTA : le score doit s'afficher en un chiffre).
