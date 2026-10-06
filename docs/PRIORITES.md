# Priorités Elearn Prepa

Mis à jour le 6 octobre 2026 par l'agent chef de projet. Les issues GitHub sont la source de vérité ; ce fichier donne l'ordre. Les numéros sans dépôt sont ceux de `elearn-app`.

Objectif : que l'app vende. Chemin critique : mode hors ligne validé, paiement pawaPay de bout en bout, mesure PostHog, sécurité avant les stores.

Étiquettes : P0 = avant tout autre chantier, P1 = chemin critique du lancement, P2 = avant les stores, P3 = lot 2 (après le lancement de janvier 2027).

## En cours
- Recette du 6 octobre sur #31 (2e lot : bouton Terminer sur le bilan, texte « sujets de ta classe », solde simulé en mode développeur, mission terminée hors ligne gardée et envoyée au retour du réseau, progression lisible hors ligne) : points 1 à 6 validés par Benny ; corrigés ensuite : progression en direct, fin de correction, refaire mes erreurs durci, retour à la liste des chapitres, message de contenu expiré, bouton Publier. #13 point 5 : « Tout supprimer » ne supprime plus les documents préchargés.
- Feuille de crédits épuisés K3 (Recharger, Gagner, Plus tard) : maquette `docs/maquettes/k3-credits-epuises.html` validée par Benny le 6 octobre, code et tests faits ; reste à voir sur téléphone.
- #25 Détection de connexion : code fait, validation sur téléphone dans #31.
- #13 Mode hors ligne complet : code fait en grande partie (voir le commentaire du 6 octobre sur l'issue).

## P0
- #31 Valider les correctifs hors ligne sur téléphone, OTA obligatoire (code durci le 6 octobre : écritures locales des quiz attendues, case cochée protégée de la synchro ; reste la recette sur appareil).
- #36 Révoquer les clés exposées dans l'historique du dépôt public (Benny, consoles des services).
- elearn-supabase #44 Signature du webhook pawaPay, avant tout paiement réel.

## P1 (chemin critique)
- #35 Écrans pawaPay E2 à E7 (branche `s0j9zh`), jeton sandbox, test de bout en bout ; elearn-supabase #3 et #4 ; elearn #15.
- #7 Codes promo Pass.
- #17 Analytique : 9 évènements manquants, 5 tableaux PostHog.
- #32 Cloche, centre et réglages de notifications ; #33 compteur de crédits sur Accueil et Réviser.
- #37 App Links servis en JSON (hébergement par Benny).
- elearn-supabase #43 Aligner le dépôt sur la production (PR #42, mot de passe de déploiement).

## P2 (avant les stores)
- elearn-supabase #6 à #12 : RLS, vues SECURITY DEFINER, authentification, limitation de débit ; #5 clés Firebase.
- #18, #19, #20 Déploiement iOS, Android, OTA et changelog ; #6 achat Apple.
- #14 performance, #15 chronomètre des annales, #10 limite IA sur Photo, #26 un seul appareil.
- #34 notifications restantes, #39 réconcilier les branches, #21 inventaire des tâches oubliées.

## P3 (lot 2)
#38 classes et classement, #29 WhatsApp Business, #12 partage d'une correction photo, #16 classement candidat annales, elearn-supabase #13, #14, #16, back-office elearn #17 à #22.

## Trois priorités suivantes
1. Valider les correctifs hors ligne (#31), publier l'OTA obligatoire, fermer #25 puis #13.
2. Paiement pawaPay en sandbox de bout en bout (#35, supabase #44, #3, #4), puis entonnoir PostHog (#17).
3. Révoquer les clés exposées (#36), puis la sécurité RLS avant les stores.

## Changements locaux des anciens agents : verdict
- **Gardé** : notifications de Finitions (`3f567d7`, `df565e2`, issue #32) ; écrans pawaPay de la branche `s0j9zh` comme référence (#35).
- **Reporté (lot 2)** : classes et classement de Profil (`09e80c7`, #38).
- **Abandonné** : fusion des composants de crédits de Réviser (déjà dans `src/components/credits/`) ; migration locale `20261002000000_credits_contenu_payant` (la `20261001193000` existe) ; parrainage et téléchargements de Profil (faits ou couverts par #13) ; deux tests de mission liés à la date (corrigés par `ec7b87e`) ; file de publication (Benny déploie).
- Les commits `3f567d7`, `df565e2`, `09e80c7` n'existent que dans le conteneur de l'ancien agent : ne pas supposer qu'ils sont récupérables.
