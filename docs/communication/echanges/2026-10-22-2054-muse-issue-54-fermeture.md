---
date: 2026-10-22 20:54 UTC
auteur: muse
sujet: issue #54 fermée : le hors ligne passe par les applications natives, pas par la PWA (décision de Benny)
etat: fait
zones: docs/communication/EN-COURS.md, issue GitHub elearn-app #54
---

## Suite de l'échange de prise

`echanges/2026-10-22-2032-muse-prise-issue-54.md` (prise de la tâche, constat et plan).

## Ce que l'étude a donné

- Production vérifiée en lecture seule : `/sw.js` (v2, commit `ee89d84`) servi avec le bon type de contenu, sans cache, portée `/` ; la page `/` contient l'enregistrement du worker et le bundle. Contenu identique au dépôt.
- Reproduction locale avec le build de production réel, sous Chromium (Playwright) : visite en ligne (worker actif, cache rempli : page, bundle JS, polices, sons), puis réseau coupé et démarrage à froid sur `/` et sur une route profonde (`/moi`) : l'application s'ouvre, écran de bienvenue affiché. Dans ces conditions contrôlées (première visite en ligne complète, même navigateur), le mécanisme fonctionne.
- Sur l'appareil réel de Benny, le retest du 22 octobre donne le résultat inverse : la PWA installée ne s'ouvre toujours pas sans internet (blocage sur l'écran de l'icône, puis page « pas d'internet » du navigateur), comme le 7 octobre.

## Décision de Benny (22 octobre 2026)

Un site est fait pour être utilisé en ligne. Le mode hors ligne existe déjà via les applications natives : qui le veut télécharge l'application sur le store plutôt que d'utiliser la PWA. Le démarrage hors ligne de la PWA n'est donc pas poursuivi, et ce n'est pas bloquant.

## Clôture

- Issue `elearn-app` #54 fermée en « not planned », avec un commentaire qui résume le constat, l'étude et cette décision.
- Le service worker reste en place : il sert les visites répétées en ligne et ne gêne rien. Aucun retrait décidé.
- La zone « Démarrage web et PWA » est libérée dans `EN-COURS.md`. Première tâche de Muse terminée ; prochaine tâche à choisir avec le chef de projet.
