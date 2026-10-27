# Mixtes et minis : démarrage refusé sans retour, boutons du détail inertes, « 550 sur 20 » — diagnostic et correctifs

- Date : 27 octobre 2026 (14:36 UTC)
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/ListeTests.tsx`, `src/components/certification/DetailTest.tsx`, nouveau composant partagé `src/components/certification/FeuillesDemarrageTest.tsx`, tests `src/components/certification/__tests__/listesMini.test.tsx` et `detailTest.test.tsx`. Volet serveur lié : elearn-supabase #191 et #193 (définitions refusées au démarrage, définitions de la partie 1), PR elearn-supabase #194.
- Issue : elearn-app #129 (continuité). Retours terrain de Benny du 27 octobre 2026, ~15:04 (captures : liste des mixtes, détail « Mixte n° 1 » avec le code TST-UM17, écran « Choisis une partie »).

## Constats et causes prouvées

1. **Toucher un mixte non fait ne faisait rien.** `ListeTests.lancer()` attrapait bien l'échec de démarrage, mais le code d'échec partait en petit texte **sous la liste** (après les six cartes, hors écran) ; les crédits insuffisants, même traitement. Le refus serveur, lui, est réel : le code TST-UM17 visible sur la capture du détail se recalcule exactement — empreinte de `appel|contenu indisponible`, c'est-à-dire le refus P0002 du démarrage durci (elearn-supabase, migration `20261027140000`) sur des définitions que les recompositions des 26–27/10 n'ont jamais remplacées en production (diagnostic et réparation : PR elearn-supabase #194).
2. **Deux boutons du détail d'un mixte semblaient morts.** « Refaire » aboutissait au même refus, résumé au code en petit texte sous les boutons. « Passer un autre test » lançait le test conseillé (un mixte non fait, refusé de la même façon) **sans aucun try/catch** dans `DetailTest.autre()` : l'échec remontait en rejet non géré, zéro retour visuel. « Voir ma note et mes tentatives » pousse une route qui existe (`/certification/tentatives`) et fonctionne — verrouillé par un test.
3. **« Meilleur : 550 sur 20 » dans la liste des mixtes.** La ligne d'un test `parMini` (mini ou mixte) rendait `listes.meilleurSur` avec `max = test.questions` : juste pour un mini (compte de bonnes réponses), faux pour un mixte, dont le score vit sur l'échelle totale (le détail affichait déjà « 550 sur 990 »). Point déjà relevé dans l'échange du 27 octobre 2026 (11:31), traité ici.

## Correctifs

- **Nouveau composant partagé `FeuillesDemarrageTest`** : `FeuilleErreurDemarrage` (raison + mention du code support) et `FeuilleCreditsInsuffisants` (coût, solde, recharger / gagner), aux textes et à la forme de la feuille du réglage d'un mini-test (`ReglageMini`). Règle produit : un blocage s'explique par une feuille du bas, jamais un silence ni un texte perdu.
- **`ListeTests`** : échec de démarrage et crédits insuffisants présentés par ces feuilles (les deux petits textes sous la liste disparaissent) ; échelle du meilleur d'un mixte = `reglages.objectifMax` (jamais le nombre de questions ; sans réglages, pas de dénominateur plutôt qu'un faux).
- **`DetailTest`** : `autre()` passe par la garde réseau et un try/catch, gère explicitement `insuffisant` (feuille crédits) et le cas « aucun autre test » (repli sur la liste du type) ; `refaire()` présente l'échec et les crédits insuffisants par les mêmes feuilles ; le bouton « Passer un autre test » est désactivé pendant un lancement.

## Preuves

- `listesMini.test.tsx` : meilleur d'un mixte « 550 sur 990 » (et jamais « sur 20 ») ; mixte non fait refusé (« contenu indisponible ») → feuille affichée avec le code exact du terrain, **TST-UM17**, aucune navigation ; mixte non fait accepté → démarrage ; le test « crédits insuffisants » existant vise désormais la feuille.
- `detailTest.test.tsx` : six verrous sur les actions du détail — « Voir ma note » navigue ; « Refaire » refusé → feuille + TST-UM17 ; « Refaire » accepté → test rouvert ; « Passer un autre test » refusé → feuille (avant : rejet non géré, rien ne s'affichait) ; « Passer un autre test » accepté → test conseillé lancé ; « Refaire » sans crédits → feuille crédits avec le solde.
- Validation locale complète `npm run valider` verte : 235 suites, 2 623 tests, typage, ESLint et export Android Hermes. (Un premier passage a vu une suite échouer sous charge ; Jest complet relancé : tout vert, et le second `npm run valider` complet est vert de bout en bout.)

## Retests pour Benny (après OTA)

- Liste des mixtes : « Meilleur : … sur 990 » ; toucher un mixte non fait le lance (volet serveur déployé par la PR elearn-supabase #194).
- Détail d'un mixte fait : les trois boutons répondent — Refaire rouvre le test, Passer un autre test lance le conseillé, Voir ma note ouvre l'historique.
- Si un démarrage est refusé un jour (crédits ou contenu), la raison s'affiche en feuille du bas avec le code support.
