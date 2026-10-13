# Priorités Elearn Prepa

Mis à jour le 13 octobre 2026 par l'agent chef de projet (bilan complet : `suivi/bilan-cdc-2026-10-13.md` dans les fichiers du projet). Les issues GitHub sont la source de vérité ; ce fichier donne l'ordre. Les numéros sans dépôt sont ceux de `elearn-app`.

Objectif : que l'app vende. Chemin critique : paiement réel pawaPay, mesure PostHog, sécurité avant les stores, publication iOS et Android pour janvier 2027.

Étiquettes : P0 = avant tout autre chantier, P1 = chemin critique du lancement, P2 = avant les stores, P3 = lot 2 (après le lancement de janvier 2027).

## Fait
- **Hors ligne, notifications, crédits** (6 et 7 octobre) : #31, #25, #13, #32, #33 fermées ; alertes de fin de Pass et résumé du lundi (elearn-supabase #13) ; bugs de fin de quiz #55 et #56 corrigés.
- **Paiement** : paiement parent et pass élève validés en bac à sable (elearn-supabase #3, #4 ; elearn #15, #26) ; codes promo du Pass (#7) ; carte bancaire Chariow pour les pays sans Mobile Money ; achat Apple prêt côté code et RevenueCat (#6, voir En cours) ; webhook pawaPay : le corps est ignoré et le dépôt relu chez pawaPay (elearn-supabase #44 fermée le 13 octobre).
- **Sécurité** : RLS sur les 83 tables publiques (elearn-supabase #6 à #10, migrations `rls_*` du 11 octobre en production), limitation de débit (#12), clés exposées révoquées (#36), `.env.vercel` du back-office sorti du dépôt (elearn #31).
- **Fonctions livrées du 8 au 13 octobre** : un seul appareil actif (#26), chronomètre et temps d'apprentissage (#15), récompense au partage d'une correction photo (#12), changelog dynamique des mises à jour (#20), quota IA sur l'écran Photo (#10), parrainage et son back-office (elearn #17), back-office paiements (elearn #16).
- **WhatsApp (Kapso)** : en service depuis le 11 octobre (support IA, résumé parent du dimanche 14 h, facture PDF) ; elearn-supabase #14 et #52, app #29, site #8 et #22 fermées.
- **Web** : app.elearnprepa.com sert la branche de travail ; liens d'app `.well-known` en JSON (#37) ; PWA installable (le démarrage hors ligne reste ouvert : #54).
- **Ménage** : 76 branches supprimées le 11 octobre, règle « une branche, une PR » (#39 fermée le 13) ; PR obsolètes fermées (dont elearn #25 et #14 le 13 octobre).
- Issues fermées par Benny entre le 10 et le 13 octobre et contrôlées dans le bilan : voir « À trancher » pour #16 (app) et #11 (supabase).

## En cours
- **Notifications restantes (#34)** : routage fait dans l'app ; **la migration serveur `20261007150000_notifs_credits_photo` n'a jamais été déployée** (sa branche `claude/b2-notifs-credits-photo`, SHA `cb970ff61ffde00a7fa3e35a2c400a1139d246dc`, a été supprimée au ménage).
- **iOS (#18, #6)** : build 17 téléversé sur App Store Connect, RevenueCat configuré, captures prêtes ; reste la fiche, le compte de démonstration et la soumission (`docs/app-store.md`).
- **Feuille de crédits épuisés K3 et compteur de crédits** : code et tests faits, à voir sur téléphone.
- **Liens d'app sur téléphone** : demandent un build natif.
- Quatre modèles WhatsApp en revue chez Meta (messages réessayés sans perte) ; vérification de l'entreprise Meta à faire par Benny (elearn-supabase #51).

## P0
- **elearn-supabase #106 Basculer pawaPay en production et réussir un premier paiement réel** (accord de Benny, jeton de production, décision Orange Cameroun).

## P1 (chemin critique)
- #17 Analytique : évènements manquants (voir le commentaire du 13 octobre) et 5 tableaux PostHog non vérifiés.
- #35 Écrans pawaPay depuis l'app : le code existe (paiements, retour dans l'app, pays, numéro), reste à confirmer un paiement sandbox complet depuis l'app puis en réel.
- #34 Restaurer et déployer la migration serveur des notifications (ci-dessus).

## P2 (avant les stores)
- #18 iOS (soumission), #19 Android (publication et pawaPay de production), #6 achat Apple (test sur appareil).
- elearn #28 Back-office des codes promo.
- #54 PWA installée : ne s'ouvre pas sans internet au démarrage à froid.
- #14 Mesures de performance (démarrage < 3 s, IA < 25 s).
- elearn-supabase #51 Réseaux sociaux (Benny, Meta Business).
- Alertes Supabase restantes : expiration des codes, mots de passe compromis, GraphQL, fonctions SECURITY DEFINER, voir `suivi/bilan-cdc-2026-10-13.md`.
- #21 Inventaire des tâches oubliées (à découper en issues au fil de l'eau).
- **Connexion par WhatsApp** : abandonnée pour le moment (modèle Meta refusé, décision du 10 octobre) ; étude dans `docs/etude-connexion-whatsapp.md`, à rouvrir après la vérification de l'entreprise Meta.

## P3 (lot 2)
#38 classes et classement, elearn-supabase #16 écoles relais, elearn #18 à #22 (écoles relais, partenaires, audit, réseaux sociaux), M17 échauffements (pas commencé, à décider), elearn #1 (demande de 2025, IA dans les leçons, à trancher).

## À trancher avec Benny
1. #16 (classement des candidats aux annales) a été fermée le 12 octobre sans code ni migration : la rouvrir ou l'abandonner ?
2. elearn-supabase #11 (auth) a été fermée alors que Supabase signale encore l'expiration des codes et les mots de passe compromis : à faire dans le tableau de bord ou assumer.
3. Orange Cameroun refusé dans le code : critère de recette « MTN et Orange ».
4. M17 échauffements : avant ou après le lancement ?
5. PR elearn #23 (notification « Paiement confirmé ») et #13 (préfixe Orange Cameroun) : à relire ou fermer.
6. Les clones locaux `elearn-app-ci` et `elearn-app-notif` portent la seule copie de deux branches non fusionnées.

## Trois priorités suivantes
1. Premier paiement réel (elearn-supabase #106) et mesure de l'entonnoir (#17).
2. Restaurer et déployer la migration des notifications (#34), voir la feuille K3 et le compteur de crédits sur téléphone.
3. Soumission iOS (#18) et publication Android (#19), puis les alertes de sécurité restantes.

## Changements locaux des anciens agents : verdict (6 octobre, inchangé)
- **Gardé** : notifications de Finitions (issue #32, refaites et fermées) ; écrans pawaPay de la branche `s0j9zh` comme référence (#35).
- **Reporté (lot 2)** : classes et classement de Profil (#38).
- **Abandonné** : fusion des composants de crédits de Réviser ; migration locale `20261002000000_credits_contenu_payant` ; parrainage et téléchargements de Profil ; file de publication (Benny déploie).
