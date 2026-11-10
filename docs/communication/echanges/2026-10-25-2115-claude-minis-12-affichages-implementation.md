# Minis par partie à 12 questions (parties 3, 4 et 6) — affichages et minuteur côté app : implémentation

- Date : 25 octobre 2026, 21 h 15 UTC
- Auteur : Muse
- État : fait
- Zones touchées : `src/services/certification/reglages.ts`, `src/services/certification/miniTest.ts`, `src/components/certification/ListeTests.tsx`, `src/components/certification/TestsToeic.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts`, démo (`demo/reglages.json`, `demo/apiDemo.ts`), tests (`miniTest.test.ts`, `listesMini.test.tsx`, `tests.test.tsx`, seed `fixtures.ts`). Prise : `echanges/2026-10-25-2054-claude-minis-12-affichages-prise.md`.

## Ce qui a été fait

**Source de vérité du nombre de questions.** `Reglages` lit désormais le réglage serveur `test_mini_length_by_part` (champ `miniLongueursParPartie`), sur le patron de `diagComptes` : donnée d'affichage tolérante, absente ou illisible → `null`, jamais d'échec de chargement des réglages. Helpers dans `miniTest.ts` : `longueurMiniServie(partie, reglages)` (12 pour les parties présentes au réglage, 10 sinon) et `longueursMiniServies(reglages)` (longueurs de base distinctes des sept parties).

**Libellé.** La clé `certification.tests.detailMiniPartie` devient paramétrée (« {{n}} questions ») et une clé `detailMiniPartiePlage` (« {{min}} ou {{max}} questions ») est ajoutée, fr + en.
- `ListeTests` (en-tête des listes de minis par partie) : le nombre annoncé est celui des définitions listées quand elles s'accordent (`DefTest.questions`, la donnée réelle : 12 pour les parties 3, 4 et 6) ; liste vide ou nombres mélangés → la longueur servie pour la partie lue dans le réglage.
- `TestsToeic` (carte « Mini-test par partie », sans partie visée) : la carte annonce les longueurs servies selon les parties — « 10 ou 12 questions » avec le réglage actuel, le nombre unique si toutes les parties servent la même longueur.

**Minuteur.** Dans `lancerMiniUnique`, `dureeMin` est figée sur `tentative.questions.length` (le nombre réellement servi par le serveur), plus sur le palier demandé : un mini de partie 6 demandé au palier de base reçoit 12 questions et 12/10 du temps de base. `dureeMiniMin` accepte un nombre de questions quelconque (formule inchangée). `lancerDefTest` faisait déjà ainsi ; `lancerTest` (durées officielles 45/75/120) est inchangé, comme les durées des autres formats.

**Démo de recette alignée sur la production** : réglage ajouté à `demo/reglages.json` ; définitions composées de minis à 12 pour les parties 3, 4 et 6 dans `apiDemo.listerDefsTests` ; `apiDemo.demarrerMini` sert 12 questions au palier de base pour ces parties.

## Tests

- `miniTest.test.ts` : durée au prorata (12 → 12/10 de la base) ; aides `longueurMiniServie` / `longueursMiniServies` avec et sans réglage, tolérance de lecture (ligne absente ou illisible → `null`) ; départ d'un mini de partie 6 dont le serveur sert 12 questions pour un palier de 10 → `dureeMin` au servi, état gardé conforme.
- Adaptation au nouveau contrat (la durée suit le servi) : la fausse banque sert 3 questions de partie 5 (plan du diagnostic) — le test de départ de `miniTest.test.ts` attend la durée de 3 questions ; dans `tests.test.tsx`, la reprise T3 est décalée de 1 min 50 (reste « 1 min 10 ») et le chrono d'examen affiche « 03:00 ». Seed `fixtures.ts` : ligne `test_mini_length_by_part` ajoutée, comme le serveur la sert.
- `listesMini.test.tsx` : en-tête partie 5 → « 10 questions · 1 crédit hors Pass » ; nouvelle liste partie 6 à définitions de 12 → « 12 questions · 1 crédit hors Pass ».
- `tests.test.tsx` : la carte « Mini-test par partie » annonce « 10 ou 12 questions » (avec et sans coût).

## Validation et captures

- `npm run valider` complet vert (exit 0) : typage, ESLint, Jest **233 suites / 2 579 tests**, export Android Hermes.
- Captures Playwright (démo web, vérifiées visuellement) dans `~/workspace/captures-minis-12/` : liste des minis partie 6 → en-tête « 12 questions » (clair + sombre), liste partie 2 → en-tête « 10 questions » (clair + sombre) ; script `capturer-minis-12.js` dans le même dossier.

Commits locaux uniquement, aucun push : ce correctif partira avec un push groupé décidé par Benny.
