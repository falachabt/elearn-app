# Fiche de test Elearn Prépa : validation de tout ce qui a été livré

Version du 13 octobre 2026. Destinataires : Benny et les testeurs humains. Dépôts couverts : `elearn-app` (branche de travail `claude/project-thread-kw792g`), `elearn-supabase` (branche `main`), `elearn-site` et `elearn_backoffice` pour les pages liées.

Cette fiche contient **155 cas de test** répartis en 23 sections. La même liste existe en CSV (`fiche-de-test-elearn-prepa.csv`, séparateur point-virgule, encodage UTF-8 avec BOM) pour l'importer dans un tableur : une ligne par test, avec les colonnes Statut, Commentaire, Testeur et Date à remplir.

## 1. Comment utiliser cette fiche

1. Lire la section 3 (interdits en production) avant de toucher à un paiement ou à WhatsApp.
2. Suivre l'ordre de passage de la section 5.
3. Pour chaque test : réunir les pré-conditions, suivre les étapes numérotées, comparer au résultat attendu, puis appliquer le critère de validation. Cocher un seul statut : À tester, OK ou KO. En cas de KO, noter dans le commentaire l'écran, l'heure, l'appareil, la version de l'app et une capture.
4. Colonne **Environnement** de chaque test : *Production possible* (lecture ou action sans conséquence réelle), *Bac à sable* (seulement avec des comptes de test, des codes de test et le jeton de bac à sable), *Interdit en production* (à ne jamais lancer sur des données réelles).
5. Colonne **Source** : *Constaté* indique ce qui a été lu dans le code, une migration, un commit ou un document du dépôt (avec la référence). *Déduit* indique une conclusion que je n'ai pas pu vérifier dans le code ; le testeur doit alors la confirmer ou l'infirmer. *CDC* renvoie à une exigence du cahier des charges v1.2.

### Limites de cette fiche

- Je n'ai pas fait tourner l'application : tout ce qui est marqué *Constaté* vient de la lecture du code, des migrations et de l'historique git (commits listés). Aucun test n'a été exécuté.
- Le fichier `suivi/bilan-cdc-2026-10-13.md` et le Cahier des charges v4 en ligne ne sont pas accessibles depuis cette machine. Le contenu du bilan est repris à travers `docs/PRIORITES.md` (mis à jour le 13 octobre en s'appuyant sur ce bilan). Le cahier des charges utilisé est la version 1.2 du 30 septembre 2026 (PDF de `elearn-app/docs`), plus ancienne que la v4 : les écarts sont à recontrôler.
- Les valeurs chiffrées (40 crédits, 25 par semaine, coûts, paliers) sont celles des migrations au 13 octobre 2026 et se règlent dans le back-office : relever la valeur affichée avant de conclure à un KO.

## 2. Comptes et matériel à préparer

- Un téléphone Android récent avec le dernier build (ou la mise à jour OTA de la branche de travail), idéalement un second Android pour les tests d'appareil unique.
- Un iPhone avec le build 17 (TestFlight) pour les tests iOS. Tant que la soumission iOS n'est pas faite (#18), ces tests restent à planifier.
- Un navigateur sur app.elearnprepa.com (PWA) et un autre pour les pages parents.
- Trois comptes Google de test jamais utilisés sur Elearn Prépa, plus un compte Google déjà lié à un compte existant.
- Un compte administrateur du back-office et, pour le rôle Support client, l'accès à la base de test.
- Des numéros de test pawaPay (bac à sable) et des codes promo de test créés par SQL par Benny.
- Une liste d'autorisation WhatsApp limitée au numéro de test de Benny.

## 3. Tests à ne pas faire en production

Ces points sont interdits sur l'environnement réel. Ils ne se testent qu'en bac à sable, en mode fictif, ou après accord explicite de Benny.

| Interdit en production | Pourquoi | Tests concernés | Alternative |
| --- | --- | --- | --- |
| Tout paiement avec un vrai numéro Mobile Money ou une vraie carte | Débit réel d'une vraie personne ; la bascule de pawaPay en production est un chantier P0 distinct (elearn-supabase #106) | PAS-03, PAS-04, PAS-07, PAS-08, PAS-11, PRO-01, PRO-04, PRO-05, LPA-02 à LPA-08 | Jeton sandbox pawaPay et numéros de test, bannière « mode test » visible |
| Premier paiement réel pawaPay | Décision de Benny seule | PAS-04 | Aucun, hors recette |
| Achat intégré Apple réel | Facturation Apple réelle | PAS-12 | Compte sandbox Apple dans TestFlight |
| Remboursement d'une vraie commande | Mouvement d'argent réel et retrait d'accès à un vrai client | SUP-03 | Commande de bac à sable uniquement |
| Envoi d'un message WhatsApp à un vrai parent, élève ou client | Contact réel, coût Meta, consentement | WHA-01 à WHA-10, LPA-08, GAG-05 (annuler avant l'envoi) | WHATSAPP_MODE=fictif, ou liste d'autorisation limitée au numéro de Benny. Vérifier d'abord le mode (WHA-01) |
| Partage réel d'un lien parent à une personne réelle | Envoi d'un lien de paiement à un tiers | LPA-01 | Copier le lien sans l'envoyer |
| Modifier la base de production (soldes, dates, codes, tâches planifiées) | Fausse les crédits et les droits des vrais élèves | CRE-04, CRE-05, CRE-16, MIS-04, PAS-13 | Environnement de test ou simulation du mode développeur |
| Suppression d'un vrai compte | Perte définitive après 30 jours | AUT-13 | Compte jetable créé pour le test |
| Envoi d'un faux rappel (webhook) sur la production | Risque d'attribuer un pass sans paiement | SEC-02 | Bac à sable seulement |
| Publication d'une entrée de changelog visible par tous les élèves | Message public aux vrais utilisateurs | SUP-05 | Brouillon, puis suppression |
| Rafales de messages au support WhatsApp | Épuise le quota quotidien du modèle d'IA (10 000 neurones par jour sur l'offre gratuite) | WHA-06 à WHA-09 | Simulation `repondreSupport` ou quelques messages espacés |

Règle simple : tout test dont l'environnement est *Bac à sable* ou *Interdit en production* ne se lance qu'avec les comptes, codes et numéros de test, après lecture de ce tableau.

## 4. Matrices par plateforme et par rôle

Répartition par environnement : Production possible 100, Bac à sable 52, Interdit en production 3. Un test marqué *Toutes* est compté dans les trois colonnes.

### 4.1 Nombre de tests par rôle et par plateforme

| Rôle | Web | Android | iOS | Total (sans doublon) |
| --- | --- | --- | --- | --- |
| Invité | 6 | 11 | 3 | 14 |
| Utilisateur | 37 | 100 | 32 | 111 |
| Parent | 13 | 0 | 0 | 13 |
| Support client | 16 | 1 | 0 | 17 |
| **Total** | 72 | 112 | 35 | 155 |

### 4.2 Identifiants des tests par rôle et plateforme

**Invité**

- Web : AUT-12, CRE-03, GAG-06, ARR-01, LIE-05, LIE-06
- Android : AUT-12, SYN-01, SYN-02, SYN-03, SYN-04, CRE-03, GAG-04, PAR-02, PAR-05, ARR-01, PAS-02
- iOS : AUT-12, CRE-03, ARR-01

**Utilisateur**

- Web : AUT-03, AUT-05, AUT-07, AUT-09, AUT-10, AUT-11, AUT-13, CRE-04, CRE-07, CRE-12, CRE-15, CRE-16, GAG-08, ARR-02, REP-06, REP-07, MIS-01, MIS-02, MIS-03, MIS-04, COU-01, COU-02, COU-03, COU-04, QUI-01, QUI-02, QUI-03, ANN-01, ANN-05, ANN-06, PAS-10, PWA-01, PWA-02, PWA-03, LIE-01, SEC-01, SEC-03
- Android : AUT-01, AUT-02, AUT-06, AUT-07, AUT-08, AUT-09, AUT-10, AUT-11, AUT-13, CRE-01, CRE-02, CRE-04, CRE-05, CRE-06, CRE-07, CRE-08, CRE-09, CRE-10, CRE-11, CRE-12, CRE-13, CRE-14, CRE-15, CRE-16, GAG-01, GAG-02, GAG-03, GAG-05, GAG-07, GAG-08, PAR-01, PAR-03, PAR-04, ARR-02, ARR-03, REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, REP-07, MIS-01, MIS-02, MIS-03, MIS-04, MIS-05, COU-01, COU-02, COU-03, COU-04, QUI-01, QUI-02, QUI-03, QUI-04, ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, ANN-06, PHO-01, PHO-02, PHO-03, PHO-04, PHO-05, PHO-06, PHO-07, PHO-08, OFF-01, OFF-02, OFF-03, OFF-04, PAS-01, PAS-03, PAS-04, PAS-05, PAS-06, PAS-07, PAS-08, PAS-09, PAS-10, PAS-11, PAS-13, PRO-01, PRO-02, PRO-03, PRO-04, LPA-01, LPA-07, NOT-01, NOT-02, NOT-03, NOT-05, NOT-06, WHA-05, WHA-07, SUP-01, LIE-02, LIE-03
- iOS : AUT-04, AUT-07, AUT-09, AUT-10, AUT-11, AUT-13, CRE-04, CRE-07, CRE-12, CRE-15, CRE-16, GAG-08, PAR-06, ARR-02, REP-06, REP-07, MIS-01, MIS-02, MIS-03, MIS-04, COU-01, COU-02, COU-03, COU-04, QUI-01, QUI-02, QUI-03, ANN-01, ANN-05, ANN-06, PAS-10, PAS-12

**Parent**

- Web : LPA-02, LPA-03, LPA-04, LPA-05, LPA-06, LPA-08, WHA-02, WHA-03, WHA-04, PRT-01, PRT-02, PRT-03, LIE-04
- Android : aucun test
- iOS : aucun test

**Support client**

- Web : PAR-07, PAR-08, PRO-05, WHA-01, WHA-06, WHA-08, WHA-09, WHA-10, SUP-02, SUP-03, SUP-04, SUP-05, SUP-06, SUP-07, SEC-02, SEC-04
- Android : NOT-04
- iOS : aucun test

Lecture : un testeur Parent n'a besoin que d'un navigateur ; un testeur Invité n'a besoin d'aucun compte ; le Support client suppose l'accès au back-office et à la base de test.

### 4.3 Particularités par plateforme

