---
date: 2026-10-23 05:12 UTC
auteur: muse
sujet: issue #74, moteur du pack hors ligne : téléchargements en parallèle et reprise après veille (demande de Benny pendant ses tests)
etat: fait
zones: src/services/horsLigne.ts, docs/communication/EN-COURS.md
---

## La demande (tests de Benny, 23 octobre au matin)

Deux constats sur l'écran « Tes cours, même sans réseau » :
1. Le pack entier de sa classe compte environ 5 800 éléments (918 cours et leçons, 1 160 quiz et corrections, 3 778 exercices, 161 PDF) et le moteur les téléchargeait **un par un** : 10 % en cinq minutes.
2. Quand le téléphone part en veille, les connexions en cours sont coupées par le système et les éléments partaient en « échec » (« 4 éléments à réessayer » sur sa capture) ; à la réouverture, rien ne repartait pour ces éléments-là. Sa règle, retenue telle quelle : à la reprise, on vérifie ce qui a échoué à cause de la veille ou du réseau — pas complètement téléchargé, on retélécharge ; le reste ne bouge pas.

## Ce qui change (`src/services/horsLigne.ts` uniquement)

- **Parallèle** : la file s'exécute par un groupe d'ouvriers au lieu d'une boucle séquentielle. `concurrenceTelechargement(restantes)` : 3 de front jusqu'à 30 éléments, 6 jusqu'à 200, 10 jusqu'à 1 000, 16 au-delà. Les écritures d'état sont sérialisées et fusionnées (une version dépassée est sautée), sinon des sauvegardes dans le désordre écraseraient la progression sur le disque.
- **Une erreur réseau n'est plus un échec** : veille, coupure, réseau qui saute — la tâche attend (400 ms, puis 800, 1 200, 1 600) et repart, jusqu'à 4 réessais dans la même session. Pendant une vraie veille, le code est suspendu par le système : les délais courent au réveil et le téléchargement reprend tout seul. Seules les autres erreurs (droit refusé, contenu illisible) partent en échec, comme avant.
- **Reprise à la réouverture** : `executerFile` (déjà relancé par l'écran d'onglets au retour au premier plan) accepte maintenant aussi l'état « partiel » et remet en file les échecs marqués réseau (`erreurReseau` sur la tâche ; pour les échecs laissés par les anciennes versions, sans drapeau, le message fait foi). Le contenu partiel est écrasé par le nouveau téléchargement. Les vrais échecs restent en attente du bouton « Réessayer », sinon ils repartiraient pour rien à chaque ouverture.

Limite assumée, inchangée : si le système tue l'application, aucun téléchargement ne continue en arrière-plan (il faudrait une tâche système native, hors OTA) — mais l'état est sur le disque et la reprise ci-dessus repart dès la réouverture.

## Preuves

- Tests écrits avant le code (5 nouveaux, rouges puis verts) : échelle de concurrence ; 12 tâches menées de front (pic mesuré ≥ 3) toutes « faites » ; erreur réseau deux fois puis succès = tâche faite, 3 appels, statut « terminé » ; erreur non réseau = échec immédiat, 1 appel, statut « partiel » ; reprise : un échec réseau retéléchargé, un vrai échec laissé, une seule tâche relancée.
- Suites ciblées vertes : service horsLigne (8 tests), écran hors ligne et crédits hors ligne (41 tests au total avec le service). Validation locale complète `npm run valider` verte : typage, ESLint, 217 suites / 2 420 tests, export Android.
- Aucune migration, aucune zone TOEIC, aucun changement d'écran : les barres et les libellés sont les mêmes, seule la vitesse et la reprise changent.

## Retest pour Benny

1. Prendre la mise à jour preview, rouvrir l'écran de téléchargement : le pourcentage doit avancer nettement plus vite (plusieurs éléments à la fois).
2. Laisser l'écran se mettre en veille une minute en plein téléchargement, réveiller : la progression reprend, sans nouvelle salve d'« éléments à réessayer ».
3. Les 4 éléments en échec de la session précédente (réseau) doivent repartir tout seuls à la réouverture de l'app.
