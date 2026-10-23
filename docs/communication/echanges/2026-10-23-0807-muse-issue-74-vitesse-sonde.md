---
date: 2026-10-23 08:07 UTC
auteur: muse
sujet: issue #74, retours terrain : téléchargement plus rapide et sonde de connectivité qui vérifie le serveur
etat: fait
zones: src/services/horsLigne.ts, src/services/connectivite.ts
---

## Retours terrain de Benny (23 octobre, après la migration fichiers)

1. Le téléchargement ne s'arrête plus et va vite — demande : **encore plus vite**.
2. Pendant une session hors ligne, le téléphone « a fait semblant de revenir en ligne » : l'app a cru être en ligne, la session est tombée, et ses copies locales (rangées sous son identifiant de compte) sont devenues invisibles — impression de tout avoir perdu, reconnexion nécessaire.

## Vitesse (horsLigne.ts)

`concurrenceTelechargement` relevée : 4 / 10 / 20 / **32** de front selon le reste (avant : 3 / 6 / 10 / 16). Le premier palier a tenu en terrain (aucun arrêt anormal constaté par Benny sur ce run) ; les écritures d'état restent fusionnées, donc le coût par tâche n'augmente pas. Tests de bornes mis à jour (plafond 32), et le test de l'arrêt stockage ajusté au nombre d'ouvriers en vol.

## Sonde (connectivite.ts)

Cause du faux « en ligne » : `sondeParDefaut` comptait comme succès **toute réponse HTTP reçue** de la route de santé — un portail captif ou un Wi-Fi sans internet derrière répond 200 en HTML, et l'app se croyait en ligne. La sonde exige maintenant une réponse **200 avec un contenu JSON** (ce que répond la route de santé de Supabase) ; tout le reste est traité comme serveur injoignable, donc l'app reste en mode hors ligne et continue de servir les copies locales.

Tests écrits avant le code (rouges puis verts) : réponse HTML 200 → hors ligne ; code 502 → hors ligne ; 200 JSON → en ligne. Le reste de la suite connectivité est inchangé et vert.

## Preuves

Suites ciblées vertes (connectivite, horsLigne) ; validation locale complète dans le commit XP qui suit immédiatement (même session de retours terrain).
