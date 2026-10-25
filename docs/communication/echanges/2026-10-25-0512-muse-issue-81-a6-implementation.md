# Implémentation de l'issue #81 — [TOEIC-A6] Question du diagnostic (alignement sur le plan servi à 21 questions)

- Date : 25 octobre 2026, 05:12 UTC
- Auteur : Muse
- Sujet : implémentation du périmètre validé par Benny le 25 octobre 2026 (points 1 à 5 de l'échange de prise, plus sa demande « trous en tags jaunes numérotés », point 6 ci-dessous)
- État : fait, validation locale complète verte, captures de recette refaites. Push en attente du « Pousse » de Benny.
- Zones touchées : démo de certification, annonce A5, réglages (lecture seule de la nouvelle clé), textes fr/en, fixtures et tests du diagnostic. Aucun écran Tests, Réviser, Statistiques, aucun moteur B*, aucune production.

## Point 1 — Démo alignée sur le plan production (écart n° 1 de l'inventaire)

- `src/services/certification/demo/reglages.json` : ajout du réglage `diag_counts` = {1:1, 2:2, 3:3, 4:3, 5:3, 6:4, 7:5} (21 questions), le même que celui servi par le serveur depuis le correctif du 24 octobre. `diag_blueprint` (ancien plan) est conservé : il ne pilote plus que les mini-tests mixtes de la démo.
- `src/services/certification/demo/apiDemo.ts` : `demarrerDiagnostic` tire désormais `diag_counts` via un nouveau tirage `tirerGroupesEntiers` — une unité (groupe ou question seule) n'est retenue que si elle tient entièrement dans le compte demandé, **sans troncature du dernier groupe** (plusieurs mélanges essayés pour atteindre le compte exact, partie 7 notamment). Le tirage historique `tirer()` (séries, mini-tests, tests) est inchangé.
- Preuve : captures de recette — la démo sert 21 questions (« Diagnostic · 1 / 21 », groupe de partie 6 entier à « 13 / 21 »).

## Point 2 — Annonce A5 corrigée (écart n° 2)

- `src/services/certification/reglages.ts` : nouvelle lecture `diagComptes` (clé `diag_counts`). C'est une donnée d'affichage : comme `session_minutes_recommended`, son absence éventuelle (ancienne copie servie ou mise en cache) ne fait jamais échouer le chargement des réglages — elle donne `null` et l'écran dégrade proprement. `score_min_answers` et `scoreMinReponses` sont **inchangés** (seuil d'estimation du score, `certScore.ts`).
- `src/components/certification/PreparationDiagnostic.tsx` : la tuile « Questions » et les aides Écoute/Lecture dérivent du plan servi — total (21) et répartition par section (écoute = parties 1 à 4, lecture = parties 5 à 7), soit **9 écoute / 12 lecture**. Si le plan n'est pas servi, la tuile affiche « — » et les aides tombent sur leur forme sans nombre.
- Textes fr/en : `contientEcouteAide` et `contientLectureAide` paramétrés (`{{n}} questions · …`), plus les formes libres `contientEcouteAideLibre` / `contientLectureAideLibre` pour le repli.
- Preuve : capture A5 (clair et sombre) — tuile « 21 », « 9 questions · audio joué une seule fois », « 12 questions · phrases et textes à lire » ; test AC-A5-1 mis à jour.

## Point 3 — Fixtures et tests (écart n° 3)

- `src/services/certification/__tests__/apiFausse.ts` : `PLAN_TEST` = 1/2/3/3/3/4/5 (21 questions) et `questionsTest` sert de **vrais groupes multi-questions** aux formes de la banque : parties 3 et 4 en groupes de 3 (audio partagé), partie 6 en texte à trous de 4 (marqueurs « {1} » à « {4} » dans le passage), partie 7 en documents de 2 puis 3.
- `src/services/certification/__tests__/fixtures.ts` : `LIGNES_SEED` gagne la ligne `diag_counts` (le plan servi), pour que les tests d'écran lisent la même source que la production.
- Assertions « 20 » mises à jour : `diagnostic.test.ts` (service : longueur 21, « la 21e réponse », 11 bonnes sur 21 dans le résultat alterné) et `diagnostic.test.tsx` (en-tête « n / 21 », A8/A7 avancés à 21 réponses ; le test « la dernière réponse ouvre A8 » traverse le dernier groupe de partie 7 en deux « Passer »).
- **Nouvelle couverture de la validation par groupe propre à A6** (`diagnostic.test.tsx`, bloc « validation par groupe (partie 6, texte à trous entier) ») : reprise directe sur le groupe de partie 6 ; un onglet par question aux numéros officiels ; un tag numéroté par trou dans le texte ; « Valider (0/4) » inactif, « Valider (1/4) » après une réponse ; premier appui sur groupe incomplet = bannière « Tu n'as pas tout répondu. » + « Valider quand même (1/4) » ; second appui = envoi du groupe entier et passage à la partie 7 (16 réponses gardées).

