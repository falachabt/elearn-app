---
date: 2026-10-26 17:43 UTC
auteur: muse
sujet: Correctif suite #82 — « Pas encore » sur le résultat du diagnostic rouvert (forme replay sans `estimated`)
etat: pris
zones: src/services/certification/certDiagnostic.ts (scoreEstime), src/services/certification/__tests__/certDiagnostic.test.ts, src/components/certification/__tests__/diagnostic.test.tsx
---

# Prise — correctif « Pas encore » (suite de l'issue #82)

Retour terrain de Benny le 26 octobre 2026 au soir (capture de son téléphone) : le résultat de son diagnostic rouvert affiche « SCORE ESTIMÉ — Pas encore », alors que le score exact est en base depuis le déploiement de #129 (elearn-supabase, 26/10/2026) et que son diagnostic a été rattrapé.

## Diagnostic (prouvé le 26/10 au soir)

Quand l'envoi de fin d'un diagnostic est réessayé contre une tentative déjà terminée côté serveur, `cert_attempt_finish` répond par sa branche **replay**, dont la forme ne contient **pas** la clé `estimated` — mais elle contient `score` depuis #129. Ce `fin` est persisté localement (`cert.diagnostic`), et `scoreEstime` (`src/services/certification/certDiagnostic.ts`) teste `estimated` **en premier** et renvoie `null` avant même de regarder `score` : l'écran affiche « Pas encore » alors que le score exact est dans les données stockées. Le résultat rouvert de Benny est exactement dans ce cas.

## Correctif (un seul point de changement)

Dans `scoreEstime` : si `fin.score` est non null, le renvoyer **avant** la porte `estimated` ; sinon, logique inchangée (milieu de fourchette si `estimated` et fourchette présente, sinon `null`).

Point partagé vérifié avant de coder : `scoreEstime` est consommé par les trois surfaces du score du diagnostic — résultat A7 (`ResultatDiagnostic.tsx`), accueil (`chargerAccueil` dans `accueil.ts`, tuile de `AccueilToeic.tsx`) et Moi (`ProgressionToeic.tsx`, via `chargerAccueil`). Aucune n'affiche volontairement « pas encore » pour un score présent mais non estimé : les trois traitent `null` comme « pas d'estimation disponible ». Le correctif ne fait donc régresser aucune surface.

## Verrous

- Unitaire : `fin` de forme replay (`score: 745`, `score_min`/`score_max` présents, **pas de clé `estimated`**) → `scoreEstime` renvoie 745.
- Écran A7 : même forme semée dans le diagnostic stocké → le chiffre s'affiche, pas « Pas encore ».
- Verrous existants conservés : repli milieu de fourchette, cas sans rien → `null` (« Pas encore »).

Validation locale complète (`npm run valider`) avant push ; captures Playwright avant/après sur état semé en forme replay. L'issue #82 reste ouverte pour la validation terrain de Benny.
