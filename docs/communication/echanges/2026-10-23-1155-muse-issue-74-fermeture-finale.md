# Issue #74 — fermeture finale : lots A à D livrés

- Date : 2026-10-23 11:55 UTC
- Auteur : Muse
- Sujet : fermeture de l'issue #74 après livraison des lots B, C et D (le lot A et les correctifs terrain étaient déjà en place ; première fermeture le matin du 23/10, réouverture le même jour à la demande de Benny pour terminer B, C et D).
- État : terminé. Issue fermée `completed` sur GitHub avec commentaire de synthèse.
- Zones : documentation uniquement pour cet échange (`EN-COURS.md`, `docs/MEMOIRE_PROJET.md`).

## Ce qui a été livré

- **Lot A** (22/10, `60e4ada`) : coches du planning en écriture différée hors ligne, file locale et rejeu idempotent au retour du réseau.
- **Correctifs terrain du 23/10 au matin** (`7764dd4`, `b722638`, `1f3494d`, `c335247`, `068597d`, `57e7fb1`) : contenus en fichiers plutôt qu'en AsyncStorage, sonde durcie (200 JSON exigé), file de gains XP sans double comptage, session conservée au démarrage hors ligne, lectures locales immédiates. Testés par Benny sur son téléphone : « ça fonctionne ».
- **Lot B** (`ddb20c1`, CI 39939676389 verte) : les contenus des séances de J, J+1 et J+2 passent en tête de la file de téléchargement du pack.
- **Lot C** (`c3ec9f4`, CI 39946086684 verte) : changement de classe ou de programme bloqué hors ligne, feuille « Tu es hors ligne » (design validé par Benny), aucune écriture tentée. Vérification visuelle §4bis sur captures RÉELLES de l'app (Expo web + Playwright, clair et sombre) : `docs/communication/captures/2026-10-23-lot-c/`.
- **Lot D** (`19c9ee7`, CI 39947216290 verte) : test d'intégration du parcours complet (en ligne → coupure → coche en file → reconnexion → rejeu) et audit du hors ligne résiduel (`docs/audit-hors-ligne.md`).

## Validation

Chaque lot : `npm run valider` vert en local (2 447 tests au dernier état), CI verte, OTA preview publiée. La référence terrain à valider reste l'OTA du lot C (le lot D ne change aucun code de production).

## Points laissés ouverts, hors issue

- Le total XP du compte de test de Benny (1010) peut contenir des gains comptés double par la version du matin du 23/10, avant le correctif `57e7fb1` : correction possible côté serveur s'il le demande.
- La proposition proactive de téléchargement hors ligne (feuille au bon moment) fait l'objet d'une issue séparée, design déjà validé par Benny.
