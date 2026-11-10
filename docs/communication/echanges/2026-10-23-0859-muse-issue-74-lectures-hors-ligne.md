Date : 2026-10-23 08:59 UTC
Auteur : Muse
Sujet : issue #74 — retours terrain, lectures hors ligne immédiates et double comptage XP fermé
État : correctif prêt, validation locale complète en cours
Zones : `src/services/xp.ts`, `src/services/planning.ts`, `src/services/calendrier.ts` et leurs tests

## Retours terrain (Benny, 23 octobre ~08:49 heure de Paris)

Trois symptômes : le planning ne s'affiche « qu'une fois sur deux » hors ligne ; les XP ont sauté de 910 à 1010 au retour en ligne d'une façon qui ne correspondait pas à ses gains ; la carte de niveau affiche le niveau 1 « pendant longtemps » avant le vrai niveau, hors ligne.

Le premier symptôme relève du correctif session de l'échange précédent (jeton expiré + démarrage hors ligne). Les deux autres sont traités ici.

## 1. Lectures qui attendent l'échec réseau avant de servir le local

`lireUserXp`, `lirePlanning` et `lireCalendrierClasse` tentaient toujours le serveur d'abord et ne servaient leur copie locale qu'après l'échec de la requête. Sur un Wi-Fi sans internet (ou un réseau qui met longtemps à échouer), les écrans restaient donc vides ou à zéro — la carte de niveau à 0 XP, donc niveau 1 — pendant toute l'attente.

Correctif : quand la coupure est **déjà connue** (`serveurJoignable()` faux, c'est l'état que la sonde entretient), la lecture sert directement le local : total gardé pour les XP, copie pour le planning (avec les coches en attente reposées, sans tenter leur rejeu) et pour le calendrier. État inconnu ou en ligne : comportement inchangé, le serveur reste tenté en premier.

Précision importante, venue des tests d'écran : le court-circuit ne s'applique que s'il y a **quelque chose à servir** (copie prête, total local non nul). Sans copie, le serveur est tenté quand même — l'état connu peut dater, le réseau être revenu, et le bouton « Réessayer » de l'écran « pas de réseau » doit pouvoir aboutir au lieu d'être bloqué par l'état. Au passage, `jest.apres.js` réinitialise désormais l'état de connectivité entre les tests : un `signalerEchec` d'un test le laissait « hors ligne » pour les suivants du même fichier, ce qui est devenu visible dès que les lectures consultent cet état.

## 2. Double comptage des gains en attente (file XP)

Mécanisme prouvé par un test : un gain crédité en ligne écrivait le total ABSOLU dans `user_xp` — total qui inclut les gains encore en attente, pas encore présents dans `xp_history`. Quand la file était ensuite rejouée, le trigger ajoutait ces gains une seconde fois au total serveur. Selon la chronologie exacte (gains faits, moment du rejeu), l'écart pouvait apparaître au retour en ligne.

Correctif dans `crediterXp` : la file est d'abord vidée (`synchroniserXp`) avant tout calcul, et l'écriture absolue du total n'a lieu que s'il ne reste **aucun** gain en attente après l'envoi du nouveau gain — sinon le trigger seul tient le total serveur, et l'affichage reste juste via `lireUserXp` (distant + en attente).

## Preuves

4 tests écrits avant le code (rouges, puis verts) : total XP servi sans aucune requête quand la coupure est connue ; planning et calendrier servis depuis leur copie sans appeler la RPC ; scénario complet du double comptage (serveur à 870, +40 en attente, gain en ligne de +20, rejeu de SessionProvider) — total final 930 partout (serveur, local, file vide), contre 970 avant le correctif. Suites touchées : 173/173 vertes (services + écrans planning), typage vert. Validation locale complète `npm run valider` verte : 219 suites, 2 444 tests, export Android.
