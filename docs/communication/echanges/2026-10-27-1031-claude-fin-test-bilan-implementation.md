# Fin de test : bilan des définitions enrichi (détail par partie + correction) — implémentation

- Date : 27 octobre 2026 (10:31 UTC)
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/BilanMini.tsx`, `src/components/certification/BilanDefinition.tsx`, `src/components/certification/DetailParties.tsx` (nouveau), `src/services/certification/bilanMini.ts`, `src/components/certification/HistoriqueTests.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts`, tests (`src/components/certification/__tests__/tests.test.tsx`, `src/services/certification/__tests__/bilanMini.test.ts`). Aucune modification serveur.
- Prise : `echanges/2026-10-27-1003-claude-fin-test-bilan-prise.md`. Issue : elearn-app #128.

## Ce qui est livré (maquette « Fin de test » validée par Benny le 27/10/2026, choix B : la correction à la fin du test uniquement)

1. **Bloc « Détail par partie »** dans le bilan des tests composés, sous la carte score : nouveau composant `DetailParties`, alimenté par `fin.per_part` (aide `detailParPartie` dans `bilanMini.ts` : tri par numéro de partie). Géométrie des barres du bloc maîtrise d'A7 (`BarreProgression`), valeurs « bonnes sur répondues » comme le détail T7, libellé court « P{{n}} », **aucune pastille de maîtrise** (réservée au diagnostic). Demi-test : ses parties ; complet et mixte : les sept ; mini par partie : sa partie. Sans détail à montrer, la carte seule garde le centrage v39.
2. **Accès à la correction** : le pied du bilan des définitions commence par « Revoir mes réponses » en primaire — `router.push('/certification/mini-revue')`, comme la branche simple : l'état local n'est **pas** effacé, les allers-retours bilan ↔ revue marchent (retour par l'en-tête de la revue). L'effacement reste sur les seules sorties définitives : « Voir ma note et mes tentatives » et « Retour aux tests » (via `sortir`), « Refaire » et « Passer un autre test » (le nouveau test lancé écrase l'état), et le bouton de fin de la revue elle-même. « Refaire » passe en secondaire, la revue étant l'action primaire du bilan (maquette).
3. **Variante mini-test par partie depuis les listes** (écran 5 de la maquette) : la carte de `BilanDefinition` affichait « Pas encore de score » pour ce format, qui n'a structurellement pas de score ; elle montre maintenant le compte « bonnes sur total » et l'aide des mini-tests par partie (nouvelle prop `compte`), le bloc de détail à une ligne, et la grille des questions suivie de sa légende — comme le bilan simple.
4. **Échelle dans l'historique** : `resultatTentative` (T4 et T7) rend le score exact d'un demi-test (`half_listening`/`half_reading`) par la nouvelle clé `historique.scoreExactSection` (« {{score}} sur 495 ») ; diagnostic, complet et mini (mixte) gardent « sur 990 ». Choix B respecté : aucun bouton de revue ajouté dans l'historique, aucune reconstruction serveur.

## Hors périmètre tenu

- **Réviser/séries** : aucun changement (`FinSerie`, sa correction, `revision.ts` intacts) — Benny a distingué explicitement les révisions de la fin de test.
- **Tests fixes T5** : signalé, non traité — lancés par `lancerTest` (sans définition), ils tombent sur la branche simple du bilan, qui n'affiche pas le score de section pourtant présent dans leur `fin.score` (la carte retombe sur le compte « c sur n »). Point séparé, à ouvrir si Benny le veut.

## Preuves

- Validation locale `npm run valider` verte : typage, ESLint, **234 suites / 2 615 tests**, export Android Hermes.
- Verrous ajoutés : aide `detailParPartie` (tri, une partie, vide) ; bilan demi-test lecture (détail P5/P6/P7 + valeurs, accès revue présent) ; revue ouverte depuis le bilan **sans effacer** l'état et toujours consultable ; « Voir ma note » efface (sortie définitive) ; bilan complet (sept parties) ; mini par partie des listes (compte, détail une ligne, grille, pas de « Pas encore de score ») ; historique T4 et détail T7 (demi-test « 385 sur 495 », complet « 745 sur 990 »).
- Captures du bilan enrichi (demi-test lecture semé aux données de la maquette : 385, P5 22/30, P6 9/16, P7 38/54), clair et sombre : `~/workspace/captures-fin-test-128/`.

## Changelog OTA (textes prêts, publication par le canal habituel)

- fr : « À la fin d'un test des listes (demi-test, test complet, mini-test), ton bilan montre maintenant le détail par partie et un bouton pour revoir tes réponses avec la correction. Dans ton historique, le score d'un demi-test s'affiche sur 495. »
- en : « At the end of a test from the lists (half test, full test, mini-test), your report now shows the breakdown by part and a button to review your answers with the correction. In your history, a half-test score is shown out of 495. »

## Pour Benny (validation terrain)

Double relance de l'app preview pour appliquer l'OTA, puis terminer un test des listes (demi-test lecture par exemple) : le bilan doit montrer le score, le détail par partie et « Revoir mes réponses » ; ouvrir la revue, revenir en arrière, la rouvrir ; quitter par « Voir ma note » puis vérifier dans l'historique que le score du demi-test s'affiche « sur 495 ». Issue #128 laissée ouverte pour cette validation.
