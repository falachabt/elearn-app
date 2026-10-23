---
date: 2026-10-23 05:25 UTC
auteur: muse
sujet: issue #74, carte du programme absente hors ligne sur le téléphone de Benny malgré le correctif calendrier : reproduction complète en test
etat: fait
zones: src/components/mission/__tests__/accueilPlanningHorsLigne.test.tsx
---

## Le retour

Après le correctif calendrier (`a6c7b83`, CI verte, OTA publiée), la carte restait absente chez Benny au démarrage hors ligne. Sa capture du matin lève un doute : son planning est bien créé et prêt (Baccalauréat, 25 mai 2027, 30 minutes par jour, semaine 1 sur 32, séance du jour visible en ligne). Le contenu à télécharger n'a aucun rapport avec la carte : elle ne dépend que des dates de la classe et de l'état du planning gardés sur le téléphone.

## La reproduction

Nouveau test `src/components/mission/__tests__/accueilPlanningHorsLigne.test.tsx` : l'accueil entier est monté dans les conditions du terrain — session présente (identifiant u1), profil élève Tle CM, copies locales semées (calendrier de la classe avec le Bac au 25 mai 2027, planning prêt dont la semaine couvre le jour courant), et **toutes les RPC en erreur réseau**, comme un démarrage à froid en mode avion.

Résultat : la carte « Mon programme de révision » s'affiche. La chaîne complète (porte des dates par copie calendrier, copie du planning) tient avec le correctif en place. Pourquoi ce trou n'avait jamais été vu en test : les tests historiques de l'accueil simulaient un compte **sans identifiant**, donc la carte n'y était jamais montée, ni en ligne ni hors ligne.

## Ce qu'il reste comme explication côté téléphone

La mise à jour OTA se télécharge à une ouverture de l'app et ne s'applique qu'à l'ouverture **suivante**. Le test de Benny ce matin a très probablement tourné sur la session qui venait de télécharger le correctif, donc encore avec l'ancien code pour l'accueil. Protocole de retest transmis, sans ambiguïté : deux fermetures et rouvertures complètes en ligne (la deuxième fait tourner le code à jour et regarnit les copies), ouvrir l'accueil et le planning en ligne, puis mode avion, fermer complètement, rouvrir, regarder l'accueil.

Si la carte manquait encore après ce protocole strict, le suspect suivant serait la session qui ne se restaurerait pas hors ligne (l'accueil masque alors volontairement les cartes liées au compte) — à traiter à ce moment-là, preuves à l'appui.
