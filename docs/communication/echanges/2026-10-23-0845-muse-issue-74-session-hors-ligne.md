Date : 2026-10-23 08:45 UTC
Auteur : Muse
Sujet : issue #74 — retour terrain, la session était effacée au démarrage hors ligne (planning invisible)
État : correctif prêt, en attente de validation locale complète puis push
Zones : `src/services/session.ts`, `src/services/__tests__/session.test.ts`

## Retour terrain (Benny, 23 octobre ~08:41 heure de Paris)

« Avant d'être hors ligne j'ai accédé au planning pour être sûr que c'est save, mais quand j'ouvre l'app en mode hors je ne le vois pas. » Puis : « une fois sur deux le planning ne s'affiche pas ». Le travail hors ligne lui-même n'a pas été touché : historique de la branche vérifié commit par commit, toute la chaîne #74 est là et la tête est le correctif XP.

## Cause prouvée au code

Chaîne complète, chaque maillon lu dans le code (y compris la bibliothèque installée) :

1. Le jeton d'accès Supabase vit 1 heure. Connexion le matin, planning vu en ligne : tout va bien.
2. Démarrage à froid hors ligne après expiration : `getSession()` (auth-js 2.117, `__loadSession`) tente le rafraîchissement, qui échoue sans réseau ; la session stockée étant réellement expirée, l'erreur remonte et aucune session n'est renvoyée.
3. `assurerSessionInvite` traitait TOUTE erreur comme « session invalide » et appelait `signOut()` — qui EFFACE la session du stockage de l'appareil (jeton de rafraîchissement compris : d'où la reconnexion Google forcée au retour en ligne, déjà vue le matin même).
4. La connexion anonyme de repli échoue hors ligne, `SessionProvider` reste sans session, et `useSessionPrete()` renvoie alors l'identifiant littéral `'hors-ligne'`.
5. Toutes les copies locales sont rangées sous l'identifiant réel du compte (`planning.copie.<id>`, coches, XP) : sous `'hors-ligne'`, elles sont invisibles. Le planning « disparaît » alors qu'il est toujours sur le téléphone.

L'intermittence (« une fois sur deux ») vient du maillon 2 : tant que le jeton n'a pas dépassé son expiration réelle, `getSession()` sert la session stockée malgré l'échec de rafraîchissement ; après, elle est perdue — et définitivement dès qu'un démarrage hors ligne a déclenché le `signOut`.

## Correctif

Dans `assurerSessionInvite` : l'erreur de `getSession()` est triée avec `estErreurReseau`. Erreur réseau → la session stockée est lue directement dans le stockage du client (clé `storageKey` du client d'authentification) et servie telle quelle si elle porte un utilisateur et un jeton de rafraîchissement ; aucun `signOut`, aucune connexion anonyme. Le client rafraîchira le jeton tout seul au retour du réseau. Erreur non réseau (jeton vraiment invalide) → comportement inchangé : `signOut` puis repli anonyme.

## Preuves

Tests écrits avant le correctif (2 rouges, devenus verts) : erreur réseau + session stockée → session servie, ni `signOut` ni anonyme ; erreur réseau sans session stockée → voie anonyme conservée, pas de `signOut` ; erreur non réseau → `signOut` conservé. Suite session 7/7, suites voisines (session, planning, calendrier) 77/77, typage vert. Validation locale complète `npm run valider` verte : 219 suites, 2 440 tests, export Android.
