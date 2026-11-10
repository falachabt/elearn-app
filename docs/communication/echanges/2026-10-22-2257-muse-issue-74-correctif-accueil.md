---
date: 2026-10-22 22:57 UTC
auteur: muse
sujet: issue #74, correctif après test terrain de Benny : la carte planning de l'accueil disparaissait hors ligne
etat: fait
zones: src/services/calendrier.ts, docs/communication/EN-COURS.md
---

## Le constat (test de Benny, 22 octobre au soir, app preview)

Protocole du lot A suivi : planning ouvert en ligne, passage hors ligne, réouverture de l'app. Résultat : la carte « Mon planning » de l'accueil avait disparu (le compte à rebours aussi). L'écran planning lui-même et son contenu n'étaient pas en cause.

## La cause

L'accueil (`src/components/mission/Accueil.tsx`) ne monte le compte à rebours et la carte planning que s'il connaît l'échéance de la classe de l'élève. Cette échéance vient de `lireCalendrierClasse` (`src/services/calendrier.ts`), qui était un appel RPC nu, **sans copie locale** — contrairement au planning, qui a la sienne depuis l'issue #65. Hors ligne, l'appel échoue, l'accueil range « pas d'échéance » et cache les deux cartes, alors que la copie du planning aurait permis de les afficher.

Ce n'est pas une régression du lot A (ni l'accueil ni le calendrier n'y étaient touchés) : c'est un trou hors ligne antérieur, dans le périmètre de la #74 (§1 : le planning consultable en mode avion passe par sa carte d'accueil ; §5 : audit résiduel — celui-ci est corrigé tout de suite plutôt que seulement cartographié, parce qu'il casse le parcours d'acceptation).

## Le correctif

`lireCalendrierClasse` garde désormais la dernière réponse du serveur sur l'appareil, par niveau et par pays (`calendrier.classe.<niveau>.<pays>`, lignes brutes de la RPC) et la sert quand l'appel échoue sur une erreur réseau — même patron que la copie du planning. Sans copie, ou pour une erreur qui n'est pas le réseau, le comportement d'avant s'applique : l'erreur remonte et l'accueil cache les cartes. Aucune autre modification : l'accueil et la carte n'avaient pas de défaut, il leur manquait les dates.

Effet de bord assumé : l'écran de création du planning, qui lit aussi ce calendrier, connaît l'échéance hors ligne quand une copie existe ; la création elle-même reste en ligne (l'écriture échoue proprement, état « pas de réseau »).

## Preuves

- Tests écrits avant le code : 5 nouveaux cas dans `src/services/__tests__/calendrier.test.ts` (copie gardée et isolée par classe, copie servie hors ligne, pas de copie = erreur, erreur non réseau = erreur malgré la copie, copie illisible ignorée). Rouges avant, verts après.
- Suites ciblées vertes : calendrier, composants mission (accueil) et planning, 149 tests.
- Validation locale : typage vert, ESLint 0 erreur, export Android vert. Suite Jest complète : 2414/2415 — le seul échec est `src/components/certification/__tests__/arrivee.test.tsx` (TOEIC-A3-DATE-VALIDE), sans rapport avec ce correctif : le test construit « dans 42 jours » en UTC et l'app compte en heure locale, il échoue donc entre 0 h et 2 h du matin (vérifié : vert dans la validation du lot A à 23 h 40, rouge à 1 h). Zone TOEIC, non touchée ici ; signalé pour information.
- Aucune migration, aucun changement serveur, aucune zone TOEIC.

## Retest pour Benny (même protocole)

1. Prendre la mise à jour preview (fermer et rouvrir l'app), ouvrir l'accueil **en ligne** une fois : les dates de la classe se gardent en même temps que le planning.
2. Mode avion, rouvrir l'app : le compte à rebours et la carte « Mon planning » restent affichés ; la carte ouvre le planning (copie), la séance se coche comme prévu au lot A.
