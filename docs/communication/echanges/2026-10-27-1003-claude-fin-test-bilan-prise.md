# Fin de test : bilan des définitions enrichi (détail par partie + correction) — prise

- Date : 27 octobre 2026 (10:03 UTC)
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/BilanMini.tsx`, `src/components/certification/BilanDefinition.tsx`, nouveau `src/components/certification/DetailParties.tsx`, `src/services/certification/bilanMini.ts` (aide de tri), `src/components/certification/HistoriqueTests.tsx` (`resultatTentative`), textes `src/i18n/fr.ts` et `src/i18n/en.ts`, tests associés. Aucune modification serveur, aucun écran Réviser/séries touché.

## Mandat

Exigence de Benny du 27/10/2026 : à la fin de tous les types de test, le score avec le détail par partie et un retour possible à la correction. Maquette du parcours « Fin de test : bilan complet et correction » (`~/workspace/maquettes-fin-test/maquette-fin-test.html`) **validée par Benny le 27/10/2026, choix B** : la correction est accessible **à la fin du test uniquement** — pas de reconstruction de la revue côté serveur, pas de bouton de revue dans l'historique (écran 6 de la planche sans son bouton « Revoir la correction »). Issue dédiée : elearn-app **#128** (suite de #127, même écran de bilan).

Réassignation ponctuelle : ce chantier touche le bilan des tests du profil TOEIC, sur mandat explicite de Benny (exigence + maquette validée), comme les chantiers #82 et #127.

## Constat revérifié dans le code (état distant `a03ca81`)

- `BilanMini`, branche définitions : le contenu se limite à `BilanDefinition` (carte score) ; le pied porte les quatre boutons (Refaire, Voir ma note et mes tentatives, Passer un autre test, Retour aux tests), dont trois sortent par `sortir()` qui appelle `effacerMini()` — l'état local de la revue est détruit.
- La branche simple du même écran est le patron à suivre : « Revoir mes réponses » en bouton primaire fait `router.push('/certification/mini-revue')` **sans** effacer ; seul « Retour aux tests » passe par `sortir()`.
- `MiniRevue` lit l'état local (`lireMini` par défaut) : retour par l'en-tête (`router.back()`) = retour au bilan, état intact ; son bouton de fin (« Retour aux tests » à la dernière question) efface et remplace — une sortie définitive, cohérente avec le patron.
- `cert_attempt_finish` fournit `fin.per_part` (answered/correct par partie) et `fin.results` pour tous les types : le bloc de détail et la revue n'ont besoin d'aucune donnée nouvelle.
- `resultatTentative` (T4 et T7) affiche tout score exact par la clé `historique.scoreExact` (« {{score}} sur 990 »), y compris les scores de section des demi-tests (`kind` `half_listening`/`half_reading`, plafond 495).

## Travail retenu

1. Nouveau composant `DetailParties` : bloc « Détail par partie » — géométrie des barres du bloc maîtrise d'A7 (`BarreProgression`, bordure 2, fond surface), valeurs « bonnes sur répondues » comme T7, libellé court « P{{n}} », **aucune pastille d'état de maîtrise** (réservée au diagnostic). Lignes triées par numéro de partie (aide `detailParPartie` dans `bilanMini.ts`). Demi-test : ses parties ; complet et mixte : les sept ; mini par partie : sa partie.
2. `BilanDefinition` reçoit `perPart` et rend le bloc sous la carte score ; la zone n'est centrée verticalement que sans détail (cas dégénéré), sinon le contenu part du haut comme la maquette.
3. `BilanMini` branche définitions : bouton primaire « Revoir mes réponses » en tête du pied (`router.push` vers la revue, état conservé), « Refaire » passe en secondaire, les trois autres boutons sont inchangés — l'effacement reste attaché aux seules sorties définitives existantes (`sortir`, relance d'un test qui écrase l'état).
4. `resultatTentative` : nouvelle clé `historique.scoreExactSection` (« {{score}} sur 495 ») pour `half_listening`/`half_reading` ; « sur 990 » conservé pour diagnostic, complet et mini (mixte).
5. Tests : bilan demi-test lecture (détail P5/P6/P7, accès revue, état non effacé après navigation vers la revue, effacé à la sortie définitive), bilan complet (sept parties), aide `detailParPartie`, libellés d'échelle en historique (T4 et T7). Captures du bilan enrichi en clair et sombre (état semé, méthode habituelle).

## Hors périmètre

- Flux **Réviser/séries** : distingué explicitement par Benny (« les révisions, c'est différent ») — aucun changement à son bilan (`FinSerie`) ni à sa correction.
- Tests fixes T5 : leur bilan (branche simple) n'affiche pas le score de section qu'ils portent pourtant — point séparé, seulement signalé.
- Aucune modification serveur ; aucun bouton de revue dans l'historique (choix B).
