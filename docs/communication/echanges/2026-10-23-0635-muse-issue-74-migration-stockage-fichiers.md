---
date: 2026-10-23 06:35 UTC
auteur: muse
sujet: issue #74, migration des contenus hors ligne d'AsyncStorage vers les fichiers (correctif de fond du SQLITE_FULL)
etat: fait
zones: src/services/stockageContenu.ts, src/services/reviser.ts, src/services/entrainement.ts, src/services/mission.ts, src/services/creditsHorsLigne.ts, src/services/horsLigne.ts, src/services/donneesLocales.ts, src/components/entrainement/ExerciceLibre.tsx, src/components/annales/SujetAnnale.tsx, src/components/LecteurPdf.tsx, jest.apres.js
---

## Le fond du problème

Les contenus téléchargés (cours, leçons, fiches, quiz, exercices, mission, contenus de crédits, catalogue des annales) étaient rangés dans AsyncStorage — la base SQLite des réglages, faite pour quelques mégaoctets. Un pack de classe complet (environ 5 800 éléments chez Benny) la sature : « database or disk is full (code 13 SQLITE_FULL) », et même la session ne peut plus s'écrire (connexion Google en panne le 23 octobre au matin, téléphone pourtant à 28 % d'espace libre). Les PDF, eux, étaient déjà dans des fichiers et n'ont jamais eu ce souci.

## Ce qui change

- **Nouveau service `stockageContenu`** : les contenus vivent dans des fichiers du dossier privé (`contenus/`, un fichier par clé, nom stable dérivé de la clé). Lecture : le fichier d'abord, sinon l'ancienne copie AsyncStorage (migration en douceur, rien n'est perdu pour les appareils déjà remplis). Écriture : dans les fichiers, et l'ancienne copie AsyncStorage est supprimée — la base se vide au fil des usages. Le plafond devient la place réelle du téléphone.
- **Points de passage migrés** : `avecCopie` et `lireLocalHorsLigne`/`ecrireLocalHorsLigne` (reviser — donc cours, leçons, fiches, fiches d'entraînement, catalogue des annales, quiz de leçon rangés, corrigés d'exercices), la copie de mission et le préchargement (mission), le cache des contenus de crédits (creditsHorsLigne), la lecture groupée des fiches d'entraînement (entrainement), les deux lecteurs directs du catalogue (SujetAnnale, LecteurPdf). L'effacement des données locales vide aussi le dossier des contenus.
- **Restent dans AsyncStorage** : ce qui est fait pour — session, réglages, profil, progression de l'élève (scores, faits, soldes, files de synchronisation), copie du planning et du calendrier, état du téléchargement, index des documents.
- **Tests** : le preset Jest fournit déjà un système de fichiers en mémoire, mais il fuyait d'un test à l'autre pour ce nouveau dossier ; `jest.apres.js` vide le dossier `contenus` avant chaque test, comme il vide déjà AsyncStorage et les copies en mémoire.

Deux pièges vus en route, à retenir : écrire une copie rangée ne doit pas alimenter la mémoire de session de `lireLocalHorsLigne` (elle court-circuitait ensuite les lectures et changeait les flux de crédits) — `ecrireLocalHorsLigne` invalide, comme avant ; et tout lecteur direct d'une clé de contenu doit passer par le nouveau service, sinon il lit un stockage que plus personne n'écrit (catalogue des annales, deux écrans corrigés).

## Preuves

- Service nouveau testé (8 tests) : aller-retour fichier, repli de lecture sur l'ancienne copie, priorité du fichier, suppression de l'ancienne copie à la réécriture, lots, vidage complet.
- Validation locale complète `npm run valider` : voir le commit (les suites des services et écrans touchés ont été réparées puis repassent : reviser, entrainement, mission, creditsHorsLigne, annales, lecteur PDF, donneesLocales, horsLigne).

## Retest pour Benny

Après la double relance en ligne (application de la mise à jour) : relancer le téléchargement du pack. Il ne doit plus jamais finir en SQLITE_FULL ; si la place du téléphone manque vraiment, le garde-fou du commit précédent refuse au départ avec les chiffres, ou arrête net en cours de route avec le message dédié.
