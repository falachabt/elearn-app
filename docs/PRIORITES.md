# Priorités Elearn Prepa

Mis à jour le 7 octobre 2026 par l'agent chef de projet. Les issues GitHub sont la source de vérité ; ce fichier donne l'ordre. Les numéros sans dépôt sont ceux de `elearn-app`.

Objectif : que l'app vende. Chemin critique : mode hors ligne validé, paiement pawaPay de bout en bout, mesure PostHog, sécurité avant les stores.

Étiquettes : P0 = avant tout autre chantier, P1 = chemin critique du lancement, P2 = avant les stores, P3 = lot 2 (après le lancement de janvier 2027).

## Fait (6 et 7 octobre 2026)
- #31, #25 et #13 fermées : mode hors ligne complet validé. Espace occupé et retrait des contenus périmés : non retenus.
- #32 fermée : cloche, centre et réglages de notifications validés par Benny sur téléphone (7 octobre 2026), avec « lu » conservé après relance et routage des notifications de paiement et de correction prête.
- elearn-supabase #13 fermée : alertes de fin de Pass (J-3, J-1) et résumé du lundi (PR #46 et #47), page « Ma semaine » et routage côté app (PR #46).
- elearn-supabase #43 fermée : dépôt aligné sur la production (PR #48). Le mot de passe de déploiement manuel reste à corriger avec #36.
- elearn-supabase #3 et #4 fermées : paiement parent validé de bout en bout en bac à sable par Benny le 7 octobre (fonctions déployées, Pass et notification reçus), avec le routeur back-office elearn #26 et le correctif de la page parent elearn-site #19. Non couverts par un test : lien expiré, limite de cinq échecs par heure.
- elearn #15 fermée : le rappel pawaPay canonique est celui du back-office (`https://staff.elearnprepa.com/api/payments/pawapay/callback`), qui route vers l'Edge Function `pawapay-webhook` pour la nouvelle app ; l'ancien flux et MineConnect restent inchangés.
- #7 fermée : codes promo du Pass testés par Benny le 7 octobre (écran et service sur `kw792g`, elearn-supabase #53 et elearn #27 fusionnées). Les codes se créent par SQL en attendant le back-office : elearn #28.
- #37 fermée : `assetlinks.json` et `apple-app-site-association` servis en `application/json` sur app.elearnprepa.com (curl du 7 octobre, Vercel suit `kw792g`). Reste à tester les liens sur téléphone avec un build natif.
- Nettoyage du 7 octobre : PR obsolètes fermées sans fusion (elearn-app #22 et #3, elearn-supabase #2, elearn-site #6). Gardées ouvertes : elearn-app #43 (étude certifications, mise de côté), elearn-supabase #50 (plan Kapso, lié à #52), elearn #25, #23, #14, #13 (à trier avec Benny).
- Coût des Actions réduit : un seul workflow et un seul job, rien ne tourne pour un changement de documentation seule (PR #48).

## En cours
- Recette du 6 octobre sur #31 (2e lot : bouton Terminer sur le bilan, texte « sujets de ta classe », solde simulé en mode développeur, mission terminée hors ligne gardée et envoyée au retour du réseau, progression lisible hors ligne) : points 1 à 6 validés par Benny ; corrigés ensuite : progression en direct, fin de correction, refaire mes erreurs durci, retour à la liste des chapitres, message de contenu expiré, bouton Publier. #13 point 5 : « Tout supprimer » ne supprime plus les documents préchargés.
- Feuille de crédits épuisés K3 (Recharger, Gagner, Plus tard) : maquette `docs/maquettes/k3-credits-epuises.html` validée par Benny le 6 octobre, code et tests faits ; reste à voir sur téléphone.
- Résumé hebdomadaire pour les parents : décision du 7 octobre, WhatsApp via Kapso ; plan dans la PR elearn-supabase #50. La configuration (comptes, numéro, modèles) est laissée à Benny pour le soir : elearn-supabase #51 (réseaux sociaux) puis #52 (WhatsApp avec Kapso).

## P0
- #36 Révoquer les clés exposées dans l'historique du dépôt public (Benny, consoles des services).
- elearn-supabase #44 Signature du webhook pawaPay, avant tout paiement réel.

## P1 (chemin critique)
- #35 Écrans pawaPay E2 à E7 (branche `s0j9zh`), jeton sandbox, test de bout en bout depuis l'app.
- #17 Analytique : 9 évènements manquants, 5 tableaux PostHog.
- #33 Compteur de crédits : fait sur l'Accueil et Réviser, avec l'état « à confirmer » hors ligne (7 octobre) ; reste à voir sur téléphone.

## P2 (avant les stores)
- elearn #28 Back-office des codes promo (créer, désactiver, voir les utilisations).
- #54 PWA installée : ne s'ouvre pas sans internet au démarrage à froid (bug web, constaté le 7 octobre après les commits `c447041` et `ee89d84` ; pistes dans l'issue).
- elearn-supabase #51 Configurer proprement les réseaux sociaux Elearn Prépa (Benny, portfolio Meta Business, Metricool).
- elearn-supabase #52 Brancher WhatsApp avec Kapso ; #29 WhatsApp Business (résumé parent, reçus, support) ; elearn-supabase #14 envoi côté serveur ; elearn-site #8 page résumé parent.
- elearn-supabase #6 à #12 : RLS, vues SECURITY DEFINER, authentification, limitation de débit ; #5 clés Firebase.
- #18, #19, #20 Déploiement iOS, Android, OTA et changelog ; #6 achat Apple.
- #14 performance, #15 chronomètre des annales, #10 limite IA sur Photo, #26 un seul appareil.
- #34 notifications restantes : routage, icônes et tests faits dans l'app (crédits presque épuisés, remboursement photo, sondage révélé, réponse à ta question, bienvenue) ; la migration serveur `20261007150000_notifs_credits_photo` est sur la branche `claude/b2-notifs-credits-photo` d'elearn-supabase, à déployer par Benny, #39 réconcilier les branches, #21 inventaire des tâches oubliées.

## P3 (lot 2)
#38 classes et classement, #12 partage d'une correction photo, #16 classement candidat annales, elearn-supabase #16, back-office elearn #17 à #22.

## Trois priorités suivantes
1. Mode hors ligne, notifications et paiement parent en bac à sable : faits.
2. Signature du webhook pawaPay (supabase #44), puis paiement depuis l'app (#35) et entonnoir PostHog (#17).
3. Révoquer les clés exposées (#36), puis la sécurité RLS avant les stores.

## Changements locaux des anciens agents : verdict
- **Gardé** : notifications de Finitions (`3f567d7`, `df565e2`, issue #32, refaites et fermées) ; écrans pawaPay de la branche `s0j9zh` comme référence (#35).
- **Reporté (lot 2)** : classes et classement de Profil (`09e80c7`, #38).
- **Abandonné** : fusion des composants de crédits de Réviser (déjà dans `src/components/credits/`) ; migration locale `20261002000000_credits_contenu_payant` (la `20261001193000` existe) ; parrainage et téléchargements de Profil (faits ou couverts par #13) ; deux tests de mission liés à la date (corrigés par `ec7b87e`) ; file de publication (Benny déploie).
- Les commits `3f567d7`, `df565e2`, `09e80c7` n'existent que dans le conteneur de l'ancien agent : ne pas supposer qu'ils sont récupérables.
