---
date: 2026-10-23 06:18 UTC
auteur: muse
sujet: issue #74, garde-fous stockage après la saturation de la base locale (SQLITE_FULL terrain)
etat: fait
zones: src/services/horsLigne.ts, src/components/horsLigne/HorsLigne.tsx, src/i18n/fr.ts, src/i18n/en.ts
---

## L'incident (terrain, 23 octobre au matin)

Pendant le téléchargement du pack, la base locale de l'application (AsyncStorage, SQLite) a saturé : à la connexion suivante, même l'écriture de la session Google échouait — « database or disk is full (code 13 SQLITE_FULL) » — alors que le téléphone avait encore 28 % d'espace libre. Le plafond atteint est celui de la base de réglages, pas celui du téléphone : les contenus du pack y sont rangés élément par élément (voir l'échange migration qui suit pour le correctif de fond).

Benny a débloqué son appareil en effaçant les données de l'application (tout est sur le serveur). Ces garde-fous empêchent d'en arriver là.

## Ce qui change

1. **Refus au lancement** (`lancerTelechargement`) : un lancement neuf ne part plus si l'espace libre connu est inférieur à la taille estimée du pack sélectionné. Erreur dédiée `ErreurEspaceInsuffisant` ; l'écran l'affiche avec les deux chiffres et la conduite à tenir (« libère de l'espace ou décoche des catégories »), au lieu de l'erreur générique. Une reprise d'un état « partiel » n'est pas bloquée (elle ne porte que sur le reste).
2. **Arrêt net en cours de route** : si une écriture échoue pour stockage plein (`estErreurStockage` : SQLITE_FULL, « disk is full », ENOSPC…), tous les ouvriers s'arrêtent au lieu d'empiler les échecs élément par élément ; l'état final est « partiel » avec `erreurStockage: true`, et l'écran affiche le message dédié (libérer de l'espace puis réessayer) plutôt qu'un compteur d'échecs muet.

## Preuves

- Tests écrits avant le code (rouges puis verts) : refus au lancement avec espace insuffisant et aucun état créé ; écriture « database or disk is full » en pleine file = arrêt, état partiel avec `erreurStockage`, des tâches jamais tentées, au plus les tâches en vol terminées.
- Suites ciblées vertes (service + écran, 12 tests), typage et ESLint propres sur les fichiers touchés. Validation complète dans le commit de la migration qui suit immédiatement (même matinée, enchaînée à la demande de Benny : « implémente ça »).
