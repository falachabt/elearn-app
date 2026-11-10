# Totaux affichés dans les listes de tests — implémentation

- Date : 25 octobre 2026, 22 h 55 (UTC)
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/ListeTests.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts` (une clé), `src/components/certification/__tests__/listesMini.test.tsx`, ligne EN-COURS.
- Suite de l'échange de prise `2026-10-25-2238-claude-totaux-listes-tests-prise.md` (décision de Benny du 25 octobre 2026 au soir : « tout ce qui est important, c'est le total »).

## Ce qui change pour l'élève

Sur chaque carte des listes de tests, la ligne « X questions nouvelles pour toi » est remplacée par le **total réel du test** : « 10 questions », « 12 questions », « 100 questions », « 200 questions » selon la définition. La ligne est toujours affichée (avant, elle disparaissait quand il ne restait aucune question nouvelle). Rien d'autre ne bouge : ni le tri, ni le badge « Conseillé », ni les compteurs « Fait : X sur N », ni l'en-tête de liste.

## Surfaces

Une seule surface affichait la nouveauté : `ListeTests.tsx`, qui rend les cinq listes (minis par partie, mixte, demi-écoute, demi-lecture, complets) — le changement les couvre toutes. `TestsToeic.tsx` et `ChoixPartie.tsx` n'affichaient pas la mention (vérifié par recherche exhaustive de la clé et du champ).

## Détail technique

- `ListeTests.tsx` : la ligne conditionnelle (`nouvellesQuestions > 0`) devient une ligne inconditionnelle `t('certification.tests.listes.total', { n: test.questions })` — le champ `questions` de la définition, déjà renvoyé par `cert_test_list_get` et déjà utilisé pour le « Meilleur : score sur max » des minis.
- i18n fr/en : la clé `certification.tests.listes.nouvelles` n'avait plus aucun usage → remplacée par `certification.tests.listes.total` (« {{n}} questions » dans les deux langues, comme les autres nombres de l'app).
- La nouveauté continue d'exister côté serveur (`new_questions`) et dans la recommandation « Conseillé » (`listesTests.ts`) : seule sa présentation comme nombre de questions disparaît. Aucun changement d'API, de type ni de démo.

## Tests

Nouveau bloc dans `listesMini.test.tsx` (« total affiché sur les cartes »), qui verrouille le comportement avec des définitions où total ≠ nouveauté :
- mini Partie 2 à 10 questions dont 5 et 6 nouvelles → chaque carte affiche « 10 questions », aucune mention « questions nouvelles pour toi » à l'écran (le cas exact de la capture de Benny) ;
- demi-test d'écoute à 100 questions dont 76 nouvelles → « 100 questions » affiché, nouveauté absente.

## Validation

- `npm run valider` complet **vert** : typage, ESLint, Jest **234 suites / 2 590 tests**, export Android Hermes. (Premier passage : un échec isolé de `bienvenuePass.test.tsx`, test Pass sensible au timing sans aucun fichier commun avec ce chantier — repassé seul avec succès, puis validation complète relancée entièrement verte.)
- Captures Playwright (démo certification, méthode habituelle) dans `~/workspace/captures-totaux-listes/` : liste Mini-tests Partie 2 (totaux « 10 questions ») et liste Tests complets (totaux « 200 questions »), clair + sombre, vérifiées visuellement ; le script `capturer-totaux.js` contrôle en plus l'absence de la mention « questions nouvelles pour toi » dans le texte des pages.

## Coordination

Commits locaux par chirurgie d'index sélective : le worktree contenait le chantier « Cohérence minis I-2/I-3/I-5 » en cours (fichiers distincts, sauf `fr.ts`/`en.ts` où ses retouches — `miniAide`, `choixPartie.intro` — sont hors de la ligne touchée ici ; aucun de ses fichiers n'est embarqué). Aucun push : le push groupé reste décidé par Benny.

Note de coordination (constatée après coup) : le chantier « Cohérence minis » a terminé et commité pendant la validation de ce chantier ; son commit code `f1893ba` a stagé `fr.ts`/`en.ts` en entier et a donc embarqué la ligne i18n de ce chantier (`nouvelles` → `total`, contenu vérifié identique dans les deux langues). Le commit code d'ici (`6c75400`) ne contient donc que `ListeTests.tsx` et ses tests, et le mentionne explicitement ; l'EN-COURS a été stagé par reconstruction (HEAD + ma ligne) pour ne pas embarquer les retouches non commitées de l'agent vidéos.
