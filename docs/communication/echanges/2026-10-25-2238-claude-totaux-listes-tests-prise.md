# Totaux affichés dans les listes de tests — prise

- Date : 25 octobre 2026, 22 h 38 (UTC)
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/ListeTests.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts` (une clé), tests `src/components/certification/__tests__/listesMini.test.tsx`, ligne EN-COURS.
- Réassignation ponctuelle de Benny pour ce seul chantier (décision du 25 octobre 2026 au soir, sur capture des Mini-tests Partie 2).

## Décision de Benny

Dans les listes de tests, la ligne « X questions nouvelles pour toi » ne sert pas l'élève : « Pourquoi ça me dit 6 questions nouvelles au lieu de me donner le vrai nombre de questions — tout ce qui est important, c'est le total. » À la place : **le nombre TOTAL de questions de chaque test**.

## Recensement des surfaces (fait avant de coder)

- Une seule surface affiche la mention : `ListeTests.tsx` (ligne d'info de chaque carte, quand `nouvellesQuestions > 0`). Ce composant rend les cinq listes : mini-tests par partie, mini-tests mixtes, demi-tests d'écoute, demi-tests de lecture, tests complets. Un seul changement couvre donc toutes les listes.
- `TestsToeic.tsx` n'affiche pas la nouveauté (son « total » est celui d'une tentative en cours). `ChoixPartie.tsx` ne s'en sert que dans la logique de recommandation (« Conseillé »), pas à l'affichage.
- La donnée existe déjà côté serveur : `cert_test_list_get` renvoie `questions` (total réel de la définition) et `new_questions`. L'app mappe les deux (`api.ts`) ; `DefTest.questions` est déjà utilisé pour le « Meilleur : score sur max » des minis.

## Changement prévu

1. `ListeTests.tsx` : la ligne conditionnelle « nouvelles » devient une ligne toujours affichée « {{n}} questions » avec `test.questions` (total réel). Ni le tri, ni le badge « Conseillé », ni les compteurs « Fait : X sur N », ni l'en-tête de liste ne changent.
2. i18n fr/en : la clé `certification.tests.listes.nouvelles` n'aura plus aucun usage après le changement → elle est remplacée par `certification.tests.listes.total` (« {{n}} questions ») dans les deux langues. La nouveauté continue d'exister côté serveur et dans les logiques de recommandation (`listesTests.ts`, « Conseillé »), elle n'est simplement plus affichée comme un nombre de questions.
3. Test de verrouillage : une définition dont le total diffère de la nouveauté (ex. 10 questions, 6 nouvelles) affiche « 10 questions » et aucune mention « questions nouvelles ».

## Coordination

Le chantier « Cohérence minis I-2/I-3/I-5 » (échange `2026-10-25-2227`) travaille dans le même worktree sur `ReglageMini.tsx`, les textes i18n des minis et la démo. Mes fichiers sont distincts sauf `src/i18n/fr.ts` / `en.ts` : retouche i18n en dernier, après relecture de l'état courant, et commits par chirurgie d'index sélective pour ne jamais embarquer ses fichiers.