## Point 4 — Captures de recette refaites

Dossier `~/workspace/captures-a6-81/2026-10-25-recette/` (script `capturer-recette.js`) — démo alignée, Expo web local, Playwright :

- `a5-annonce-390-clair.png`, `a5-annonce-390-sombre.png` : A5 avec tuile 21 et aides 9/12.
- `a6-q1-390-clair.png`, `a6-q1-390-sombre.png`, `a6-q1-360-clair.png`, `a6-q1-390-clair-bas.png` : première question, en-tête « Diagnostic · 1 / 21 ».
- `a6-partie6-entiere-390-clair.png`, `a6-partie6-entiere-390-sombre.png` : groupe de partie 6 **entier** (4 onglets, un seul texte, « Valider (0/4) ») — voir point 6.

## Point 5 — Légendes et documentation (écart n° 4)

- Planche de parcours validée (`~/workspace/maquettes-a4-79/maquette-parcours-a4.html`) corrigée sur les deux rangées (clair et sombre) : résumé « A6 Diagnostic (21 questions) » ; cadres A5 — tuile Questions à 21, aides « 9 questions » / « 12 questions » ; légende A5 — le nombre de questions vient du plan servi `diag_counts` ; légende A6 — « 21 questions tirées par le serveur (9 écoute, 12 lecture…) », « Après la 21e réponse → A8 » ; légende A8 — « les 21 réponses ».
- **À signaler au coordinateur / dev TOEIC** (pas réécrit ici, hors zone) : le cahier v1.35 §5.A décrit encore l'ancien plan (fiches A5 et A6 : « 20 questions », répartition {3:4, 6:2}, « la 20e validation » ; tests pgTAP décrits « 20 questions »), ainsi que `docs/maquettes/toeic-revue-complete.md` (« 20 questions, 10 et 10 ») et le commentaire « les 20 réponses » dans `etat.ts:58`.

## Point 6 — Les trous du texte en tags numérotés (demande de Benny) : motif existant, réutilisé tel quel

Benny demandait que chaque trou d'un texte (partie 6) soit rendu comme un petit tag jaune portant le numéro de la question — l'onglet dit « Question 143 » sans qu'on sache quel trou c'est. **Le motif existe déjà dans l'app, et c'est celui du composant partagé** : `PassageTrous` dans `src/components/certification/QuestionExercice.tsx` rend chaque marqueur « {k} » du passage comme un petit rectangle portant le **numéro officiel** de la question (le même que l'onglet), avec les jetons du thème — le trou de la question en cours en **jaune** (`theme.accent.soleil`, bordure forte), un trou déjà répondu en **vert**, les autres sur la surface. Le même écran sert le trou des phrases (parties 5 et 6) en tag jaune numéroté. Le diagnostic, les mini-tests et les séries passent déjà les mêmes props (`trouCourant`, `numerosTrous`, `trousRepondus`) ; un test dédié existe (`passageTrous.test.tsx`).

Pourquoi Benny voyait des tirets : la numérotation ne s'active que si le groupe à l'écran contient **exactement une question par trou** — sinon, repli délibéré sur un trait, pour ne pas numéroter au hasard des données partielles. C'était le cas de la recette sur la démo (groupe tronqué à 2 questions pour 4 trous, capture de l'inventaire) ; en production, les groupes entiers sont servis depuis le 24 octobre. **Aucune modification du composant partagé n'a donc été nécessaire** : le point 1 (groupes entiers dans la démo) active le motif partout où la recette se fait. Preuve : les captures `a6-partie6-entiere-390-clair.png` et `…-sombre.png` montrent les quatre trous en tags numérotés (143 à 146 en clair, 131 à 134 en sombre), le trou en cours en jaune, et le test du point 3 vérifie la mécanique (jaune sur le trou courant, vert après réponse).

## Validation

- Suites ciblées (diagnostic service + composant, arrivée, groupes, certDiagnostic) : 93 tests verts, dont le nouveau test de validation par groupe.
- `npm run valider` complet, en local : typage vert, ESLint vert, **Jest 227 suites / 2 513 tests, tout vert**, export Android Hermes produit. (Les deux exécutions intermédiaires lancées en parallèle d'autres travaux de la machine ont donné des lectures parasites ; le run final, seul et complet, est celui-ci.)
- `EN-COURS.md` : la ligne #81 est mise à jour dans l'arbre de travail mais **volontairement non commitée ici** — le fichier porte aussi une ligne non commitée du chantier vidéos (autre agent) ; à committer avec le push, en connaissance de cause.
