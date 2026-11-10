# Minis par partie à 12 questions (parties 3, 4 et 6) — affichages et minuteur côté app : prise

- Date : 25 octobre 2026, 20 h 54 UTC
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/ListeTests.tsx` (en-tête des listes de minis par partie), `src/components/certification/TestsToeic.tsx` (carte « Mini-test par partie »), `src/services/certification/miniTest.ts` (minuteur du mini à la volée), `src/services/certification/reglages.ts` (lecture du réglage serveur), textes fr/en (`src/i18n/`), démo de recette (`src/services/certification/demo/`), tests. Réassignation ponctuelle à Muse, dans le prolongement des issues TOEIC précédentes.

## Contexte

Décision de Benny du 25 octobre 2026 : les mini-tests par partie des parties 3, 4 et 6 passent à **12 questions** (groupes entiers : P3/P4 en groupes de 3, P6 en groupes de 4). Côté serveur, c'est déployé (elearn-supabase, PR #172, migration `20261025220000_cert_minis_12.sql`) : réglage `test_mini_length_by_part = {"3": 12, "4": 12, "6": 12}`, `cert_mini_start` sert 12 questions quand le palier de base est demandé pour ces parties, prix et action inchangés ; les définitions composées P3/P4/P6 sont à 12. Les parties 1, 2, 5 et 7 restent à 10.

Deux affichages/durées côté app sont devenus faux, localisés par l'audit serveur :

1. **Texte fixe « 10 questions »** — la clé `certification.tests.detailMiniPartie` vaut « 10 questions » en dur ; elle est affichée dans l'en-tête des listes de minis par partie (`ListeTests.tsx`, variable `libelleMini`) et sur la carte « Mini-test par partie » de l'onglet Tests (`TestsToeic.tsx`). Pour les parties 3, 4 et 6, le libellé doit annoncer 12.
2. **Minuteur du mini à la volée sous-estimé** — au départ (`lancerMiniUnique` dans `miniTest.ts`), `dureeMin` est calculée par `dureeMiniMin(longueur)` sur la longueur **demandée** (10), alors que le serveur sert 12 questions pour ces parties : l'élève a 10 minutes pour 12 questions. La durée doit suivre le nombre de questions réellement servies (`tentative.questions.length`), comme le fait déjà `lancerDefTest` pour les tests composés. Les durées des autres formats ne changent pas.

## Mécanisme retenu pour le libellé

Source de vérité : le réglage serveur, jamais de valeur devinée dans le code (R-04). Sur le patron de `diagComptes` (plan du diagnostic, donnée d'affichage tolérante qui ne fait jamais échouer le chargement des réglages) :

- `Reglages` gagne un champ optionnel `miniLongueursParPartie` lu depuis `test_mini_length_by_part` ; absent ou illisible → `null`.
- Helpers dans `miniTest.ts` : `longueurMiniServie(partie, reglages)` (longueur de base servie pour une partie, 10 par défaut) et `longueursMiniServies(reglages)` (les longueurs de base distinctes sur les sept parties, pour les libellés sans partie précise).
- La clé `detailMiniPartie` devient paramétrée : « {{n}} questions ».
- `ListeTests` : pour une liste de minis d'une partie, le nombre annoncé est d'abord celui des définitions listées quand elles s'accordent (`DefTest.questions`, la donnée réelle) ; sinon, la longueur servie pour la partie lue dans le réglage.
- `TestsToeic` : la carte ne vise pas une partie ; elle annonce la fourchette des longueurs servies quand elles diffèrent (« 10 ou 12 questions », nouvelle clé `detailMiniPartiePlage`), le nombre unique quand elles sont toutes égales.
- La démo de recette (`demo/reglages.json`, `demo/apiDemo.ts`) reflète la production : réglage ajouté, définitions composées de minis à 12 pour la partie 6 et à 10 pour la partie 2 (captures de recette des deux cas).

## Minuteur

- `dureeMiniMin` garde sa formule (minutes pour 10 questions, depuis le réglage) mais accepte un nombre de questions quelconque.
- `lancerMiniUnique` fige `dureeMin` sur `rep.tentative.questions.length` (le servi), pas sur le palier demandé. `lancerDefTest` fait déjà ainsi ; `lancerTest` (durées officielles des épreuves fixes) est inchangé.

## Tests

- `miniTest.test.ts` : durée proportionnelle au servi (12 questions → 12/10 de la base) ; départ d'un mini de partie 6 dont le serveur sert 12 questions pour un palier demandé à 10 → `dureeMin` suit le servi ; aides `longueurMiniServie` / `longueursMiniServies` (avec réglage, sans réglage).
- `listesMini.test.tsx` : en-tête d'une partie à 10 (partie 5, définitions à 10) → « 10 questions » ; nouvelle liste de partie 6 à définitions de 12 → « 12 questions ».
- `tests.test.tsx` : la carte « Mini-test par partie » annonce « 10 ou 12 questions » avec le réglage du seed (qui reçoit la ligne `test_mini_length_by_part`, comme le serveur la sert).
- Captures Playwright des listes de minis partie 6 (12) et partie 2 (10), clair et sombre, dans `~/workspace/captures-minis-12/`.

Commits locaux uniquement, aucun push : ce correctif partira avec un push groupé décidé par Benny.
