---
date: 2026-10-23 08:12 UTC
auteur: muse
sujet: issue #74, retour terrain : les gains d'XP hors ligne ne sont plus perdus à la reconnexion (file d'attente)
etat: fait
zones: src/services/xp.ts, src/session/SessionProvider.tsx
---

## Le bug (terrain, 23 octobre)

Benny termine 2 leçons hors ligne : +40 XP, total affiché 910. À la reconnexion, le total revient à **870**. Cause, dans `xp.ts` :

- `crediterXp` écrivait le gain sur le serveur « au mieux » : hors ligne, l'insert dans `xp_history` échouait (et `postgrest` renvoie ses erreurs sans les lever, donc même le `catch` ne voyait rien) — le gain ne vivait que dans le total local, sans aucune file d'attente.
- `lireUserXp`, à la lecture suivante en ligne, prenait le total du serveur (870) et **écrasait** le total local avec : le gain disparaissait silencieusement.

## Ce qui change (même patron que les coches du planning, lot A)

- **File de gains en attente** (`xp.gainsEnAttente`) : si l'inscription serveur échoue, `crediterXp` y range le gain (compte, montant, source, identifiant de source, date) au lieu de le perdre.
- **`lireUserXp`** : le total = total serveur + somme des gains encore en attente pour ce compte. Plus aucun écrasement.
- **`synchroniserXp(client, userId)`** : rejoue la file aux mêmes moments que les autres synchronisations (connexion et démarrage, branchée dans `SessionProvider`). Chaque gain parti est retiré ; au premier échec, on s'arrête et le reste attend. Quand la source est identifiable (leçon, exercice, quiz, jour de mission — tous les appelants en fournissent une), l'historique serveur est vérifié d'abord : un gain déjà inscrit n'est pas recrédité.
- L'écriture serveur teste désormais le **résultat** de l'insert, pas seulement les exceptions levées.

## Preuves

Tests écrits avant le code (rouges puis verts) : gain hors ligne gardé en attente et total relu à 910 malgré un serveur à 870 ; rejeu complet qui vide la file (les gains d'un autre compte restent) et resynchronise le total local ; rejeu interrompu qui conserve la file. Validation locale complète `npm run valider` verte : 219 suites, 2 437 tests, typage, lint sans erreur, export Android.
