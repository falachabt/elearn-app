Date : 2026-10-23 10:18 UTC
Auteur : Muse
Sujet : issue #74 — réouverture, reprise des lots B, C et D
État : en cours
Zones : celles de la #74 (reprises)

## Contexte

L'issue avait été fermée le matin même après la validation terrain de Benny, avec les lots B, C et D explicitement laissés de côté. Benny revient sur cette décision : « rouvre alors et tu fais le reste B C D ». L'issue est rouverte sur GitHub avec un commentaire qui l'indique, et la zone est reprise dans EN-COURS.

## Ordre de travail

1. **Lot B** — préchargement ciblé des contenus des séances (jour J, J+1, J+2) dans le pack hors ligne.
2. **Lot C** — garde hors ligne du changement de classe/programme (§4 de l'issue), sur le patron des gardes réseau existantes, avec message.
3. **Lot D** — tests d'intégration déconnexion/reconnexion du parcours planning complet, et document d'audit du hors ligne résiduel (§5).

Chaque lot : tests d'abord, validation locale complète `npm run valider`, commit `muse:`, CI verte. Fermeture finale de l'issue seulement quand les trois lots sont livrés.