- **iOS** : pas de Mobile Money ni de prix local (règle App Store), achat intégré Apple, parrainage converti en crédits (PAS-12, PAR-06). Tests à planifier après la soumission iOS.
- **Web (PWA)** : démarrage à froid sans internet encore KO connu (PWA-02, issue #54) ; connexion Google par flux PKCE (AUT-03).
- **Android** : plateforme principale (99 pour cent de l'audience selon le CDC) ; notifications push, retour au premier plan, liens d'app sur build natif.

## 5. Ordre de passage recommandé

| Étape | Contenu | Pourquoi dans cet ordre |
| --- | --- | --- |
| 0 | Préparer comptes, matériel, liste d'autorisation WhatsApp ; lire la section 3 ; vérifier le mode WhatsApp (WHA-01) | Évite tout effet réel |
| 1 | Arrivée et invité : ARR-01 à ARR-03, CRE-03, MIS-01, MIS-03, COU-01 | Parcours d'un nouvel élève sans compte |
| 2 | Création de compte et synchronisation : AUT-01 à AUT-03, AUT-07, SYN-01 à SYN-04, CRE-01, CRE-02 | La suite dépend d'un compte avec ses crédits |
| 3 | Crédits : CRE-04 à CRE-16, GAG-01 à GAG-05, GAG-07 | Valide solde, dépenses et gains |
| 4 | Contenu : COU-02 à COU-04, QUI-01 à QUI-04, ANN-01 à ANN-05, REP-01 à REP-06, MIS-02 à MIS-05 | Contenu pédagogique et reprise |
| 5 | IA et photo : PHO-01 à PHO-08 | Consomme des crédits : à faire après les tests de crédits |
| 6 | Parrainage : PAR-01 à PAR-06, GAG-06 | Demande deux comptes et un lien |
| 7 | Hors ligne et réseau : OFF-01 à OFF-04, PWA-01 à PWA-03 | Perturbe le réseau, donc après les parcours qui en ont besoin |
| 8 | Pass et paiement en bac à sable : PAS-01 à PAS-13, PRO-01 à PRO-05 | Après les crédits, pour comparer avec et sans pass |
| 9 | Lien parent et reçu : LPA-01 à LPA-08, PRT-01 à PRT-03 | Utilise un paiement de bac à sable déjà prêt |
| 10 | Notifications : NOT-01 à NOT-06 | Besoin de paiements et de corrections pour déclencher des notifications |
| 11 | Appareil unique : AUT-10 à AUT-12, AUT-09 | Impose un second appareil ; fait tard pour ne pas gêner les autres tests |
| 12 | WhatsApp en mode fictif : WHA-02 à WHA-09 | Seulement si WHA-01 est validé |
| 13 | Back-office et support client : SUP-01 à SUP-07, PAR-07, PAR-08 | Vérifie les traces des étapes précédentes |
| 14 | Liens, Open Graph, sécurité : LIE-01 à LIE-06, SEC-01 à SEC-04 | Vérifications transverses en fin de recette |
| 15 | Suppression de compte : AUT-13 | Détruit le compte de test, donc en dernier |

Restent hors de cet ordre : AUT-04 à AUT-06 et AUT-08 (selon disponibilité du fournisseur), GAG-08 et ANN-06 (fonctionnalités absentes, sans exécution), PAS-04 et WHA-10 (interdits).

## 6. Écarts entre le cahier des charges et le code constatés

- **CDC M3-03** prévoit 3 corrections par photo gratuites par jour. Le code facture une photo 5 crédits (migration `20261001191000`, qui remplace le quota de 3 par jour). Voir PHO-04.
- **CDC M8-11** demande un lien parent valable 48 heures et à usage unique. La durée exacte dans le code n'a pas été relue : voir LPA-04.
- **CDC M8-05** demande qu'un paiement en attente expire après 10 minutes. La durée réelle n'a pas été relue : voir PAS-07.
- **CDC M6-05 (reprise pédagogique exacte)** : seules les sessions et le temps d'étude sont synchronisés entre appareils (REP-07).
- **Recharge hebdomadaire** : le commentaire de la migration `20261001190000` indique le lundi à 0 h (Douala), la tâche planifiée de notification part le lundi à 8 h (Douala). À constater (CRE-05).
- **WhatsApp** : le document `docs/whatsapp-kapso.md` décrit un mode fictif par défaut, `PRIORITES.md` indique « en service depuis le 11 octobre ». L'état réel du mode en production est à confirmer (WHA-01).

## 7. Fonctionnalités du cahier des charges sans test faute d'implémentation

Ces points sont attendus par le cahier des charges v1.2 mais je n'ai trouvé ni code ni migration correspondants, ou ils sont abandonnés, reportés ou non déployés. Ils n'ont donc pas de cas de test, hors une ligne de constat quand c'est utile.

| Exigence | Fonctionnalité | Constat | Référence |
| --- | --- | --- | --- |
| M2-04 | Connexion par numéro + code (WhatsApp ou SMS) | Abandonnée pour le moment (modèle Meta refusé) | PRIORITES, P2 ; docs/etude-connexion-whatsapp.md |
| M2-09 | Plusieurs profils sur un même téléphone | Aucun code trouvé (priorité C) | Recherche dans elearn-app/src |
| M3-07 | Question de suivi en texte sur la même correction | Aucun code trouvé (priorité C) | Recherche dans elearn-app/src |
| M4-04 | Plan de révision jusqu'à la date d'examen | Aucune date d'examen ni plan trouvés (priorité S) | Recherche dans elearn-app/src |
| M4-06 | Badges et récompenses simples | Pas de système de badges trouvé, seulement des icônes (priorité C) | Recherche dans elearn-app/src |
| M6-06 | Classement facultatif des candidats d'un concours | Issue #16 fermée le 12 octobre sans code ni migration | PRIORITES, À trancher point 1 |
| M10 | Écoles relais : classe, code, suivi de l'origine des inscriptions | Pages vitrine seulement (site) ; pas d'écran enseignant dans l'app ; reporté au lot 2 | PRIORITES, P3 |
| M11 | Espace partenaire (annonces, leads, tableau de bord) | Page vitrine seulement ; reporté au lot 2 | PRIORITES, P3 |
| M15-03 à M15-05 | Paliers communautaires, jauge sur l'accueil, écran de célébration | Aucun code trouvé ; seuls le parrainage et ses paliers de filleuls existent | GAG-08 |
| M17 | Échauffements | Pas commencé, à décider | PRIORITES, P3 |
| #38 | Classes et classement de Profil | Reporté au lot 2 | PRIORITES, P3 |
| elearn #28 | Back-office des codes promo | Non fait : codes créés par SQL | SUP-06 |
| Tickets de support | Tableau de bord de la file de tickets dans le back-office | Pas encore fait | SUP-07 |
| #34 | Notifications serveur (crédits presque épuisés, remboursement photo, sondage révélé) | La migration `20261007150000_notifs_credits_photo` n'a jamais été déployée | NOT-04 |
| #17 | Analytique PostHog : événements manquants, 5 tableaux non vérifiés | En cours (P1) ; non couvert par cette fiche car à vérifier dans PostHog, pas dans l'app | PRIORITES, P1 |

## 8. Cas de test

Légende : Statut = À tester / OK / KO (cocher une seule case). Commentaire : texte libre.

### 1. Authentification

#### AUT-01 : Connexion Google, compte inexistant (création)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : App installée, jamais connectée. Compte Google de test qui n'a jamais servi sur Elearn Prépa.
- **Étapes** :
  1. Ouvrir l'app et passer l'arrivée (classe, pays).
  2. Aller dans Moi puis choisir Continuer avec Google.
  3. Choisir le compte Google de test.
- **Résultat attendu** : Un compte est créé et l'app revient sur Moi, connectée, avec le prénom et la photo du compte Google.
- **Critère de validation** : Compte créé en moins de 10 s (CDC M2-01). Le prénom Google s'affiche dans l'accueil et dans Moi. Aucun formulaire e-mail n'apparaît.
- **Source** : Constaté : commits 3420916, 31da6a8, f27674a (nom et photo du fournisseur). CDC M2-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-02 : Connexion Google, compte existant (reconnexion)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte Google déjà lié à un compte Elearn Prépa. L'app vient d'être réinstallée ou l'utilisateur est déconnecté.
- **Étapes** :
  1. Ouvrir l'app sans session (invité).
  2. Choisir Continuer avec Google et sélectionner le compte déjà lié.
- **Résultat attendu** : On retombe sur le compte existant (pas de doublon) avec son historique, ses crédits et son pass.
- **Critère de validation** : Le solde de crédits, le pass et la progression sont ceux du compte d'origine. Aucun deuxième compte n'est créé (vérifiable dans le back-office).
- **Source** : Constaté : commits 31da6a8 (connexion au compte existant quand Google est déjà lié), 19d73fb (connexion directe)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-03 : Connexion Google sur le web (flux PKCE)

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Navigateur sur app.elearnprepa.com. Compte Google de test.
- **Étapes** :
  1. Ouvrir app.elearnprepa.com en tant qu'invité.
  2. Aller dans Moi, choisir Continuer avec Google, valider la page Google.
  3. Revenir sur l'app.
- **Résultat attendu** : Retour sur l'app connecté, pas sur l'écran de bienvenue. Le profil d'arrivée (classe, pays) est conservé.
- **Critère de validation** : L'élève connecté n'est jamais renvoyé vers bienvenue. Après un rechargement de page, la session est toujours active.
- **Source** : Constaté : commits d7cefac (PKCE), 9f69952 (code OAuth échangé avant la session invité), 7e781d3 (réglages appliqués avant les onglets), e2642a9
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-04 : Connexion avec Apple (iOS natif)

- **Rôle** : Utilisateur · **Plateforme** : iOS · **Environnement** : Production possible
- **Pré-conditions** : iPhone avec un build natif contenant la connexion Apple. Identifiant Apple de test.
- **Étapes** :
  1. Dans Moi, choisir Continuer avec Apple.
  2. Valider avec Face ID ou le mot de passe Apple.
- **Résultat attendu** : Compte créé ou retrouvé, app connectée.
- **Critère de validation** : Le bouton Apple est visible dès que Google est proposé (règle App Store 4.8, CDC M2-02). Le logo Apple s'affiche sur le bouton.
- **Source** : Constaté : commits f673da3, a2e899b ; commentaire de BoutonsSociaux.tsx. Test sur appareil iOS réel encore à faire (PRIORITES, #18)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-05 : Connexion avec Apple sur le web (OAuth)

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Navigateur. Fournisseur Apple activé côté Supabase (à confirmer avec Benny avant le test).
- **Étapes** :
  1. Dans Moi, choisir Continuer avec Apple.
  2. Terminer le flux Apple.
- **Résultat attendu** : Retour dans l'app connecté.
- **Critère de validation** : Soit la connexion aboutit, soit le bouton est absent si le fournisseur n'est pas activé : aucun écran d'erreur brut.
- **Source** : Constaté : commit f673da3 (Apple via OAuth Supabase sur le web). Déduit : l'activation du fournisseur n'est pas vérifiée
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-06 : Connexion Facebook

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Fournisseur Facebook activé côté Supabase (le bouton est masqué sinon).
- **Étapes** :
  1. Dans Moi, regarder les boutons de connexion.
  2. Si Facebook est proposé, se connecter avec un compte Facebook de test.
- **Résultat attendu** : Connexion réussie, ou bouton Facebook absent sans message d'erreur.
- **Critère de validation** : Aucune erreur brute. En parcours Sauvegarder mon score, seul Google (et Apple sur iOS) est proposé.
- **Source** : Constaté : commit 6d270cc (affiché quand le fournisseur est activé), BoutonsSociaux.tsx (googleSeul). CDC M2-03
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-07 : Pas de formulaire e-mail ni de connexion par numéro

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : App récente.
- **Étapes** :
  1. Ouvrir Moi puis l'écran de création de compte et de connexion.
  2. Chercher un champ e-mail, mot de passe ou numéro de téléphone.
- **Résultat attendu** : Seuls les fournisseurs sociaux sont proposés.
- **Critère de validation** : Aucun formulaire e-mail ni connexion par numéro visible. La connexion par WhatsApp est abandonnée pour le moment (PRIORITES).
- **Source** : Constaté : commits a222920 (formulaire e-mail coupé), c5f8883 (connexion par téléphone masquée) ; PRIORITES.md
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-08 : Reprise d'un ancien compte (numéro + mot de passe)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Un compte de l'ancienne application existe (numéro et mot de passe connus de Benny). Fournir un compte de test ancien.
- **Étapes** :
  1. Dans l'arrivée ou Moi, ouvrir Retrouver mon ancien compte.
  2. Saisir les identifiants de l'ancien compte.
  3. Suivre les étapes de rattachement proposées.
- **Résultat attendu** : L'ancien historique est retrouvé et rattaché à la connexion sociale.
- **Critère de validation** : Après rattachement, l'ancien historique est visible et se reconnecter avec Google donne le même compte (CDC M2-06).
- **Source** : Constaté : commit 2207871 (A7, reprise des anciens comptes) ; écran compte/ancien.tsx. Déduit : le détail du parcours est à découvrir pendant le test
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-09 : Déconnexion

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Connecté avec un compte qui a un solde, une progression locale et des notifications.
- **Étapes** :
  1. Aller dans Moi puis choisir Se déconnecter.
  2. Confirmer.
  3. Rouvrir l'app.
- **Résultat attendu** : Le téléphone est nettoyé et l'app revient à l'écran de bienvenue.
- **Critère de validation** : Plus aucun nom, solde, progression ni cache du compte précédent. Un autre compte connecté ensuite ne voit rien du premier.
- **Source** : Constaté : commits ad6c7fe (la déconnexion nettoie le téléphone), bb2235c (déconnexion complète et réinitialisation de session)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-10 : Un seul appareil actif : connexion sur un deuxième appareil

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Un compte connecté sur l'appareil A. Un appareil B disponible.
- **Étapes** :
  1. Se connecter avec le même compte sur l'appareil B.
  2. Observer l'appareil B puis l'appareil A (rester dans l'app, ou la rouvrir).
- **Résultat attendu** : B devient l'appareil actif. A est averti et déconnecté.
- **Critère de validation** : A affiche la modale Appareil actif / message explicatif et revient à une session fermée. B fonctionne normalement. Le compteur mensuel passe à 1 changement.
- **Source** : Constaté : migration 20261012040000 (register_active_device), commits 0453cf3, bb2235c, 5d7c350 (ModaleAppareilActif)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-11 : Un seul appareil actif : limite de 3 changements par mois

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte de test et trois appareils (ou un appareil réinitialisé).
- **Étapes** :
  1. Faire 3 changements d'appareil dans le mois (A vers B, B vers A, A vers B).
  2. Tenter un quatrième changement.
  3. Revenir sur l'appareil actif d'origine.
- **Résultat attendu** : Le quatrième changement est refusé avec un message clair indiquant la date de remise à zéro.
- **Critère de validation** : Le statut limit_reached est affiché, l'ancien appareil reste actif, la procédure de support est mentionnée. Le compteur repart à 0 le 1er du mois (Africa/Douala).
- **Source** : Constaté : migration 20261012040000 (3 changements par mois, remise à zéro le 1er du mois)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-12 : Un seul appareil actif : reconnexion sur le même appareil et invités exemptés

- **Rôle** : Invité · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Un compte connecté sur A. Un invité (sans compte) sur le même appareil ou un autre.
- **Étapes** :
  1. Se déconnecter puis se reconnecter sur A avec le même compte.
  2. Utiliser l'app en invité sur deux appareils.
- **Résultat attendu** : Aucun changement n'est compté pour la reconnexion sur le même appareil. Les invités ne sont pas limités.
- **Critère de validation** : Le compteur de changements reste inchangé (statut same_device). Aucun blocage pour les invités (statut anonymous).
- **Source** : Constaté : migration 20261012040000 (same_device, anonymous)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### AUT-13 : Suppression du compte depuis l'app

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Bac à sable
- **Pré-conditions** : Compte de test jetable. Ne jamais utiliser un vrai compte client.
- **Étapes** :
  1. Aller dans Moi, Paramètres, Supprimer mon compte.
  2. Lire l'avertissement et confirmer.
  3. Essayer de se reconnecter avec le même compte Google.
- **Résultat attendu** : La suppression est enregistrée, l'élève est déconnecté, l'effacement effectif est planifié sous 30 jours.
- **Critère de validation** : L'écran confirme la suppression et la durée. Aucun accès aux anciennes données après reconnexion immédiate. Un lien existe aussi sur le site (supprimer-mon-compte).
- **Source** : Constaté : commit 8d8ccec (M2-08), e6ee829 et 19f4055 (cron de suppression à 30 jours) ; page elearn-site supprimer-mon-compte. CDC M2-08
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 2. Synchronisation de la session invité vers le compte

#### SYN-01 : Score du mini-test conservé après création du compte

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : App neuve, jamais connectée.
- **Étapes** :
  1. Faire l'arrivée puis le mini-test de 5 questions.
  2. Sur l'écran de score, noter le score affiché.
  3. Choisir Sauvegarder mon score puis Continuer avec Google.
  4. Aller sur l'accueil et dans Moi.
- **Résultat attendu** : Le score du mini-test est toujours visible dans le compte.
- **Critère de validation** : Même score avant et après la création du compte (CDC M1-04). L'invitation Sauvegarder n'apparaît qu'une seule fois et peut être ignorée (Continuer sans compte).
- **Source** : Constaté : commits 9fccb0b, 22261e0, c3466c2, 04a1c97, 80c4561 (conversion invité) ; migration 20261003110000 (transfer_guest_progress). CDC M1-04, M2-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SYN-02 : Progression invitée (mission, leçons lues, quiz) migrée vers le compte

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Invité ayant terminé une mission, lu une leçon et fait un quiz.
- **Étapes** :
  1. Créer un compte via Google depuis Moi.
  2. Vérifier l'écran de reprise de la progression s'il apparaît, accepter.
  3. Vérifier la série, les leçons lues et les scores.
- **Résultat attendu** : La progression locale est transférée sur le compte.
- **Critère de validation** : La série de jours, les leçons lues et les meilleurs scores quiz sont visibles après la création. La fonction serveur transfer_guest_progress est appelée sans erreur.
- **Source** : Constaté : migration 20261003110000, edge function transfer-guest-progress, commits 8078c0f (reprise non déclenchée trop tôt pendant OAuth), 1399cb2 (condition de reprise de la progression invitée)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SYN-03 : Reprise invitée quand le compte cible a déjà une progression

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Invité avec progression locale. Compte Google déjà utilisé sur un autre appareil et avec sa propre progression.
- **Étapes** :
  1. Se connecter avec ce compte Google existant depuis l'invité.
  2. Lire la proposition de reprise.
  3. Choisir d'abord de garder la progression du compte puis recommencer en choisissant d'ajouter la progression invitée.
- **Résultat attendu** : L'app ne perd aucune des deux progressions sans choix explicite.
- **Critère de validation** : Le choix est expliqué clairement. Le résultat correspond au choix. Le compte garde ses crédits et son pass.
- **Source** : Constaté : écran compte/reprise.tsx, services/repriseInvite.ts. Déduit : les libellés exacts du choix sont à relever pendant le test
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SYN-04 : Crédits invités après création du compte

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Invité ayant dépensé une partie de son lot d'invité (15 crédits).
- **Étapes** :
  1. Créer un compte.
  2. Ouvrir la page Crédits.
- **Résultat attendu** : Le lot invité disparaît du solde du compte et le cadeau de bienvenue le remplace (voir CRE-01).
- **Critère de validation** : Pas de double comptage du lot d'invité. L'ancienne entrée invitée est supprimée des appareils et soldes (nettoyage serveur).
- **Source** : Constaté : migration 20261012020000 (transfer_guest_progress supprime p_guest dans credit_devices et credit_balances) ; credit_settings.guest_amount = 15
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 3. Crédits : cadeau, recharge du lundi, dépense

#### CRE-01 : Cadeau de 40 crédits à la création du compte

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Appareil jamais utilisé avec un compte Elearn Prépa (ou appareil réinitialisé), compte Google neuf.
- **Étapes** :
  1. Créer un compte via Google.
  2. Observer l'écran de bienvenue des crédits et la notification éventuelle.
  3. Ouvrir la page Crédits.
- **Résultat attendu** : Un écran ou une feuille annonce le bonus de bienvenue et le solde passe à 40.
- **Critère de validation** : Solde = 40 crédits. Une ligne Bonus de bienvenue (+40) apparaît dans l'historique. Une notification « Bonus de bienvenue » est reçue ou visible dans la cloche.
- **Source** : Constaté : migration 20261001190000 (welcome_amount = 40), 20261002030000 (notification de bienvenue) ; commit 0f054fc
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-02 : Cadeau de 40 crédits une seule fois par appareil

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Appareil où un cadeau a déjà été reçu (CRE-01). Un deuxième compte Google neuf.
- **Étapes** :
  1. Se déconnecter.
  2. Créer un deuxième compte Google sur le même appareil.
  3. Consulter le solde.
- **Résultat attendu** : Le deuxième compte ne reçoit pas le cadeau de 40 crédits.
- **Critère de validation** : Pas de ligne welcome pour le second compte. L'appareil est présent dans credit_welcome_devices. Le solde ne contient que le lot de la semaine éventuel.
- **Source** : Constaté : migration 20261001190000 (credit_welcome_devices, un bonus par appareil)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-03 : Aucun cadeau pour un invité

- **Rôle** : Invité · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Appareil neuf, mode invité.
- **Étapes** :
  1. Ouvrir l'app en invité sans créer de compte.
  2. Ouvrir le compteur de crédits (puce ou page Crédits).
- **Résultat attendu** : L'invité dispose d'un lot unique de 15 crédits, pas de 40.
- **Critère de validation** : Solde invité = 15. Aucun bonus de bienvenue ni recharge du lundi pour l'invité.
- **Source** : Constaté : migration 20261001190000 (guest_amount = 15, bonus réservé aux comptes). Déduit : 15 crédits divisés par 5 = 3 corrections photo invitées, cohérent avec CDC M1-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-04 : Recharge du lundi non cumulable

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Bac à sable
- **Pré-conditions** : Compte avec un solde gratuit de la semaine. Utiliser le mode développeur pour simuler une date ou attendre un lundi. Ne pas modifier la base en production.
- **Étapes** :
  1. Noter le solde gratuit (moins de 25 si des crédits ont été dépensés).
  2. Passer au lundi suivant (simulation développeur ou attente réelle).
  3. Rouvrir l'app et regarder le solde.
- **Résultat attendu** : Le solde gratuit est remis au montant hebdomadaire de 25 crédits, il ne s'additionne pas à l'ancien solde.
- **Critère de validation** : Avec 3 crédits restants le lundi, le solde passe à 25 (et non 28). Historique : ligne de recharge hebdomadaire. Les crédits de récompense restent à part.
- **Source** : Constaté : migration 20261001190000 (weekly_amount = 25, remise au montant sans cumul), commit ec4a0cd. Déduit : le cas du cadeau de 40 non dépensé le lundi suivant n'est pas explicité dans le code lu, à constater au test
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-05 : Heure de la recharge et notification du lundi

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Notifications push autorisées, catégorie crédits activée.
- **Étapes** :
  1. Attendre le lundi (ou faire déclencher la tâche planifiée par Benny sur un compte de test).
  2. Observer la notification.
- **Résultat attendu** : Notification de crédits rechargés le lundi vers 8 h à Douala, et solde remis à jour au retour dans l'app.
- **Critère de validation** : La tâche weekly-credit-refill tourne le lundi à 7 h UTC (8 h Douala). Le solde se rafraîchit quand l'app revient au premier plan.
- **Source** : Constaté : migration 20261012030000 (cron '0 7 * * 1'), commit ec4a0cd (rafraîchissement au retour au premier plan). Le commentaire de la migration crédits parle d'une recharge le lundi à 0 h : l'heure exacte est à constater
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-06 : Comptes multiples sur un même appareil : recharge hebdomadaire

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Un appareil avec trois comptes Google non anonymes de test.
- **Étapes** :
  1. Se connecter successivement avec les comptes 1, 2 puis 3 sur le même appareil.
  2. Attendre le lundi suivant, regarder le solde de chaque compte.
- **Résultat attendu** : Seuls les deux premiers comptes enregistrés sur l'appareil reçoivent la recharge du lundi.
- **Critère de validation** : Le troisième compte n'est pas rechargé (max_accounts_per_device = 2). Les comptes invités ne comptent pas dans la limite.
- **Source** : Constaté : migrations 20261001190000 et 20261012020000 (credit_weekly_eligible)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-07 : Compteur de crédits visible sur Accueil, Réviser et Moi

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec solde non nul.
- **Étapes** :
  1. Ouvrir l'accueil, l'onglet Réviser, l'onglet Moi.
  2. Toucher la puce de crédits.
- **Résultat attendu** : Le compteur apparaît sur les trois écrans et la feuille de détail s'ouvre.
- **Critère de validation** : Même valeur partout. La feuille de détail liste la provenance (semaine, récompense, expiration). Reste à valider sur téléphone (PRIORITES : compteur de crédits).
- **Source** : Constaté : commits 0f054fc, 73cd2f6, b52d3d1 (K1 et K1b) ; PRIORITES (à voir sur téléphone)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-08 : Dépense d'une explication de quiz (1 crédit)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec au moins 5 crédits, sans pass actif.
- **Étapes** :
  1. Ouvrir un quiz de chapitre et répondre à une question.
  2. Toucher Voir la justification.
  3. Confirmer la dépense si une confirmation s'affiche.
- **Résultat attendu** : La justification s'affiche et 1 crédit est débité.
- **Critère de validation** : Solde avant moins 1 = solde après. Une seule ligne de dépense dans l'historique. Rouvrir la même justification ne redébite pas.
- **Source** : Constaté : migration 20261001190000 (quiz_explanation = 1), commits bf66211, 89dfe00, 09c5026 (déjà ouvert = gratuit à rouvrir)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-09 : Dépense du corrigé d'un exercice (2 crédits)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec au moins 5 crédits, sans pass.
- **Étapes** :
  1. Ouvrir un exercice et aller sur l'onglet Corrigé.
  2. Confirmer l'ouverture.
- **Résultat attendu** : Le corrigé s'affiche, 2 crédits sont débités.
- **Critère de validation** : Débit de 2, une seule ligne dans l'historique. Les exercices déjà ouverts restent gratuits à rouvrir.
- **Source** : Constaté : migration 20261001190000 (exercise_solution = 2), commit 09c5026
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-10 : Dépense d'un document PDF (3 crédits) et d'une correction d'annale (5 crédits)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec au moins 10 crédits, sans pass.
- **Étapes** :
  1. Ouvrir un document payant (puce de coût visible sur la ligne) et confirmer.
  2. Ouvrir la correction détaillée d'un sujet d'annale et confirmer.
- **Résultat attendu** : Document ouvert pour 3 crédits, correction d'annale pour 5.
- **Critère de validation** : Débits exacts de 3 puis 5. Un document marqué gratuit ne débite rien. La puce de coût correspond au débit réel.
- **Source** : Constaté : migration 20261001190000 (document_pdf = 3, exam_correction = 5), commit 09c5026 (badges de coût sur les lignes de documents)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-11 : Pass actif : dépenses sans débit

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte avec un pass actif (acheté en bac à sable ou attribué par un code promo à 100 pour cent).
- **Étapes** :
  1. Ouvrir une justification de quiz, un corrigé d'exercice, un PDF.
  2. Comparer le solde avant et après.
- **Résultat attendu** : Aucun débit. Les contenus s'ouvrent immédiatement.
- **Critère de validation** : Solde identique avant et après. La justification et le corrigé sont préchargés sans changer d'onglet tout seul : l'onglet Énoncé reste affiché jusqu'à l'action de l'élève.
- **Source** : Constaté : migration 20261001190000 (pass = crédits illimités), commits 5c610e2, 9c21e25 (préchargement sans bascule), docs/attentes-manquantes-cahier-des-charges.md
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-12 : Solde insuffisant : feuille Crédits épuisés

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec 0 crédit et sans pass (utiliser le solde simulé du mode développeur si besoin).
- **Étapes** :
  1. Tenter d'ouvrir une justification de quiz ou un corrigé.
  2. Observer la feuille qui s'ouvre.
- **Résultat attendu** : Une feuille à trois choix s'ouvre : Recharger, Gagner des crédits, Plus tard.
- **Critère de validation** : Aucun débit, aucun contenu ouvert. Recharger mène aux offres, Gagner des crédits mène à la page Crédits, Plus tard ferme la feuille. Le texte diffère pour un invité (création de compte) et pour un connecté.
- **Source** : Constaté : commits 626acfd (K3 à trois choix), 6b3211a, 89dfe00 ; maquette k3-credits-epuises.html validée le 6 octobre ; reste à voir sur téléphone (PRIORITES)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-13 : Double clic et nouvelle tentative : jamais de double débit

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec au moins 10 crédits.
- **Étapes** :
  1. Toucher très rapidement deux fois sur l'ouverture d'un corrigé payant.
  2. Couper le réseau juste après la confirmation, puis le rétablir.
  3. Vérifier le solde et l'historique.
- **Résultat attendu** : Un seul débit est enregistré pour une seule ouverture.
- **Critère de validation** : Une seule ligne de dépense pour le contenu. Si le réseau a coupé, la requête rejouée ne débite pas deux fois (idempotence).
- **Source** : Constaté : migration 20261005180000 (dépense idempotente), commit 3c37dbf (rejeu idempotent, plus de double débit)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-14 : Toast de recharge de crédits

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté. Le solde augmente (récompense, recharge, achat).
- **Étapes** :
  1. Réclamer une action quotidienne ou recevoir une recharge.
  2. Revenir sur l'écran courant.
- **Résultat attendu** : Un toast de crédits rechargés s'affiche brièvement avec le montant.
- **Critère de validation** : Le toast apparaît une seule fois par gain, disparaît seul et n'empêche pas de continuer.
- **Source** : Constaté : composant ToastRechargeCredits, commit 6aa4e4e ; branche supabase feat/credit-recharge-toast-and-push. Déduit : déclencheurs exacts à observer
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-15 : Historique des crédits paginé

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec plus de 30 lignes d'historique (ou ajouter des dépenses de test).
- **Étapes** :
  1. Ouvrir la page Crédits, descendre jusqu'à l'historique.
  2. Charger la page suivante.
- **Résultat attendu** : L'historique s'affiche par pages de 30 lignes avec la provenance de chaque ligne.
- **Critère de validation** : Pas de doublon entre deux pages. Lignes de type bienvenue, recharge, récompense, dépense, remboursement bien distinguées.
- **Source** : Constaté : app/credits/index.tsx (TAILLE_PAGE = 30), commit 82e4220
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### CRE-16 : Crédits de récompense : expiration

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Bac à sable
- **Pré-conditions** : Compte ayant reçu un lot de récompense avec une date de fin proche (fournie par Benny ou simulation).
- **Étapes** :
  1. Ouvrir la feuille de détail des crédits.
  2. Après la date de fin, rouvrir la feuille.
- **Résultat attendu** : Le lot expiré n'est plus utilisable ni compté dans le solde.
- **Critère de validation** : Le solde affiché égale la somme du journal moins les lots expirés (CDC M15-01).
- **Source** : Constaté : migration 20261001190000 (credit_reward_lots, type expire). CDC M15-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 4. Gagner des crédits

#### GAG-01 : Action quotidienne : visite du site web (+10)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté, action pas encore faite aujourd'hui.
- **Étapes** :
  1. Ouvrir la page Crédits.
  2. Dans Gagner des crédits, toucher Gagner 10 sur la carte du site.
  3. Revenir dans l'app après l'ouverture du navigateur.
- **Résultat attendu** : 10 crédits sont ajoutés et la carte passe à Fait.
- **Critère de validation** : Solde +10. Ligne Action quotidienne : site_web dans l'historique. Les crédits expirent dans 30 jours.
- **Source** : Constaté : migration 20261004151140 (claim_daily_action : site_web = 10, 30 jours), actionsCredits.ts
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-02 : Actions quotidiennes Facebook et Instagram (+5 chacune)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté, actions pas encore faites.
- **Étapes** :
  1. Toucher Gagner 5 sur la carte Facebook, revenir.
  2. Toucher Gagner 5 sur la carte Instagram, revenir.
- **Résultat attendu** : Chaque action donne 5 crédits une fois.
- **Critère de validation** : Solde +5 puis +5. Les cartes passent à Fait. Les liens ouverts sont ceux des pages Elearn Prépa (facebook.com/elearnprepa, instagram.com/elearnprepa).
- **Source** : Constaté : migration 20261004151140, actionsCredits.ts
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-03 : Action quotidienne : une seule fois par jour, remise à zéro à minuit de Douala

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte ayant déjà réclamé GAG-01 aujourd'hui.
- **Étapes** :
  1. Retoucher la carte déjà faite.
  2. Fermer et rouvrir l'app, vérifier que la carte reste Fait.
  3. Le lendemain (heure de Douala), rouvrir la page Crédits.
- **Résultat attendu** : Aucun gain supplémentaire le même jour. La carte redevient réclamable le jour suivant.
- **Critère de validation** : Pas de deuxième crédit le même jour. L'état Fait vient du serveur (table daily_reward_claims) même après réinstallation ou sur un autre téléphone. Un changement de fuseau du téléphone ne contourne pas la règle.
- **Source** : Constaté : migration 20261004151140 (clé primaire utilisateur, action, date Africa/Douala), commits dbe165c, 11ff187 (actions déjà réclamées affichées comme faites après reconnexion)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-04 : Action quotidienne refusée à l'invité

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Invité (sans compte).
- **Étapes** :
  1. Aller sur la page Crédits et toucher une action Gagner.
- **Résultat attendu** : Le gain n'est pas accordé à un invité.
- **Critère de validation** : Aucun crédit ajouté sans compte, l'app invite à créer un compte ou n'affiche pas l'action. La fonction serveur renvoie 0 pour un utilisateur non connecté.
- **Source** : Constaté : migration 20261004151140 (retourne 0 si auth.uid() est nul). Déduit : le message affiché à l'invité est à relever
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-05 : Partage d'une correction photo : +5 crédits

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté ayant une correction photo terminée.
- **Étapes** :
  1. Ouvrir une correction photo dans l'historique.
  2. Toucher Partager et choisir WhatsApp.
  3. Lire le message prérempli, puis annuler l'envoi dans WhatsApp (aucun message réel nécessaire).
  4. Revenir dans l'app.
- **Résultat attendu** : Le message de partage est épuré avec un lien, et 5 crédits de récompense sont accordés une fois par jour.
- **Critère de validation** : Solde +5 (valables 30 jours). Un second partage le même jour n'ajoute rien. Le message contient un lien. Si le gain n'est accordé qu'après l'envoi effectif, le noter dans le commentaire.
- **Source** : Constaté : migration 20261011130000 (grant_share_reward, 5 crédits, 30 jours, 1 par jour et par type), commits bcf1a20, f3564ae. Déduit : le moment exact du gain (ouverture du partage ou envoi) n'est pas lu
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-06 : Page publique d'une correction partagée

- **Rôle** : Invité · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Un lien de partage /c/<id> d'une correction photo existante.
- **Étapes** :
  1. Ouvrir le lien dans un navigateur sans session.
  2. Vérifier le rendu des formules et de la méthode.
  3. Toucher l'appel à télécharger l'app.
- **Résultat attendu** : La correction s'affiche en lecture seule, formules rendues proprement, avec un appel à installer l'app.
- **Critère de validation** : Formules KaTeX lisibles (vert émeraude), méthode affichée, aucune donnée personnelle de l'élève. L'aperçu Open Graph du lien est correct (voir LIE).
- **Source** : Constaté : elearn-site commits 3ff39c5, f5015e8, 9cae059 ; migration 20261011150000 (get_shared_correction)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-07 : Paliers de parrainage : 1, 3, 5 puis 10 filleuls

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte parrain de test. Paliers par défaut : 1 filleul = 50 crédits, 3 = 150, 5 = 300, 10 = 700 (modifiables au back-office).
- **Étapes** :
  1. Ouvrir Parrainage puis Récompenses.
  2. Vérifier la liste des paliers et la progression.
  3. Quand un palier est atteint, réclamer la récompense.
- **Résultat attendu** : Les paliers sont affichés avec leur valeur actuelle et peuvent être réclamés une fois.
- **Critère de validation** : Valeurs affichées égales à celles du back-office (referral_milestones). La réclamation crédite le montant exact, une seule fois par palier, avec notification.
- **Source** : Constaté : migrations 20261004120000 (paliers par défaut), 20261010160000 (back-office), 20261010220000 (notification au versement) ; app/parrainage/recompenses.tsx
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### GAG-08 : Paliers communautaires (abonnés Facebook et Instagram)

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Sans objet : fonctionnalité non trouvée.
- **Étapes** :
  1. Chercher une jauge communautaire sur l'accueil (« Plus que N abonnés avant le palier »).
- **Résultat attendu** : Non testable : aucune implémentation trouvée.
- **Critère de validation** : À rouvrir quand la fonctionnalité existera. Voir la section des fonctionnalités du cahier des charges sans test.
- **Source** : Déduit : recherche sans résultat dans elearn-app/src pour « communaut » ; CDC M15-03, M15-04, M15-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 5. Parrainage

#### PAR-01 : Obtenir et copier son code et son lien de parrainage

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Aller dans Moi puis Parrainage.
  2. Copier le code, copier ou partager le lien.
- **Résultat attendu** : Un code personnel et un lien app.elearnprepa.com/r/<code> sont affichés.
- **Critère de validation** : Le code est stable d'une session à l'autre. Le lien copié contient le code. Une page d'invitation /r/<code> existe aussi sur le site.
- **Source** : Constaté : migrations 20261004120000, 20261004121000 ; app/parrainage/index.tsx, app/r/[code].tsx ; site [locale]/(public)/r/[code]
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-02 : Filleul : ouverture du lien avant création du compte

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Un lien de parrainage valide d'un compte A. Appareil du filleul sans compte.
- **Étapes** :
  1. Ouvrir le lien de parrainage.
  2. Observer la réaction de l'app.
  3. Créer le compte via Google.
- **Résultat attendu** : Le code est capté, l'app redirige vers la création de compte, puis le parrainage s'applique.
- **Critère de validation** : Message de confirmation clair pour un invité. Après création du compte : le filleul reçoit 30 crédits (valables 90 jours) et une notification Code de parrainage validé.
- **Source** : Constaté : commits 832c766, 68a3ef4, 663c4d8 (/r/ distinct de /rejoindre/), migration 20261005110000 (30 crédits au filleul). CDC M15
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-03 : Parrain : récompense à l'inscription d'un filleul

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Parrain A. Un filleul vient de s'inscrire avec son code (PAR-02).
- **Étapes** :
  1. Sur l'appareil de A, ouvrir les notifications et la page Crédits.
  2. Ouvrir Parrainage.
- **Résultat attendu** : A reçoit 30 crédits (90 jours), une notification de nouveau filleul inscrit et voit le filleul dans sa liste.
- **Critère de validation** : Solde de A +30. Ligne « Filleul inscrit » dans l'historique. Le compteur de filleuls du palier augmente de 1.
- **Source** : Constaté : migration 20261005110000 (apply_referral_on_signup : 30 crédits chacun, notifications croisées)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-04 : Auto-parrainage et deuxième code refusés

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte A avec son code. Compte B déjà parrainé.
- **Étapes** :
  1. Appliquer son propre code avec le compte A.
  2. Appliquer un autre code avec le compte B déjà parrainé.
- **Résultat attendu** : Les deux tentatives sont refusées sans crédit.
- **Critère de validation** : Aucun crédit accordé. Les raisons côté serveur sont code_invalide_ou_auto_parrainage et deja_parraine. Message non culpabilisant côté app.
- **Source** : Constaté : migration 20261005110000 (apply_referral_on_signup)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-05 : Lien de parrainage ouvert par quelqu'un qui a déjà un compte

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Lien de parrainage ouvert par une personne qui a déjà un compte Elearn Prépa.
- **Étapes** :
  1. Ouvrir le lien puis se connecter avec un compte déjà existant.
- **Résultat attendu** : Pas de parrainage appliqué à un compte déjà existant, sans message d'erreur agressif.
- **Critère de validation** : Aucun double crédit. Le comportement exact (refus silencieux ou message) est à relever par le testeur.
- **Source** : Déduit : le code attribue le parrainage à la création du compte (commit 1be4125 utilise une RPC au lieu des métadonnées) ; cas limite non documenté
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-06 : Parrainage sur iOS : récompense en crédits seulement

- **Rôle** : Utilisateur · **Plateforme** : iOS · **Environnement** : Production possible
- **Pré-conditions** : iPhone. Palier de type jours de pass configuré au back-office (ou simulation iOS en mode développeur).
- **Étapes** :
  1. Atteindre un palier de type pass_days et le réclamer depuis iOS.
- **Résultat attendu** : La récompense est convertie en crédits (30 crédits par jour de pass par défaut) et non en jours de pass.
- **Critère de validation** : Aucun jour de pass accordé depuis iOS. Le nombre de crédits correspond aux jours multipliés par ios_pass_day_credits. La colonne platform vaut ios dans la récompense.
- **Source** : Constaté : migration 20261010160000 (règle iOS, interrupteur ios_credits_only activé par défaut). Test sur iPhone réel à faire
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-07 : Détection d'abus et bannissement du parrainage (back-office)

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Accès au back-office, page Parrainage. Un cas d'abus de test ou un compte de test.
- **Étapes** :
  1. Ouvrir la page Parrainage du back-office, onglet abus.
  2. Marquer un signal comme ignoré, puis un autre comme banni.
  3. Sur le compte banni, essayer de parrainer.
- **Résultat attendu** : Le signal est traité avec une note. Un compte banni ne peut plus parrainer ni être parrainé.
- **Critère de validation** : Résolution ignorée ou bannie, auteur de la résolution renseigné. Le compte banni figure dans referral_bans. L'action est journalisée.
- **Source** : Constaté : migration 20261010160000, back-office commit 1867bc2 (instructor/parrainage)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAR-08 : Back-office : modifier un palier sans nouvelle version de l'app

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Rôle administrateur dans le back-office.
- **Étapes** :
  1. Changer la valeur d'un palier (par exemple 5 amis : 300 vers 320).
  2. Rouvrir la page Récompenses dans l'app.
  3. Remettre la valeur d'origine.
- **Résultat attendu** : L'app affiche la nouvelle valeur sans mise à jour.
- **Critère de validation** : La valeur change dans l'app après rafraîchissement. L'administrateur et la date de modification sont enregistrés.
- **Source** : Constaté : migration 20261010160000 (CRUD des paliers). CDC M12-02
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 6. Arrivée, choix de classe ou de concours

#### ARR-01 : Premier lancement : choix élève ou candidat, classe ou concours, pays

- **Rôle** : Invité · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : App neuve ou données effacées.
- **Étapes** :
  1. Ouvrir l'app.
  2. Choisir Je suis élève (puis Je prépare un concours en recommençant).
  3. Choisir la classe ou le concours, le pays.
  4. Arriver sur l'accueil.
- **Résultat attendu** : L'arrivée se termine en 3 appuis environ, sans compte demandé. Le pays est présélectionné selon la région du téléphone.
- **Critère de validation** : Aucun compte exigé. Les sections de l'arrivée sont numérotées et lisibles. La recherche de pays accepte le nom, le code ISO et l'indicatif.
- **Source** : Constaté : commits b4ce047, 3eb1cc5, 2e2da6b (recherche de pays multi-critères), c725290, 0ea97a7. CDC M1-01, M1-02
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ARR-02 : Changer de classe ou de programme depuis l'accueil

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté avec une classe choisie.
- **Étapes** :
  1. Dans l'en-tête de l'accueil, ouvrir le sélecteur de classe ou de programme.
  2. Choisir une autre classe.
  3. Ouvrir Réviser.
- **Résultat attendu** : Les cours, la mission du jour et les annales suivent la nouvelle classe sans repasser par l'arrivée.
- **Critère de validation** : Le sélecteur affiche classe.pays ou sigle.ville. Réviser ne montre que les matières de la classe choisie. Le statut (élève ou candidat) se change aussi depuis Moi.
- **Source** : Constaté : commits fc5076c (sélecteur d'en-tête), 0ea97a7, d68b19e (changer de statut depuis Moi)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ARR-03 : Assistant Bien démarrer

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte neuf.
- **Étapes** :
  1. Sur l'accueil, toucher Bien démarrer (sous la carte de mission du jour).
  2. Parcourir les étapes de l'assistant.
  3. Terminer ou fermer l'assistant.
- **Résultat attendu** : L'assistant propose les étapes de configuration (compte, personnalisation, notifications, téléchargement hors ligne) et défile entièrement.
- **Critère de validation** : Toutes les étapes sont atteignables, le contenu ne passe pas sous la barre de navigation, l'assistant se masque quand il est terminé.
- **Source** : Constaté : commits 18b024a, 54d1063, 6fad08d, 3c09e8b, b176dcc, c9584cf
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 7. Reprise d'une activité commencée mais non terminée

#### REP-01 : Reprise d'une leçon commencée

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté. Une leçon ouverte puis quittée sans valider.
- **Étapes** :
  1. Ouvrir une leçon, lire la moitié, revenir à l'accueil.
  2. Regarder la section Reprendre de l'accueil.
  3. Toucher la carte de la leçon.
- **Résultat attendu** : Une carte Reprendre propose la dernière leçon non validée, avec la matière et le chapitre.
- **Critère de validation** : La carte ouvre la même leçon. Une leçon déjà validée (quiz de leçon réussi) n'est plus proposée.
- **Source** : Constaté : services/reprise.ts (lireReprise : dernière leçon non lue), commits defa109, 5cedc1e, be25d92 (cartes Reprise conservées)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-02 : Reprise d'un quiz commencé

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir un quiz de chapitre, répondre à quelques questions, quitter sans terminer.
  2. Revenir à l'accueil, section Reprendre.
  3. Toucher la carte du quiz.
- **Résultat attendu** : Le quiz commencé est proposé tant que le meilleur score est inférieur à 80 pour cent.
- **Critère de validation** : Un quiz avec un meilleur score d'au moins 80 pour cent n'est plus proposé (QUIZ_FINI = 80). La carte ramène sur ce quiz.
- **Source** : Constaté : services/reprise.ts (QUIZ_FINI = 80, un par type au plus)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-03 : Reprise d'un exercice commencé

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir un exercice, ne pas le marquer comme fait, quitter.
  2. Revenir à l'accueil.
  3. Marquer l'exercice comme fait et revenir à l'accueil.
- **Résultat attendu** : L'exercice non terminé est proposé puis disparaît dès qu'il est marqué fait.
- **Critère de validation** : Quand on quitte ou passe au suivant, l'app demande avant de marquer l'exercice comme fait. Après confirmation, la carte Reprendre disparaît.
- **Source** : Constaté : services/reprise.ts (exercice non fait), commit fd14d13 (demande avant de marquer comme fait)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-04 : Reprise d'une lecture de document PDF à la dernière page

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec un document PDF ouvert.
- **Étapes** :
  1. Ouvrir un document, aller à la page 5, quitter.
  2. Rouvrir le même document.
- **Résultat attendu** : Le lecteur reprend à la dernière page lue.
- **Critère de validation** : La page 5 s'affiche. Le document reste disponible dans Mes documents.
- **Source** : Constaté : commit c482184 (reprise à la dernière page, Mes documents), b68c573, 2039447
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-05 : Reprise d'une mission du jour interrompue

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté. Mission du jour démarrée mais pas terminée.
- **Étapes** :
  1. Démarrer la mission du jour, répondre à quelques questions, fermer l'app.
  2. Rouvrir l'app et regarder l'accueil.
  3. Reprendre la mission.
- **Résultat attendu** : La mission reprend là où elle s'est arrêtée.
- **Critère de validation** : Les réponses déjà données sont conservées, la question suivante est proposée. Pas de nouveau tirage de questions.
- **Source** : Constaté : components/mission/Reprise.tsx et Accueil.tsx ; commits e997f4a, 36e77fe. Déduit : conservation exacte à vérifier à l'usage
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-06 : Sessions d'apprentissage synchronisées entre appareils

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Un compte connecté sur l'appareil A. Appareil B autorisé (voir les règles de l'appareil unique).
- **Étapes** :
  1. Sur A, étudier quelques minutes (leçon, quiz).
  2. Se connecter sur B avec le même compte.
  3. Ouvrir Moi, Ma progression, et la page de progression.
- **Résultat attendu** : Les sessions d'apprentissage et le temps étudié apparaissent aussi sur B.
- **Critère de validation** : Le temps cumulé et les types d'activité (cours, quiz, exercices, annales, missions) sont cohérents entre A et B. Table serveur activite_sessions alimentée.
- **Source** : Constaté : commits d56c6a9, 7a6ffa5, 0f17371 (app) ; migration 20261013060000 (activite_sessions). Livrés le 13 octobre, donc récents : tester avec soin
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### REP-07 : Reprise au point exact (question ou chapitre) sur un autre appareil

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec une activité commencée sur A.
- **Étapes** :
  1. Sur A, s'arrêter à la question 6 d'un quiz.
  2. Ouvrir le même compte sur B.
- **Résultat attendu** : Non garanti : seuls le temps et la liste des activités sont synchronisés, pas le point exact d'arrêt.
- **Critère de validation** : Noter ce que B propose. Écart possible avec CDC M6-05 (reprise pédagogique exacte). À déclarer comme limite connue si B ne reprend pas à la question 6.
- **Source** : Déduit : la table activite_sessions stocke jour, type, matière, titre, secondes ; aucun curseur de question. Reprise au point exact non constatée dans le code
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 8. Missions du jour

#### MIS-01 : Démarrer la mission du jour en un appui

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté ou invité avec classe choisie.
- **Étapes** :
  1. Sur l'accueil, toucher la carte de mission du jour.
  2. Jouer jusqu'à la fin.
- **Résultat attendu** : La mission démarre immédiatement, avec des questions liées à la classe choisie, à raison de 5 leçons de 2 à 3 questions.
- **Critère de validation** : Démarrage en 1 appui depuis l'accueil (CDC M4-01). Le titre de la carte tient sur deux lignes, les étiquettes de matière sur une ligne.
- **Source** : Constaté : commits e997f4a, 28d33be, 1f10d10. CDC M4-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### MIS-02 : Taille de la mission choisie par l'élève (5 à 50 questions)

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir la feuille de rythme de la mission.
  2. Régler la taille (de 5 à 50 questions, 15 à 30 recommandé) et l'onglet Temps (de 10 à 45 minutes).
  3. Lancer la mission.
- **Résultat attendu** : Le nombre réel de questions affiché correspond au réglage.
- **Critère de validation** : La mission contient le nombre de questions annoncé. Un réglage Temps est cohérent avec le nombre de questions.
- **Source** : Constaté : commits 36a7716, b0248ce, 6af6347, 11a0696, f02ea51 (feuille de rythme)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### MIS-03 : Fin de mission : score, corrections, erreurs

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Mission terminée.
- **Étapes** :
  1. Terminer une mission avec au moins une erreur.
  2. Lire l'écran de fin.
  3. Ouvrir la correction des erreurs puis Refaire mes erreurs.
- **Résultat attendu** : L'écran affiche « Score : n/total », la liste des questions en couleur, et propose de revoir les leçons ratées et de refaire les erreurs.
- **Critère de validation** : Pas de pluriel erroné (n/total). Refaire mes erreurs met à jour la session d'origine. Le score est visible immédiatement, y compris sans réseau pour une mission téléchargée.
- **Source** : Constaté : commits 2fdf2f7, e997f4a, 8989e25 (refaire les erreurs met à jour la session d'origine). CDC M4-03
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### MIS-04 : Série de jours avec jour de grâce

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Bac à sable
- **Pré-conditions** : Compte avec une série en cours. Utiliser la simulation de date du mode développeur.
- **Étapes** :
  1. Terminer une mission aujourd'hui.
  2. Sauter un jour (simulation), rouvrir l'app.
  3. Sauter un deuxième jour de suite.
- **Résultat attendu** : Un jour manqué est couvert par le jour de grâce. Deux jours manqués remettent la série à zéro.
- **Critère de validation** : La série n'est jamais faussée et le jour de grâce est expliqué à l'élève (CDC M4-02).
- **Source** : Constaté : commit 36e77fe (série avec jour de grâce), mission.ts. CDC M4-02. Déduit : la règle de deux jours manqués vient du CDC, à confirmer au test
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### MIS-05 : Mission terminée hors ligne puis renvoyée au retour du réseau

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Mission téléchargée (contenu valable 7 jours).
- **Étapes** :
  1. Couper le réseau (mode avion).
  2. Terminer la mission, constater le score.
  3. Rétablir le réseau et attendre la synchronisation.
- **Résultat attendu** : La mission se joue sans réseau et son résultat est envoyé au retour du réseau.
- **Critère de validation** : Aucune perte de résultat. La progression est lisible hors ligne et se retrouve sur le compte après synchronisation.
- **Source** : Constaté : commits 617f345, 30a8374, 5ef6bcf, 2439f6e (contenu borné à 7 jours). Recette validée par Benny le 6 octobre (#31). CDC M4-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 9. Cours et leçons

#### COU-01 : Parcourir matière, chapitre, leçon

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec classe choisie.
- **Étapes** :
  1. Ouvrir Réviser puis une matière.
  2. Ouvrir un chapitre puis une leçon.
  3. Lire la leçon jusqu'au bout.
- **Résultat attendu** : La matière affiche une icône, la liste des chapitres, les chapitres terminés descendent et sont marqués faits.
- **Critère de validation** : La leçon se lit sans erreur de rendu. Les formules sont dessinées par défaut. Les formules larges passent à la ligne aux relations ou aux signes plus et moins.
- **Source** : Constaté : commits 0afb92f, 2d3eada, 675fed3, de6ae2c (formules dessinées par défaut), 79bed2d
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### COU-02 : Résumé de chapitre et quiz de 3 questions par leçon

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir la feuille de résumé d'un chapitre.
  2. Faire le quiz de 3 questions de la leçon et le réussir.
- **Résultat attendu** : Une leçon est comptée comme faite seulement une fois ses questions réussies, et cela reste enregistré sur le compte.
- **Critère de validation** : La leçon passe à faite immédiatement après réussite. Elle reste faite après déconnexion puis reconnexion.
- **Source** : Constaté : commits 4c3d258, dad802d, 5cedc1e. CDC M5-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### COU-03 : Écran de fin de chapitre

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Dernière leçon d'un chapitre terminée.
- **Étapes** :
  1. Terminer la dernière leçon d'un chapitre.
  2. Rouvrir ensuite ce chapitre.
- **Résultat attendu** : L'écran de fin de chapitre s'affiche une seule fois par chapitre.
- **Critère de validation** : Le second passage ne réaffiche pas l'écran de fin. Les liens vers les exercices et quiz du chapitre fonctionnent.
- **Source** : Constaté : commits 8f275b7, dae375c, ef76180
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### COU-04 : Onglet Entraînement : tous, quiz, exercices

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir Réviser puis l'onglet Entraînement.
  2. Basculer entre Tous, Quiz, Exercices.
  3. Ouvrir un exercice et basculer entre énoncé et corrigé.
- **Résultat attendu** : Les trois onglets filtrent la liste. Un exercice affiche son contexte replié, son énoncé et un corrigé caché.
- **Critère de validation** : Les cartes ont la même hauteur. Les quiz sont numérotés dans un chapitre. Le contexte d'un exercice est replié par défaut.
- **Source** : Constaté : commits a30e5a5, a2c59ff, 63bc17a, 7b5fb89, 8572417
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 10. Quiz : fin de quiz, erreurs, correction

#### QUI-01 : Fin de quiz : résultat toujours affiché

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Faire un quiz de chapitre jusqu'à la dernière question.
  2. Valider la dernière réponse.
- **Résultat attendu** : L'écran de résultats s'affiche (grille de questions colorée) et jamais une page blanche.
- **Critère de validation** : Score visible, grille colorée correcte (vert juste, rouge faux), message de résultat, boutons Revoir la correction et Refaire mes erreurs présents. Correctif de l'incident #55.
- **Source** : Constaté : commits ea2a26c (fin de quiz toujours affichée), bc7c2ed (fin de quiz commune) ; PRIORITES (#55 corrigé le 7 octobre)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### QUI-02 : Revoir mes erreurs (Refaire mes erreurs)

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Quiz terminé avec au moins 2 erreurs.
- **Étapes** :
  1. Sur l'écran de résultats, toucher Refaire mes erreurs.
  2. Répondre correctement aux questions ratées.
  3. Revenir sur le résultat du quiz d'origine.
- **Résultat attendu** : Seules les questions ratées sont reposées, et les réponses corrigées mettent à jour la session d'origine.
- **Critère de validation** : Au moins une question affichée par erreur initiale. Le score de la session d'origine augmente. Benny a confirmé que Refaire mes erreurs fonctionne (7 octobre).
- **Source** : Constaté : commits ea2a26c, 8989e25 (mise à jour de la session d'origine), 0cb8d93 ; PRIORITES (confirmé par Benny)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### QUI-03 : Revoir la correction (réponses et justifications)

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Quiz terminé.
- **Étapes** :
  1. Sur l'écran de résultats, toucher Revoir la correction.
  2. Parcourir les questions, ouvrir une justification.
- **Résultat attendu** : La correction n'est pas vide : chaque question montre la réponse choisie, la bonne réponse et le bouton de justification.
- **Critère de validation** : Pas d'écran vide. L'ouverture d'une justification débite 1 crédit hors pass, ou 0 si déjà ouverte. Correctif de l'incident #56.
- **Source** : Constaté : commit ea2a26c ; PRIORITES (#56 corrigé, 7 octobre) ; écran quiz/correction.tsx
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### QUI-04 : Mise en page de la question : bouton et message groupés

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Quiz en cours.
- **Étapes** :
  1. Répondre à une question.
  2. Observer le pied de page collé en bas.
- **Résultat attendu** : Le message de résultat, le bouton de justification et le bouton Suivant restent groupés dans le pied de page fixe.
- **Critère de validation** : Pas de chevauchement avec la barre système. Coche ou croix à gauche dans un cadre rempli.
- **Source** : Constaté : commits ebb8c3b, 7d2e213, bc7c2ed
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 11. Annales et chronomètre

#### ANN-01 : Catalogue des annales par classe et par concours

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté, parcours secondaire puis parcours concours.
- **Étapes** :
  1. Ouvrir Réviser puis Annales.
  2. En parcours secondaire : voir les dossiers de classes.
  3. En parcours concours : voir directement les sujets du concours choisi.
- **Résultat attendu** : Les dossiers sont organisés par classe et par concours. Un candidat avec un concours choisi voit ses sujets sans les autres concours.
- **Critère de validation** : Un dossier par concours, aucun sujet d'un autre concours dans le parcours du candidat. La recherche et les filtres répondent vite.
- **Source** : Constaté : commits 9bc7525 (dossiers de classes et un dossier par concours), 539787f, 61a6cce, 0096f45. CDC M6-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ANN-02 : Lecteur PDF intégré, copie hors ligne

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec un sujet d'annale disponible.
- **Étapes** :
  1. Ouvrir un sujet : il s'ouvre dans l'app, pas dans le navigateur.
  2. Couper le réseau puis rouvrir le même sujet.
- **Résultat attendu** : Le PDF s'ouvre dans l'app et reste lisible hors ligne après un premier chargement.
- **Critère de validation** : Aucun passage par le navigateur. Les noms avec espaces et accents sont lisibles. La dernière page ne reste pas blanche.
- **Source** : Constaté : commits 6c912ea, 1addee9, b68c573
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ANN-03 : Un sujet complet gratuit par concours, correction détaillée payante

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte sans pass avec 10 crédits.
- **Étapes** :
  1. Ouvrir le premier sujet d'un concours (gratuit).
  2. Ouvrir la correction détaillée d'un sujet.
  3. Ouvrir la correction d'un autre sujet.
- **Résultat attendu** : Le premier sujet est gratuit. La correction détaillée coûte 5 crédits sauf avec un pass.
- **Critère de validation** : Débits conformes à CRE-10. Avec un pass, aucun débit.
- **Source** : Constaté : migration 20261001193000 (exam_correction), commit 539787f. CDC M6-02, M6-04
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ANN-04 : Chronomètre des annales : onboarding et déroulement

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Lancer un sujet d'annale en mode chronométré pour la première fois.
  2. Lire l'onboarding des annales.
  3. Mettre l'app en arrière-plan 1 minute puis revenir.
- **Résultat attendu** : Un onboarding explique le chrono. Le chronomètre continue d'avancer quand l'app passe en arrière-plan.
- **Critère de validation** : Le temps affiché au retour tient compte du temps passé en arrière-plan (CDC M6-03). Le temps est enregistré dans la progression.
- **Source** : Constaté : commits b295c65 (onboarding annales), 4ace4b0 (chronos éducatifs). CDC M6-03. Déduit : continuité en arrière-plan à constater
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ANN-05 : Temps d'apprentissage cumulé et onglet progression globale

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec plusieurs activités faites sur plusieurs jours.
- **Étapes** :
  1. Ouvrir Moi puis Ma progression.
  2. Ouvrir l'onglet de progression globale.
  3. Comparer le temps affiché avec le temps réellement passé.
- **Résultat attendu** : Le temps cumulé, les graphiques segmentés par type d'activité et par matière s'affichent. La carte Ma progression compte cours, quiz, exercices et annales.
- **Critère de validation** : Totaux cohérents avec le temps réel à quelques minutes près. Pas de chrono qui continue seul écran fermé.
- **Source** : Constaté : commits 4ace4b0, b295c65, 7a6ffa5, 0f17371
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### ANN-06 : Classement des candidats d'un même concours

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Sans objet : fonctionnalité non trouvée.
- **Étapes** :
  1. Chercher un classement des candidats aux annales.
- **Résultat attendu** : Non testable : l'issue #16 a été fermée sans code ni migration (PRIORITES, 13 octobre).
- **Critère de validation** : À rouvrir si Benny décide de livrer M6-06.
- **Source** : Constaté : PRIORITES.md (À trancher, point 1). CDC M6-06 (priorité C)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 12. Question à l'IA et photo

#### PHO-01 : Prendre une photo d'exercice et obtenir la correction pas à pas

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté avec au moins 5 crédits ou un pass. Permission caméra accordée.
- **Étapes** :
  1. Toucher le bouton photo central de la barre d'onglets.
  2. Prendre en photo un exercice lisible et recadrer.
  3. Envoyer et attendre la correction.
- **Résultat attendu** : Des étapes d'analyse animées s'affichent puis la correction pas à pas : énoncé, méthode, étapes, résultat, à retenir.
- **Critère de validation** : La réponse arrive en moins de 25 s en bon réseau (cible CDC M3-02, mesure officielle toujours ouverte : issue #14). Les formules s'affichent. Une ligne de dépense de 5 crédits apparaît (sauf pass).
- **Source** : Constaté : commits dd45de5, 625e4c3, 25555ea ; migration 20261001191000 (ai_question = 5). CDC M3-01, M3-02
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-02 : Photo illisible ou échec de l'IA : remboursement automatique

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec 10 crédits.
- **Étapes** :
  1. Envoyer une photo noire ou illisible.
  2. Observer le résultat et le solde.
- **Résultat attendu** : L'app indique que la photo n'est pas lisible et les crédits sont rendus.
- **Critère de validation** : Solde identique à celui d'avant l'envoi après quelques secondes. Une ligne de remboursement est visible dans l'historique. Même résultat si la correction reste en attente plus de 5 minutes (échec automatique à l'envoi suivant).
- **Source** : Constaté : migration 20261001191000 (finish_photo_correction rend les crédits sur unreadable ou failed ; start_photo_correction rend les réservations de plus de 5 minutes). La notification de remboursement dépend de la migration 20261007150000, jamais déployée (PRIORITES) : l'absence de notification est attendue
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-03 : Crédits insuffisants pour une photo

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec moins de 5 crédits, sans pass.
- **Étapes** :
  1. Envoyer une photo.
- **Résultat attendu** : La feuille Crédits épuisés s'ouvre et rien n'est envoyé.
- **Critère de validation** : Aucun débit, aucune correction lancée. Les choix Recharger, Gagner des crédits, Plus tard fonctionnent.
- **Source** : Constaté : migration 20261001191000 (exception 'credits'), commit a49be45
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-04 : Compteur de quota IA sur l'écran Photo

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté, avec puis sans pass.
- **Étapes** :
  1. Ouvrir l'écran Photo sans pass : lire le compteur.
  2. Envoyer une photo : relire le compteur.
  3. Avec un pass : relire le compteur.
- **Résultat attendu** : Sans pass : nombre de photos possibles aujourd'hui = utilisées + solde divisé par 5. Avec pass : limite du jour (30 par défaut).
- **Critère de validation** : Le compteur baisse après chaque envoi. Avec un pass, il affiche la limite journalière et non un solde de crédits. Écart avec le CDC à noter : CDC M3-03 prévoit 3 corrections gratuites par jour, le code facture 5 crédits par photo depuis la migration 20261001191000.
- **Source** : Constaté : migrations 20261001191000 (photo_quota, remplace le quota de 3 par jour), 20261012050000 (my_ai_quota_today), commit 1399cb2
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-05 : Historique des corrections photo et notification de correction prête

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec une correction photo en cours.
- **Étapes** :
  1. Envoyer une photo puis quitter l'écran.
  2. Attendre la notification de correction prête.
  3. Toucher la notification.
- **Résultat attendu** : Le toucher ouvre directement la correction concernée, sinon l'historique.
- **Critère de validation** : Notification reçue (push ou rappel local). L'historique affiche les photos via des liens signés.
- **Source** : Constaté : commits 25555ea, 3ed390c, 84a7cf7, ce22b54
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-06 : Signaler une erreur dans une correction

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Une correction photo affichée.
- **Étapes** :
  1. Toucher Signaler une erreur.
  2. Valider le signalement.
- **Résultat attendu** : Le signalement est enregistré avec l'image et la réponse (CDC M3-04).
- **Critère de validation** : Message de remerciement. Le signalement est visible côté équipe (à vérifier dans la base).
- **Source** : Constaté : commit dd45de5 (signalement). Déduit : aucun écran de traitement côté équipe n'est livré (CDC M12-05)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-07 : Questions du fil : poser, répondre, voter, signaler

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir l'onglet Questions et poser une question avec une photo.
  2. Répondre à une question d'un autre compte.
  3. Voter pour une réponse, signaler une réponse.
- **Résultat attendu** : Le fil affiche la question, les réponses, les votes, une meilleure réponse mise en avant.
- **Critère de validation** : Les numéros de téléphone écrits dans un texte sont masqués côté client. Un contenu signalé est masqué avec un message de remerciement. Une photo peut être agrandie.
- **Source** : Constaté : commits f127b29, 5cfffb9, fcceb52, b2d6243, 954efe8. CDC M7-01, M7-04, M7-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PHO-08 : Question à l'IA avec pass : limite du jour atteinte

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte avec un pass actif en bac à sable. Limite du jour réduite par Benny pour le test si possible.
- **Étapes** :
  1. Envoyer des photos jusqu'à la limite du jour du pass (30 par défaut).
  2. Tenter une photo de plus.
- **Résultat attendu** : Un message clair indique que la limite du jour est atteinte, retour possible le lendemain.
- **Critère de validation** : Aucune fenêtre bloquante agressive. Aucun débit de crédits. L'erreur côté serveur est 'quota'.
- **Source** : Constaté : migration 20261001191000 (exception 'quota'). CDC M3-03
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 13. Mode hors ligne

#### OFF-01 : Indicateur hors ligne et basculement immédiat

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : App ouverte avec réseau.
- **Étapes** :
  1. Activer le mode avion.
  2. Observer la pastille et la barre système.
  3. Rétablir le réseau.
- **Résultat attendu** : Une pastille discrète et une barre système orange ou corail apparaissent instantanément, puis disparaissent au retour du réseau.
- **Critère de validation** : Détection instantanée de la perte de réseau (module natif). Pas de blocage de l'affichage de la progression.
- **Source** : Constaté : commits 7a11aba, 3d69c21, c57607c, c47fe81, 30a8374 (#25 et #13 validées)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### OFF-02 : Téléchargement de contenu et lecture sans réseau

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté avec réseau.
- **Étapes** :
  1. Ouvrir hors-ligne et choisir les matières à télécharger (estimation affichée).
  2. Télécharger, couper le réseau.
  3. Lire une leçon et jouer un quiz du contenu téléchargé.
- **Résultat attendu** : Le contenu téléchargé se lit sans réseau. Le niveau d'une matière non téléchargée est indiqué comme indisponible hors ligne.
- **Critère de validation** : Contenu valable 7 jours. Tout supprimer ne supprime pas les documents préchargés. Un contenu expiré affiche un message clair et reste bloqué.
- **Source** : Constaté : commits f7245ff, 5ef6bcf, 1034888, f57a13b, 1d47c2c ; PRIORITES (hors ligne complet validé)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### OFF-03 : Dépense de crédits hors ligne et rejeu au retour du réseau

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Contenu payant déjà présent sur l'appareil. Solde suffisant.
- **Étapes** :
  1. Couper le réseau.
  2. Ouvrir une justification déjà téléchargée.
  3. Rétablir le réseau et regarder le solde.
- **Résultat attendu** : La dépense est enregistrée localement puis envoyée une seule fois au retour du réseau.
- **Critère de validation** : Un seul débit, jamais deux (idempotence). Décision de Benny du 7 octobre : aucun contenu payant en crédits ne se consomme hors ligne s'il n'est pas déjà présent.
- **Source** : Constaté : commits 383c2f1, 3c37dbf ; migration 20261005233000 ; PRIORITES (#33 fermée sur décision)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### OFF-04 : Limite de débit serveur (erreur 429) lisible

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Mode développeur activé. Simulation de limite de débit disponible.
- **Étapes** :
  1. Activer la simulation de 429 dans les paramètres développeur.
  2. Lancer une action touchée par la limite (paiement, ouverture payante).
- **Résultat attendu** : Un message clair explique qu'il faut patienter, sans écran d'erreur brut.
- **Critère de validation** : Le message invite à réessayer plus tard. La simulation se coupe proprement.
- **Source** : Constaté : commits 1b48a32, 82d5f5e ; migration 20261011120000 (rate limiting)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 14. Pass et paiement

#### PAS-01 : Écran des offres

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté (un invité doit d'abord créer un compte avant de payer).
- **Étapes** :
  1. Ouvrir Offres depuis Moi, la feuille Crédits épuisés ou l'accueil.
  2. Lire les offres (gratuit et pass) et les prix.
- **Résultat attendu** : Les offres s'affichent avec les prix dans la devise du pays choisi, converties depuis le prix Cameroun.
- **Critère de validation** : Un prix existe pour chaque pays. Le gratuit affiche « 0 FCFA ». La remise de 33 pour cent s'affiche en pastille de coin sur la ligne du pass concerné, avec le prix. Texte du pass concours : 6 mois d'accès.
- **Source** : Constaté : commits 2a80d63, da0b747, 50cf767, d453186, 4330405, f29a206, 51ff743. CDC M8-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-02 : Invité : compte exigé avant le paiement

- **Rôle** : Invité · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Invité sans compte.
- **Étapes** :
  1. Aller aux offres et choisir un pass.
- **Résultat attendu** : Une feuille demande de créer un compte avant de payer.
- **Critère de validation** : Aucun paiement ne démarre sans compte. Rappel invité clair, jamais culpabilisant.
- **Source** : Constaté : commit abf9605 (compte exigé avant de payer, rappel d'invité)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-03 : Paiement Mobile Money en bac à sable (parcours complet)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte de test. Jeton pawaPay de bac à sable seulement. Numéros de test pawaPay, jamais un vrai numéro ni un vrai paiement. Bannière « mode test » visible en bas du paiement.
- **Étapes** :
  1. Choisir un pass, choisir le pays et l'opérateur.
  2. Saisir un numéro de test pawaPay valide pour le pays.
  3. Lancer le paiement et suivre le compte à rebours.
  4. Attendre la confirmation.
- **Résultat attendu** : Un écran d'attente avec étapes et compte à rebours s'affiche, puis un écran de reçu. Le pass est activé et une notification Paiement confirmé arrive.
- **Critère de validation** : Statut changé uniquement par le serveur après le rappel pawaPay (CDC M8-03). Pass actif avec sa date de fin, reçu dans Paiements. Validé en bac à sable par Benny le 7 octobre pour le lien parent ; le parcours complet depuis l'app (issue #35) reste à confirmer.
- **Source** : Constaté : commits b5ad54f, 214ae03, d42ec97, 495857d, b576b5e ; migration 20261002000000 ; edge functions payment-start et payment-status ; PRIORITES (#35 à confirmer)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-04 : Paiement réel pawaPay en production

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Interdit en production
- **Pré-conditions** : Aucun jeton de production activé. À ne pas lancer.
- **Étapes** :
  1. Ne pas exécuter. Réservé à Benny, après décision (issue elearn-supabase #106).
- **Résultat attendu** : Sans objet.
- **Critère de validation** : Hors périmètre de cette recette. Voir la section « Tests à ne pas faire en production ».
- **Source** : Constaté : PRIORITES (P0 : premier paiement réel, elearn-supabase #106)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-05 : Numéro de téléphone : mise en forme et vérification selon le pays

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Écran de paiement ouvert.
- **Étapes** :
  1. Choisir un pays dans la feuille de recherche (par nom, code ISO ou indicatif).
  2. Saisir un numéro trop court, puis un numéro valide.
  3. Corriger l'indicatif.
- **Résultat attendu** : Le numéro est mis en forme selon le pays, le curseur ne saute pas, une erreur secoue le champ.
- **Critère de validation** : Un exemple de numéro par pays est affiché. Le préfixe reste aligné même en cas d'erreur. Le défilement automatique ramène sur le champ du numéro.
- **Source** : Constaté : commits d42ec97, 981cdbd, 4330405, eda3652, 022d466, 4730e91
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-06 : Écran jamais bloqué quand pawaPay ne répond pas

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Réseau instable ou pawaPay simulé indisponible par Benny.
- **Étapes** :
  1. Ouvrir l'écran de paiement avec la liste des pays qui échoue.
  2. Réessayer.
- **Résultat attendu** : L'écran affiche un message clair et la liste de pays par défaut ; il n'est jamais bloqué.
- **Critère de validation** : Possibilité de revenir en arrière et de réessayer. Liste exhaustive des pays avec drapeaux.
- **Source** : Constaté : commit b576b5e
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-07 : Paiement en attente : reprise automatique et expiration

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Un paiement de bac à sable lancé et pas encore confirmé.
- **Étapes** :
  1. Fermer l'app pendant l'attente.
  2. Rouvrir l'app.
  3. Ne pas confirmer sur le téléphone de test jusqu'à l'expiration.
- **Résultat attendu** : L'app reprend le paiement en attente. Un paiement non confirmé expire.
- **Critère de validation** : Un paiement en attente ne bloque pas l'utilisateur (CDC M8-05). Le statut final est affiché (expiré) ; le délai de 10 minutes du CDC est à comparer à la durée réellement observée.
- **Source** : Constaté : commit 4a7c548 (reprise automatique, issue #8), services/reprisePaiement.ts. CDC M8-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-08 : Paiement échoué : raisons lisibles

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Numéro de test pawaPay qui simule un échec (solde insuffisant, refus).
- **Étapes** :
  1. Lancer un paiement avec un numéro de test d'échec.
- **Résultat attendu** : Le motif de l'échec est expliqué clairement et on peut réessayer.
- **Critère de validation** : Les raisons d'échec sont lisibles (écran E5). Aucun pass activé.
- **Source** : Constaté : commit 214ae03 (raisons d'échec). CDC M8-05
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-09 : Retour dans l'app après un paiement

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Paiement de bac à sable terminé via le navigateur ou une autre app.
- **Étapes** :
  1. Terminer le paiement puis revenir à l'app.
- **Résultat attendu** : L'app reconnaît le retour et affiche le reçu.
- **Critère de validation** : Pas d'écran bloqué sur l'attente. La page retour (offres/retour) s'affiche.
- **Source** : Constaté : commit 495857d ; écran offres/retour.tsx
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-10 : Historique des paiements et détail

- **Rôle** : Utilisateur · **Plateforme** : Toutes · **Environnement** : Production possible
- **Pré-conditions** : Compte avec au moins un paiement (bac à sable).
- **Étapes** :
  1. Ouvrir Paiements depuis Moi.
  2. Ouvrir le détail d'un paiement.
- **Résultat attendu** : La liste des paiements et un détail avec référence, date, produit, statut s'affichent.
- **Critère de validation** : Historique cohérent avec le back-office. Le détail se rouvre depuis une notification de paiement.
- **Source** : Constaté : commit 32aa9c4 (historique et détail), 9e34caa (la notification ouvre le détail du paiement)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-11 : Carte bancaire (Chariow) pour les pays sans Mobile Money

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Pays sans Mobile Money, compte de test, mode test Chariow.
- **Étapes** :
  1. Choisir un pays sans Mobile Money.
  2. Constater le prix Chariow et l'absence d'étape opérateur.
  3. Lancer le paiement en mode test si disponible.
- **Résultat attendu** : Le prix affiché est le prix Chariow (minimum plateforme de 600) et le paiement se fait par carte sur la page Chariow.
- **Critère de validation** : Étape opérateur masquée. Le retrait d'une licence Chariow retire l'accès et rembourse la commande. L'abandon d'un paiement sort la commande de l'attente.
- **Source** : Constaté : commits a4db36e, 6932c21 ; migrations 20261009150000, 20261009160000, 20261010150001 ; edge functions chariow-checkout, chariow-webhook. À ne pas lancer en réel
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-12 : iOS : aucun prix Mobile Money, achat intégré Apple

- **Rôle** : Utilisateur · **Plateforme** : iOS · **Environnement** : Bac à sable
- **Pré-conditions** : iPhone avec le build 17 sur TestFlight ou une simulation iOS en mode développeur.
- **Étapes** :
  1. Ouvrir les offres sur iOS.
  2. Lancer un achat intégré en bac à sable Apple.
- **Résultat attendu** : Pas de Mobile Money ni de prix local sur iOS, le pass se prend par achat intégré Apple (RevenueCat).
- **Critère de validation** : Aucune référence à pawaPay ou à un paiement externe sur iOS (règle de l'App Store). Le webhook RevenueCat active le droit de source Apple.
- **Source** : Constaté : commits f00dfaa, 6ef4fe2, 5414ac0, 7911d59 ; migration 20261009140000 (achats_apple_revenuecat). Test sur appareil réel reste à faire (#6, #18)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PAS-13 : Fin de pass : alertes J-3 et J-1 et expiration

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte avec un pass dont la fin approche (simulation de date par Benny).
- **Étapes** :
  1. Attendre ou simuler J-3 puis J-1.
  2. Observer la notification.
  3. Après la fin du pass, ouvrir un contenu payant.
- **Résultat attendu** : Notifications « Ton Pass expire dans 3 jours » puis « demain », puis retour au régime des crédits.
- **Critère de validation** : Les alertes sont envoyées par la tâche quotidienne de 7 h UTC. Après expiration, les contenus payants redemandent des crédits.
- **Source** : Constaté : migration 20261007100000 (pass_expiry_alerts_run, cron '0 7 * * *'). CDC M8-08
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 15. Codes promo

#### PRO-01 : Appliquer un code promo valide sur l'écran de paiement

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Un code promo de test créé par SQL par Benny (pas de back-office pour l'instant : issue elearn #28).
- **Étapes** :
  1. Sur la liste des pass, saisir le code.
  2. Observer les prix recalculés pour chaque pass.
  3. Lancer un paiement de bac à sable.
- **Résultat attendu** : Les prix de chaque pass sont recalculés avec la remise et la commande est enregistrée au prix remisé.
- **Critère de validation** : Le serveur recalcule le prix, l'app n'envoie jamais un montant. La commande conserve le code et le prix de départ.
- **Source** : Constaté : migrations 20261007120000, 20261007140000 (promo_offers), commit f993729. Testé par Benny le 7 octobre (#7). CDC M8-07
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRO-02 : Code promo refusé : motifs lisibles

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Codes de test : inconnu, désactivé, expiré, épuisé, valable pour une autre offre.
- **Étapes** :
  1. Saisir successivement chaque code invalide.
- **Résultat attendu** : Un message clair explique le motif du refus.
- **Critère de validation** : Motifs distincts : inconnu, inactif, expiré, épuisé, offre non concernée, limite, compte requis. Aucun message technique.
- **Source** : Constaté : migration 20261007120000 (motifs P0004), back-office commit 4522865 (textes de refus)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRO-03 : Limite de recherche de codes au hasard

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte de test.
- **Étapes** :
  1. Saisir 5 codes invalides en moins d'une minute, puis un sixième.
- **Résultat attendu** : Au-delà de 5 refus en 1 minute, l'app freine les essais.
- **Critère de validation** : Le message invite à patienter. Après une minute, un code valide est de nouveau accepté.
- **Source** : Constaté : migration 20261007120000 (promo_attempts, 5 refus en 1 minute)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRO-04 : Code promo à 100 pour cent : pass gratuit sans Mobile Money

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Code promo de test à 100 pour cent.
- **Étapes** :
  1. Appliquer le code et valider.
- **Résultat attendu** : Le pass s'active tout de suite, sans choisir d'opérateur ni de numéro.
- **Critère de validation** : Commande à 0 marquée gratuite, pass actif, utilisation du code comptée une fois.
- **Source** : Constaté : migration 20261007120000 (prix final 0 = pass immédiat), back-office commit 4522865
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRO-05 : Compteur d'utilisations et plafond d'un code

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Code de test avec un plafond de 1 utilisation.
- **Étapes** :
  1. Payer une première fois avec le code (bac à sable).
  2. Essayer avec un second compte.
- **Résultat attendu** : Le second essai est refusé : code épuisé.
- **Critère de validation** : Le compteur monte au premier passage de la commande à « payée ». Le suivi des ventes d'un influenceur n'a pas de page dédiée (CDC M8-07).
- **Source** : Constaté : migration 20261007120000 (used_count). Déduit : pas de back-office des codes (elearn #28 ouvert)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 16. Lien parent (demander à quelqu'un de payer) et reçu

#### LPA-01 : Élève : créer et partager le lien « Demander à quelqu'un de payer »

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Compte connecté. Aucun message réel ne doit être envoyé : choisir Copier le lien plutôt que d'envoyer à une vraie personne.
- **Étapes** :
  1. Aller aux offres et choisir Demander à quelqu'un de payer (envoyer à mon parent).
  2. Choisir un pass et générer le lien.
  3. Copier le lien.
- **Résultat attendu** : Un lien https://elearnprepa.com/p/<jeton> est généré.
- **Critère de validation** : Le lien ne contient que le jeton. Il ouvre la page de paiement du parent (voir LPA-02). Texte du partage prêt pour WhatsApp.
- **Source** : Constaté : commits f612911, 2a80d63 (E6), migration 20261003100000 ; site /p/[jeton] qui rend /payer/[jeton]. CDC M8-06
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-02 : Parent : page de paiement sans compte

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Un lien parent de bac à sable valide. Téléphone ou ordinateur sans l'app.
- **Étapes** :
  1. Ouvrir le lien.
  2. Vérifier le nom de l'élève, l'offre, le prix.
  3. Choisir le pays, saisir un numéro de test, payer.
- **Résultat attendu** : La page affiche le nom de l'élève, l'offre et le prix, sans compte requis. Après paiement, une page de remerciement s'affiche.
- **Critère de validation** : Le prénom, l'offre et le prix ne sont pas modifiables par le payeur. L'accès est débloqué chez l'élève après paiement (cible CDC : moins d'une minute).
- **Source** : Constaté : elearn-site commits ef00de2 (la page lit enfin le statut), b78d6bb, 38fa17a ; edge functions payment-link-pay et payment-link-status. Validé par Benny en bac à sable le 7 octobre. CDC M8-06
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-03 : Parent : pays complets, drapeaux, indicatif, mise en forme du numéro

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Lien parent de bac à sable.
- **Étapes** :
  1. Ouvrir la feuille des pays sur téléphone.
  2. Chercher un pays, saisir un numéro.
  3. Basculer sur un pays sans Mobile Money.
- **Résultat attendu** : La feuille des pays occupe toute la hauteur visible et ne passe pas sous la barre d'état. Pour un pays sans Mobile Money, l'étape opérateur est masquée et le paiement en ligne est proposé.
- **Critère de validation** : Numéro mis en forme selon le pays. Le champ WhatsApp du parent a son indicatif.
- **Source** : Constaté : elearn-site commits 3c94f10, 98c3188, 38fa17a, b21f4a6, 34282da, 241a1d4
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-04 : Parent : lien expiré ou déjà payé

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Un lien expiré et un lien déjà payé (fournis par Benny).
- **Étapes** :
  1. Ouvrir chaque lien.
- **Résultat attendu** : Un message clair indique que le lien est expiré ou déjà utilisé, sans donnée sensible.
- **Critère de validation** : Aucun bouton de paiement actif. Cas non couvert par un test automatisé d'après PRIORITES : à observer avec soin. Durée du lien selon CDC : 48 heures (durée réelle à confirmer).
- **Source** : Constaté : payment-link-pay (refuse si le statut n'est pas open ou si la date est dépassée). PRIORITES (lien expiré non couvert). CDC M8-11
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-05 : Parent : limite de cinq échecs par heure

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Lien parent de bac à sable, numéros de test d'échec.
- **Étapes** :
  1. Échouer volontairement 5 fois de suite (numéros de test d'échec).
  2. Essayer une sixième fois.
- **Résultat attendu** : Au-delà de 5 échecs dans l'heure, le serveur refuse avec le code « trop ».
- **Critère de validation** : Message de patience clair. Cas non couvert par un test automatisé d'après PRIORITES.
- **Source** : Constaté : codes de retour de payment-link-pay (trop) ; PRIORITES (limite de cinq échecs par heure non testée). Le chiffre cinq vient de PRIORITES, non relu dans le code
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-06 : Consentement au résumé hebdomadaire sur la page de paiement

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Lien parent de bac à sable.
- **Étapes** :
  1. Lire la case de consentement au résumé WhatsApp (texte de consentement).
  2. Payer avec la case cochée, puis refaire avec un autre lien case décochée.
- **Résultat attendu** : Le consentement est enregistré avec la date seulement si la case est cochée.
- **Critère de validation** : Un contact parent est créé avec le numéro WhatsApp saisi, un consentement daté et la version du texte. Décoché : aucun contact créé.
- **Source** : Constaté : commits 13476d6, 58d126f ; migration 20261007200000 (parent_consent_texts, parent_contacts) ; payment-link-pay (weekly_summary_consent). CDC M8-12
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-07 : Reçu immédiat dans l'app et en PDF

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Un paiement de bac à sable réussi.
- **Étapes** :
  1. Ouvrir le détail du paiement.
  2. Ouvrir la facture (lien /facture/<jeton>).
- **Résultat attendu** : Un reçu est visible dans l'historique et une facture PDF au style de la marque s'ouvre.
- **Critère de validation** : Le reçu est disponible moins d'une minute après confirmation. La facture contient la référence, le produit, le montant et la devise.
- **Source** : Constaté : migration 20261010150000 (facture_pdf), elearn-site commit 941a243 (/facture/<jeton>). CDC M8-04
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LPA-08 : Reçu WhatsApp envoyé au parent (mode fictif)

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Environnement avec WHATSAPP_MODE=fictif. Consentement parent déjà donné.
- **Étapes** :
  1. Payer un lien parent de bac à sable.
  2. Lire le journal de la fonction parent-message-send (rien ne part réellement).
- **Résultat attendu** : Un message recu_paiement est mis en file puis journalisé avec la mention fictif.
- **Critère de validation** : Aucun envoi réel. Le journal montre le modèle recu_paiement et un numéro masqué à trois chiffres.
- **Source** : Constaté : commits 649433a, 52de595 ; migration 20261007210000 ; whatsapp.ts (mode fictif). Voir la section WhatsApp
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 17. Notifications

#### NOT-01 : Permission non demandée au démarrage, feuille de proposition après une première activité

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : App neuve, notifications non autorisées.
- **Étapes** :
  1. Lancer l'app : aucune demande de permission.
  2. Terminer une première mission, un quiz ou un chapitre.
  3. Lire la feuille qui propose les notifications.
- **Résultat attendu** : Une feuille claire (« ce sont des notifications ») propose d'activer les rappels après la première activité.
- **Critère de validation** : Pas de demande système avant la feuille. Titre anglais distinct du bouton. Refuser ne bloque rien.
- **Source** : Constaté : commits 5819eeb, 7a70408, ef56bb4. CDC M9-01
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### NOT-02 : Cloche, centre et réglages de notifications

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec quelques notifications.
- **Étapes** :
  1. Toucher la cloche de l'accueil.
  2. Ouvrir une notification, la marquer lue.
  3. Relancer l'app.
  4. Ouvrir Paramètres, Notifications.
- **Résultat attendu** : Le centre liste les notifications, l'état lu est conservé après relance, les réglages permettent d'activer ou couper par catégorie.
- **Critère de validation** : Lu conservé après relance. Interrupteur explicite des notifications push. Validé par Benny sur téléphone le 7 octobre (#32).
- **Source** : Constaté : commits 1223cdd, 9e34caa, e659f5c ; PRIORITES (#32 fermée). CDC M9-03
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### NOT-03 : Routage : une notification ouvre le bon écran

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Notifications de plusieurs types disponibles : correction prête, paiement, crédits, sondage révélé, réponse à ta question, bienvenue.
- **Étapes** :
  1. Toucher chaque notification depuis le centre, puis depuis le système (app fermée).
  2. Observer l'écran ouvert.
- **Résultat attendu** : Correction prête ouvre la correction, paiement ouvre son détail, autres types ouvrent leur écran dédié.
- **Critère de validation** : Toucher une notification ne tombe jamais sur un écran vide ni sur l'accueil par défaut sauf type inconnu.
- **Source** : Constaté : commits ce22b54, 9e34caa, b3b9df0, 73cd2f6, c4367e7 ; PRIORITES (#34 : routage fait dans l'app)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### NOT-04 : Notifications serveur dépendant de la migration non déployée

- **Rôle** : Support client · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Comptes de test. Migration 20261007150000_notifs_credits_photo toujours non déployée (PRIORITES).
- **Étapes** :
  1. Faire baisser le solde presque à zéro, provoquer un remboursement photo et obtenir un sondage révélé.
  2. Chercher les notifications correspondantes.
- **Résultat attendu** : Attendu pour l'instant : aucune notification serveur pour crédits presque épuisés, remboursement photo, sondage révélé tant que la migration n'est pas déployée.
- **Critère de validation** : À rejouer après le déploiement de la migration (issue #34, P1). Le routage dans l'app est prêt.
- **Source** : Constaté : PRIORITES (« n'a jamais été déployée », branche supprimée au ménage)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### NOT-05 : Page Ma semaine et résumé du lundi

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte avec de l'activité sur la semaine précédente.
- **Étapes** :
  1. Ouvrir Ma semaine depuis la notification du lundi ou depuis le menu.
  2. Lire le résumé de la semaine (missions, leçons, quiz, exercices).
- **Résultat attendu** : La page présente le bilan de la semaine, avec les dates des exercices, et s'ouvre automatiquement depuis la notification.
- **Critère de validation** : Chiffres cohérents avec l'activité réelle. Plus d'air en haut et en bas de la page.
- **Source** : Constaté : commits 39d257f, 25bc26f, 174c07b ; migrations 20261007101000, 20261007102000 (résumé hebdomadaire enrichi)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### NOT-06 : Rappel quotidien : réglage de l'heure et une seule notification par jour

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Notifications activées.
- **Étapes** :
  1. Régler l'heure du rappel dans Paramètres.
  2. Attendre l'heure choisie (ou simuler).
- **Résultat attendu** : Un seul rappel local est envoyé par jour à l'heure choisie.
- **Critère de validation** : Pas de doublon. Le rappel est replanifié après un changement d'heure. Heure par défaut du CDC : entre 19 h et 21 h.
- **Source** : Constaté : services/rappels.ts, commit 4340cb7 (notifications locales au premier plan). CDC M9-01. Déduit : la valeur par défaut exacte n'est pas relevée
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 18. WhatsApp (mode fictif seulement)

#### WHA-01 : Vérifier le mode avant tout test WhatsApp

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Interdit en production
- **Pré-conditions** : Accès aux variables de l'environnement de test. PRIORITES indique que Kapso est en service depuis le 11 octobre : le mode de production (fictif ou réel) est à confirmer par Benny.
- **Étapes** :
  1. Lire la valeur de WHATSAPP_MODE et de WHATSAPP_ALLOWLIST dans l'environnement de test.
  2. Si le mode est réel sans liste d'autorisation, ne rien tester d'autre dans cette section.
- **Résultat attendu** : Le mode est fictif, ou réel avec une liste d'autorisation limitée au numéro de test de Benny.
- **Critère de validation** : Aucun test WhatsApp n'est lancé tant que cette condition n'est pas remplie.
- **Source** : Constaté : docs/whatsapp-kapso.md (mode fictif par défaut, allowlist). Déduit : l'état courant de la production n'est pas vérifié
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-02 : Consentement du parent enregistré (texte et date)

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Mode fictif. Lien parent de bac à sable.
- **Étapes** :
  1. Payer avec la case de consentement cochée.
  2. Lire dans la base la table parent_contacts.
- **Résultat attendu** : Une ligne existe avec le numéro, la date de consentement et la version du texte.
- **Critère de validation** : Pas de contact sans consentement. Le numéro choisi par le parent est celui qui recevra le rapport.
- **Source** : Constaté : migration 20261007200000, commits 13476d6, 58d126f, 3f5b712 (le numéro choisi reçoit le rapport)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-03 : Résumé hebdomadaire du parent (dimanche 14 h, mode fictif)

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Mode fictif. Un parent consentant avec un enfant actif.
- **Étapes** :
  1. Faire déclencher parent_weekly_report_run par Benny sur l'environnement de test (ou attendre dimanche 14 h à Douala).
  2. Lire parent_outbox et le journal de parent-message-send.
- **Résultat attendu** : Un message de rapport est mis en file une seule fois, avec la semaine écrite en français lisible.
- **Critère de validation** : Une seule tâche planifiée (pas de doublon du lundi). Texte rapport_hebdo_parent_texte avec bouton ; repli sur un modèle sans bouton si le premier n'est pas disponible. Rien n'est réellement envoyé.
- **Source** : Constaté : migration 20261010150003 (cron '0 13 * * 0' = dimanche 13 h UTC, 14 h à Douala), commits d4dcea2, 1a08a29, ba6c0cc, 04b9f74
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-04 : STOP : désinscription du parent

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Mode fictif ou numéro de test autorisé. Un contact parent consentant.
- **Étapes** :
  1. Simuler la réception du message STOP (ou « arrêtez », « unsubscribe », « désinscription ») via le webhook de test.
  2. Déclencher un nouvel envoi pour ce parent.
- **Résultat attendu** : Le numéro est désinscrit et plus aucun message ne lui est envoyé.
- **Critère de validation** : Le message doit être entièrement une demande d'arrêt (« ne pas stopper le suivi » ne désinscrit pas). La fonction parent_contact_unsubscribe_phone est appelée. L'envoi suivant est ignoré avec la mention désinscrit.
- **Source** : Constaté : whatsapp.ts (MOTS_STOP, estDemandeStop), whatsapp_test.ts, migration 20261007200000
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-05 : Retrait du consentement depuis l'app (profil parent)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Coordonnées du parent saisies dans Moi, Profil du parent.
- **Étapes** :
  1. Ouvrir le profil parent.
  2. Retirer le consentement ou supprimer le numéro.
- **Résultat attendu** : Le consentement est retiré avec date et aucun message n'est plus mis en file.
- **Critère de validation** : Retrait possible (CDC M2-07). Le numéro saisi est mis en forme selon le pays.
- **Source** : Constaté : commit 8d8ccec (coordonnées du parent, M2-07), écran profil/parent.tsx. Déduit : le retrait côté serveur est à vérifier
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-06 : Support WhatsApp : question simple sans compte (mode fictif ou numéro autorisé)

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Numéro de test autorisé ou simulation repondreSupport. Aucun client réel ne doit être contacté.
- **Étapes** :
  1. Poser une question sur le prix des offres.
  2. Poser une question de cours hors périmètre.
- **Résultat attendu** : L'agent répond de façon courte avec un lien en bouton pour le prix, et décline poliment la question de cours en renvoyant à la correction par photo.
- **Critère de validation** : Pas de mot de passe demandé, accents corrects, réponse en 1 à 3 phrases.
- **Source** : Constaté : docs/support-agent.md, commits e0c4ec9, 79afd96, 6202b0b
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-07 : Support WhatsApp : vérification du compte par l'application

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Bac à sable
- **Pré-conditions** : Numéro de test autorisé. Compte de test avec notifications actives.
- **Étapes** :
  1. Sur WhatsApp, demander « combien de crédits j'ai » et donner l'identifiant copié depuis Moi.
  2. Ouvrir la notification dans l'app, aller sur l'écran de confirmation.
  3. Accepter, puis refaire en refusant.
- **Résultat attendu** : Accepté : la conversation est authentifiée 2 heures et l'agent donne les crédits. Refusé : demande close.
- **Critère de validation** : L'écran /support-confirmer s'ouvre depuis la notification ou à l'ouverture de l'app s'il y a une demande en attente. Limites : 3 demandes par numéro et par heure, 5 par compte et par jour.
- **Source** : Constaté : docs/support-agent.md §2, migration 20261008100000, edge function support-auth-answer, commit 94a6b9c
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-08 : Support WhatsApp : demande d'humain, ticket et alerte équipe

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Numéro de test autorisé. Variable SUPPORT_ALERT_PHONE vers un numéro de test.
- **Étapes** :
  1. Écrire « je veux parler à un humain » ou « remboursement ».
  2. Lire la table support_tickets.
- **Résultat attendu** : Un ticket est créé avec le résumé et l'équipe est alertée ; le client voit que la conversation est en attente.
- **Critère de validation** : Ticket avec numéro, catégorie, résumé et extraits. Alerte via le modèle alerte_equipe_support hors fenêtre de 24 h. Les numéros de la liste de test ne sont jamais mis en attente 8 h.
- **Source** : Constaté : docs/support-agent.md §4 et §8, migration 20261008100000 (support_ticket_create)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-09 : Support WhatsApp : quota du modèle épuisé

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Simulation d'un refus 429 code 4006 du fournisseur d'IA (par Benny).
- **Étapes** :
  1. Envoyer un message au support pendant la simulation.
- **Résultat attendu** : Le client reçoit une réponse automatique d'indisponibilité temporaire, sans insistance, et un ticket est créé.
- **Critère de validation** : Message d'excuse avec le numéro de Benny pour l'urgence ; aucune boucle de retentatives.
- **Source** : Constaté : docs/support-agent.md §8, commit ff175d4
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### WHA-10 : Numéro hors liste d'autorisation

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Interdit en production
- **Pré-conditions** : Mode réel avec liste d'autorisation. Ne pas utiliser de numéro de vrai client.
- **Étapes** :
  1. Écrire depuis un numéro absent de la liste, uniquement si Benny l'autorise.
- **Résultat attendu** : Le numéro reçoit un message d'attente, une fois par 12 h, ou le silence selon SUPPORT_HORS_LISTE.
- **Critère de validation** : Un seul message d'attente par 12 h. Test réel : laissé à Benny.
- **Source** : Constaté : docs/whatsapp-kapso.md (SUPPORT_HORS_LISTE), migration 20261010120000
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 19. Page parent (/parent)

#### PRT-01 : Page du résumé hebdomadaire d'un parent

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Un jeton de résumé parent valide fourni par Benny (environnement de test).
- **Étapes** :
  1. Ouvrir /parent/<jeton> depuis un téléphone.
  2. Lire le temps d'étude, les missions, leçons, quiz, exercices.
- **Résultat attendu** : La page affiche le rapport réel de la semaine de l'élève.
- **Critère de validation** : Chiffres identiques au rapport mis en file. Aucune donnée personnelle sensible. Bouton de paiement présent si pertinent (CDC M8-09).
- **Source** : Constaté : elearn-site commits 4eac58d, 39d2f09 ([locale]/(public)/parent/[jeton]) ; api/og/resume-hebdo
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRT-02 : Page parent : jeton inconnu ou expiré

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Un jeton inventé.
- **Étapes** :
  1. Ouvrir /parent/<jeton-invalide>.
- **Résultat attendu** : Un message clair est affiché, sans fuite de données ni erreur technique.
- **Critère de validation** : Pas de page blanche. La navigation vers l'accueil du site est possible.
- **Source** : Déduit : comportement de la page non lu en détail ; à constater
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PRT-03 : Image Open Graph du résumé parent

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Un lien de résumé parent.
- **Étapes** :
  1. Coller le lien dans un outil d'aperçu (WhatsApp sans envoyer, ou un testeur Open Graph).
  2. Vérifier l'image et le titre.
- **Résultat attendu** : Une image dynamique du résumé hebdomadaire s'affiche comme aperçu.
- **Critère de validation** : Image à la charte (bordure noire de 8 px), titre propre. Pas de fuite de donnée de l'élève dans l'aperçu public hors prénom.
- **Source** : Constaté : elearn-site api/og/resume-hebdo, commits 4eac58d, f9c2c2e
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 20. Support client : parcours et outils back-office

#### SUP-01 : Aide et contact dans l'app

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Compte connecté.
- **Étapes** :
  1. Ouvrir Moi, Aide et contact.
  2. Toucher le lien d'aide près des paiements.
  3. Copier l'identifiant du compte dans Paramètres.
- **Résultat attendu** : L'aide présente le numéro WhatsApp du support à jour et un identifiant copiable pour la vérification.
- **Critère de validation** : Le numéro est celui du support actuel (+1 201-534-8324). L'identifiant se copie en un appui.
- **Source** : Constaté : commits 7165d52, 469f05c, 94a6b9c ; docs/support-agent.md
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-02 : Back-office : commandes et paiements

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Accès au back-office avec un rôle autorisé.
- **Étapes** :
  1. Ouvrir Finance puis Commandes.
  2. Rechercher une commande de test par statut ou par numéro.
  3. Ouvrir le détail.
- **Résultat attendu** : La liste des commandes affiche statut, montant, produit, fournisseur ; le détail se lit sans erreur.
- **Critère de validation** : Le statut est synchronisé avec le fournisseur. Recherche par numéro possible (CDC M12-03).
- **Source** : Constaté : back-office commit 82f0acd (finance/commandes), instructor/finance. CDC M12-03
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-03 : Back-office : remboursement manuel tracé

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Commande de bac à sable. Rôle autorisé. Jamais sur une vraie commande.
- **Étapes** :
  1. Ouvrir une commande de test payée.
  2. Lancer un remboursement manuel.
  3. Vérifier le droit d'accès et la trace.
- **Résultat attendu** : La commande passe à remboursée, le droit d'accès est retiré et l'action est journalisée avec l'auteur.
- **Critère de validation** : Action réservée à un rôle. Journal conservé (CDC M8-10).
- **Source** : Constaté : back-office commit 82f0acd (remboursements et droits d'accès, issue #16 du back-office) ; migration 20261009160000. CDC M8-10
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-04 : Back-office : droits d'accès (entitlements)

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Compte de test avec un pass.
- **Étapes** :
  1. Ouvrir Finance puis Droits.
  2. Chercher le compte, lire la source (paiement, récompense, Apple) et les dates de début et fin.
- **Résultat attendu** : Chaque droit affiche sa source et ses dates ; l'accès expire à la date prévue.
- **Critère de validation** : Source de droit visible (CDC M8-08).
- **Source** : Constaté : back-office instructor/finance/droits ; migration 20261009140000 (source apple)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-05 : Back-office : changelog des mises à jour et configuration mobile

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Rôle autorisé.
- **Étapes** :
  1. Ouvrir Mobile, Changelog et publier une entrée de test (brouillon).
  2. Ouvrir Config et News.
  3. Dans l'app, ouvrir la feuille de mise à jour.
- **Résultat attendu** : Le changelog dynamique s'affiche dans la feuille de mise à jour de l'app.
- **Critère de validation** : Pas de nouvelle version de l'app nécessaire. Entrée supprimée ou dépubliée après le test.
- **Source** : Constaté : back-office commit 54d1063 ; migration 20261011140000 (changelogs) ; app commits bcf1a20, b7863c1
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-06 : Création de codes promo : pas de back-office, SQL seulement

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Accès à la base de test.
- **Étapes** :
  1. Chercher une page de gestion des codes promo dans le back-office.
- **Résultat attendu** : Non disponible : les codes se créent par SQL en attendant elearn #28.
- **Critère de validation** : À noter comme limite connue et non comme anomalie.
- **Source** : Constaté : PRIORITES (elearn #28 ouvert) ; CDC M12-02
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SUP-07 : Tableau de bord des tickets de support

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Sans objet : fonctionnalité non trouvée.
- **Étapes** :
  1. Chercher une file de tickets de support dans le back-office.
- **Résultat attendu** : Non disponible : seule la table support_tickets existe côté base.
- **Critère de validation** : À noter. Les tickets se lisent dans la base ou via l'alerte WhatsApp.
- **Source** : Constaté : docs/support-agent.md §6 (tableau de bord des tickets : pas encore fait) ; CDC M12-04
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 21. PWA et mode hors ligne web

#### PWA-01 : Installer l'application web

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Chrome Android ou Safari iOS, app.elearnprepa.com.
- **Étapes** :
  1. Ouvrir app.elearnprepa.com.
  2. Lire le bandeau d'invitation à installer.
  3. Ajouter à l'écran d'accueil.
- **Résultat attendu** : Une icône correcte est ajoutée, l'app s'ouvre en plein écran avec la bonne couleur de barre.
- **Critère de validation** : Icônes any, maskable et apple-touch-icon 180 correctes. Le bandeau « application » s'affiche et se ferme.
- **Source** : Constaté : commits 33dc87d (PWA, couleur de barre, bandeau), 38fdba5 (icônes), e2642a9 ; maquette de spec PWA b51628d
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PWA-02 : Ouverture de la PWA sans internet au démarrage à froid

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : PWA installée, app ouverte une première fois avec réseau.
- **Étapes** :
  1. Fermer complètement la PWA.
  2. Passer en mode avion.
  3. Rouvrir la PWA.
- **Résultat attendu** : Attendu : l'app s'ouvre. Constaté connu : elle ne s'ouvre pas sans internet au démarrage à froid.
- **Critère de validation** : Résultat attendu au regard des priorités : KO connu, suivi par l'issue #54 (P2). Noter le comportement exact pour l'issue.
- **Source** : Constaté : PRIORITES (issue #54 ouverte), commits c447041, ee89d84 (service worker JS/CSS), e2642a9
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### PWA-03 : PWA déjà ouverte puis coupure réseau

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : PWA ouverte avec réseau, contenu déjà chargé.
- **Étapes** :
  1. Passer en mode avion sans fermer la PWA.
  2. Naviguer dans les écrans déjà visités.
- **Résultat attendu** : Les écrans déjà chargés restent lisibles et la pastille hors ligne s'affiche.
- **Critère de validation** : Pas de page blanche. Les écrans non chargés affichent un message clair.
- **Source** : Constaté : commits e2642a9 (service worker), c57607c
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 22. Liens d'app et Open Graph

#### LIE-01 : Fichiers de vérification des liens d'app

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Aucun matériel spécial.
- **Étapes** :
  1. Ouvrir https://app.elearnprepa.com/.well-known/assetlinks.json.
  2. Ouvrir https://app.elearnprepa.com/.well-known/apple-app-site-association.
- **Résultat attendu** : Les deux fichiers sont servis avec le type application/json.
- **Critère de validation** : Réponse 200, type JSON, empreinte Android et identifiant Apple présents. Fermé par Benny le 7 octobre (#37).
- **Source** : Constaté : commit 5d8996e, PRIORITES (#37 fermée, curl du 7 octobre)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LIE-02 : Ouvrir un lien https de l'app dans l'app (build natif)

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Build natif Android installé. Liens universels vérifiés.
- **Étapes** :
  1. Envoyer à soi-même un lien app.elearnprepa.com/r/<code> (message à soi-même).
  2. Toucher le lien.
- **Résultat attendu** : Le lien s'ouvre dans l'app et le code de parrainage est capté.
- **Critère de validation** : Pas de navigateur intermédiaire. À tester sur téléphone avec un build natif (PRIORITES : liens d'app sur téléphone).
- **Source** : Constaté : commits 974f671, 5d8996e, 698f323 (routeur d'appoint /r/lien) ; PRIORITES (demande un build natif)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LIE-03 : Lien d'appoint /r/lien quand le lien universel ne s'ouvre pas

- **Rôle** : Utilisateur · **Plateforme** : Android · **Environnement** : Production possible
- **Pré-conditions** : Lien reçu dans une app qui ouvre le navigateur.
- **Étapes** :
  1. Ouvrir le lien dans le navigateur.
  2. Choisir d'ouvrir l'app depuis la page.
- **Résultat attendu** : Le bouton Ouvrir dans l'app utilise l'URL web universelle et non un schéma personnalisé.
- **Critère de validation** : L'app s'ouvre sur le bon écran.
- **Source** : Constaté : app commit 698f323 ; elearn-site commit 3372ac9
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LIE-04 : Open Graph : page de paiement parent

- **Rôle** : Parent · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Un lien de paiement parent de bac à sable.
- **Étapes** :
  1. Coller le lien dans un outil d'aperçu Open Graph.
  2. Lire titre, description, image.
- **Résultat attendu** : Un aperçu dynamique montre le nom de l'élève, l'offre et un badge sécurisé, avec le logo SVG.
- **Critère de validation** : Aperçu cohérent avec le lien, sans montant modifiable ni donnée sensible. Image Open Graph d'accueil par défaut sinon.
- **Source** : Constaté : elearn-site commits f5210c1, 9ecea19, 279966a, a27df0c
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LIE-05 : Open Graph : page de parrainage (image avec code promo et remise)

- **Rôle** : Invité · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Un lien /r/<code> ou /invite/<code>.
- **Étapes** :
  1. Coller le lien dans un outil d'aperçu Open Graph.
- **Résultat attendu** : L'image de parrainage s'affiche avec le tag de code promo en haut à droite et la remise lisible.
- **Critère de validation** : Aucun défaut de mise en page (le bug Satori de la remise est corrigé). Bordure noire de 8 px.
- **Source** : Constaté : elearn-site commits 4dc7828, 88ce306, c04d618, f9c2c2e
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### LIE-06 : Pages publiques et métadonnées du site

- **Rôle** : Invité · **Plateforme** : Web · **Environnement** : Production possible
- **Pré-conditions** : Navigateur.
- **Étapes** :
  1. Ouvrir tarifs, concours, parents, contact, aide, cgu, confidentialité, supprimer-mon-compte.
  2. Lire le titre et la description de chaque page.
- **Résultat attendu** : Les pages existent, sont traduites et portent un titre et une description propres.
- **Critère de validation** : Aucune 404. Textes CGU et confidentialité liés depuis le consentement de l'app. Sitemap présent.
- **Source** : Constaté : elearn-site src/app/[locale]/(vitrine) ; app commit 44ad673 (CGU et confidentialité liées)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

### 23. Sécurité et robustesse

#### SEC-01 : RLS : un compte ne lit pas les données d'un autre

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Deux comptes de test A et B sur l'environnement de test. Outil API avec le jeton de A.
- **Étapes** :
  1. Avec le jeton de A, lire les paiements, crédits, notifications de B (en passant par l'API REST).
  2. Essayer d'écrire un solde de crédits.
- **Résultat attendu** : Aucune ligne de B n'est retournée et aucune écriture directe n'est acceptée.
- **Critère de validation** : Lectures vides ou refusées, écritures refusées. Le solde ne se modifie que par les fonctions serveur.
- **Source** : Constaté : migrations rls_* du 11 octobre (83 tables), tests pgTAP des six surfaces. Test manuel complémentaire
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SEC-02 : Webhook pawaPay : corps ignoré, dépôt relu chez pawaPay

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Environnement de test avec le webhook exposé.
- **Étapes** :
  1. Envoyer un faux rappel de succès sans passer par pawaPay (par Benny, sur le bac à sable).
  2. Regarder le statut de la commande.
- **Résultat attendu** : La commande ne passe pas à payée : le serveur relit le dépôt chez pawaPay.
- **Critère de validation** : Aucune activation de pass sur un faux appel. Issue elearn-supabase #44 fermée le 13 octobre.
- **Source** : Constaté : PRIORITES (corps ignoré et dépôt relu), edge function pawapay-webhook
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SEC-03 : Limitation de débit (rate limiting)

- **Rôle** : Utilisateur · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Environnement de test.
- **Étapes** :
  1. Répéter rapidement une action sensible (paiement, code promo) depuis un client de test.
  2. Observer la réponse.
- **Résultat attendu** : Au-delà du seuil, le serveur répond 429 et l'app affiche un message de patience.
- **Critère de validation** : Pas d'effet de bord après un 429. La réponse n'expose aucun détail interne.
- **Source** : Constaté : migration 20261011120000, commits c78d8fa, 1b48a32
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

#### SEC-04 : Alertes de sécurité Supabase restantes

- **Rôle** : Support client · **Plateforme** : Web · **Environnement** : Bac à sable
- **Pré-conditions** : Accès au tableau de bord Supabase (Benny).
- **Étapes** :
  1. Ouvrir les alertes (Advisors).
  2. Comparer avec la liste de PRIORITES : expiration des codes, mots de passe compromis, GraphQL, fonctions SECURITY DEFINER.
- **Résultat attendu** : La liste des alertes restantes correspond à celle des priorités ou est vide.
- **Critère de validation** : Toute nouvelle alerte est consignée. Point à trancher par Benny : issue elearn-supabase #11 fermée alors que des alertes subsistent.
- **Source** : Constaté : PRIORITES (P2 et À trancher, point 2)
- **Statut** : [x] À tester  [ ] OK  [ ] KO
- **Commentaire** : ........................................................................
- **Testeur / date** : ............................

## 9. Récapitulatif des résultats (à remplir)

| Section | Tests | OK | KO | Restant |
| --- | --- | --- | --- | --- |
| 1. Authentification | 13 |  |  |  |
| 2. Synchronisation de la session invité vers le compte | 4 |  |  |  |
| 3. Crédits : cadeau, recharge du lundi, dépense | 16 |  |  |  |
| 4. Gagner des crédits | 8 |  |  |  |
| 5. Parrainage | 8 |  |  |  |
| 6. Arrivée, choix de classe ou de concours | 3 |  |  |  |
| 7. Reprise d'une activité commencée mais non terminée | 7 |  |  |  |
| 8. Missions du jour | 5 |  |  |  |
| 9. Cours et leçons | 4 |  |  |  |
| 10. Quiz : fin de quiz, erreurs, correction | 4 |  |  |  |
| 11. Annales et chronomètre | 6 |  |  |  |
| 12. Question à l'IA et photo | 8 |  |  |  |
| 13. Mode hors ligne | 4 |  |  |  |
| 14. Pass et paiement | 13 |  |  |  |
| 15. Codes promo | 5 |  |  |  |
| 16. Lien parent (demander à quelqu'un de payer) et reçu | 8 |  |  |  |
| 17. Notifications | 6 |  |  |  |
| 18. WhatsApp (mode fictif seulement) | 10 |  |  |  |
| 19. Page parent (/parent) | 3 |  |  |  |
| 20. Support client : parcours et outils back-office | 7 |  |  |  |
| 21. PWA et mode hors ligne web | 3 |  |  |  |
| 22. Liens d'app et Open Graph | 6 |  |  |  |
| 23. Sécurité et robustesse | 4 |  |  |  |
| **Total** | **155** |  |  |  |

Fin de la fiche.
