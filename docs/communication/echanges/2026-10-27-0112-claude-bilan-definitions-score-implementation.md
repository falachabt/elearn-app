# Bilan des tests composés : score absent ou incohérent — implémentation

- Date : 27 octobre 2026 (01:12 UTC)
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/BilanMini.tsx`, `src/components/certification/BilanDefinition.tsx`, `src/components/certification/__tests__/tests.test.tsx` ; elearn-supabase : migration `20261027020000_cert_test_list_get_meilleur_score.sql` + test pgTAP 24 (PR séparée).
- Prise : `echanges/2026-10-27-0047-claude-bilan-definitions-score-prise.md`. Issue : elearn-app #127.

## Correctif app

- `BilanMini` (branche définitions) : nouveau `scoreTentative = fin.score ?? fin.score_max` — la valeur exacte du serveur fait foi (demi-tests et test complet la portent dans `score`, fourchette toujours vide ; le mixte y porte son estimation ponctuelle). La borne haute `score_max` ne sert plus qu'en repli pour d'anciens `fin` sans `score`. Le « meilleur » transmis au relancement (`refaire`) suit la même valeur (il lisait `fin.score_max`).
- Dénominateur : échelle totale (`objectifMax`) pour `full` **et** `mixed`, moitié pour les demi-tests — le « 550 sur 495 » du terrain devient impossible.
- `BilanDefinition` : prop `scoreMax` renommée `score` (le gros chiffre est le score de la tentative, pas une borne de fourchette) ; présentation inchangée (maquette v39).

## Correctif serveur (elearn-supabase, PR #189)

- Migration `20261027020000_cert_test_list_get_meilleur_score.sql` : `cert_test_list_get` recréée au plus près de la production (20261023110000), seule la sous-requête du meilleur change : `max(coalesce(score, score_max))`. Fini le meilleur toujours NULL des demi-tests et du complet (`meilleurAvant` du bilan, meilleur des listes et du détail) et la borne haute comme « meilleur » du mixte.
- Test pgTAP `24_liste_defs_meilleur_score.sql` (3 assertions) : demi-test lecture mené au bout → meilleur 495 ; mixte → 520 (ponctuelle) et non 560 ; ancienne ligne sans `score` → repli 600.

## Tests app

Nouveau bloc « bilan des tests composés (définitions) » dans `tests.test.tsx` (4 verrous, fins semées aux formes réelles du serveur) : demi-test lecture (score 300 affiché, « Premier score », « sur 495 » ; variante meilleurAvant 350 : « Score de cette tentative » + « Ton meilleur reste 350 sur 495 »), test complet (745, « sur 990 »), mixte (520 affiché, 560 absent, « sur 990 »). Validation locale complète verte : typage, ESLint, 234 suites / 2 603 tests, export Android Hermes.

## Changelog OTA (textes prêts, publication par le canal habituel)

- fr : « Le bilan de fin des demi-tests et des tests complets affiche maintenant ton score. »
- en : « The end-of-test summary for half tests and full tests now shows your score. »
