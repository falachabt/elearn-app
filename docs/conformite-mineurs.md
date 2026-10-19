# Conformité et Protection des Données des Mineurs (6 Pays)

Ce document établit le cadre de conformité juridique et technique d'**Elearn Prepa** concernant l'âge minimum, le recueil du consentement parental et le traitement des données à caractère personnel des élèves mineurs dans les six pays d'opération :
- **Cameroun (CM)**
- **Sénégal (SN)**
- **Côte d'Ivoire (CI)**
- **Guinée (GN)**
- **Bénin (BJ)**
- **Togo (TG)**

---

## 1. Cadre juridique national par pays

| Pays | Autorité de régulation | Texte de référence | Âge de majorité civile | Seuil de consentement numérique autonome | Règle applicable sur Elearn Prepa |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Cameroun (CM)** | ANTIC / MINPOSTEL | Loi n° 2010/012 (Cybersécurité) & Code civil | 21 ans | 16 ans | Accord parental requis pour les élèves du secondaire (< 18 ans). Numéro parent enregistré. |
| **Sénégal (SN)** | CDP (Commission de Protection des Données Personnelles) | Loi n° 2008-12 du 25 janv. 2008 | 18 ans | 16 ans | Consentement du représentant légal obligatoire pour tout mineur de moins de 16 ans. |
| **Côte d'Ivoire (CI)** | ARTCI | Loi n° 2013-450 du 19 juin 2013 | 18 ans | 16 ans | Accord explicite du titulaire de l'autorité parentale pour la création de compte et les paiements. |
| **Bénin (BJ)** | APDP Bénin | Loi n° 2017-20 (Code du Numérique, Livre V) | 18 ans | 16 ans | Consentement préalable du parent/tuteur pour la collecte de données éducatives en ligne. |
| **Togo (TG)** | IPDCP | Loi n° 2019-014 du 29 oct. 2019 | 18 ans | 16 ans | Accord parental obligatoire. Minimisation stricte des données et interdiction de profilage commercial. |
| **Guinée (GN)** | APDP Guinée | Loi L/2016/037/AN (Cybersécurité & Données) | 18 ans | 16 ans | Autorisation parentale exigée pour l'inscription des collégiens et lycéens. |

---

## 2. Principes directeurs appliqués dans l'architecture produit

### A. Minimisation des données collectées
Elearn Prepa n'exige ni document d'identité officiel, ni géolocalisation précise en continu :
- **Identité** : Seul le prénom (ou pseudo) et la filière/classe sont demandés lors de l'onboarding pour adapter le contenu pédagogique.
- **Authentification** : Support des comptes anonymes pour tester l'application sans fournir d'e-mail ni de numéro de téléphone.
- **Appareil photo / IA Tuteur** :
  - Les photos prises sont strictement cantonnées à des énoncés de cours/exercices.
  - Les photos sont purgées automatiquement du stockage après 30 jours.

### B. Recueil et traçabilité du consentement parental
Dans le schéma Supabase (`guardian_contacts` et `parent_contacts`) :
1. **Enregistrement de l'accord** :
   - Fonction RPC `save_guardian_contact(name, phone, consent)` : enregistre le nom et numéro du parent, daté par le serveur (`consent_at = now()`).
   - Anti-falsification : interdiction d'écriture directe (protection RLS et SECURITY DEFINER).
2. **Retrait du consentement** :
   - Fonction RPC `withdraw_guardian_contact()` : efface immédiatement le numéro de téléphone et la date de consentement, et consigne la date de révocation (`withdrawn_at`).
3. **Information du parent en temps réel** :
   - Résumé hebdomadaire des révisions transmis sur WhatsApp au numéro du parent.
   - Envoi systématique d'un reçu détaillé lors de toute transaction de pass.

### C. Gestion des paiements par des mineurs
- Les souscriptions de pass s'effectuent via Mobile Money (Orange Money, MTN MoMo, Wave, Moov) opérées par des passerelles agréées (pawaPay, Chariow).
- La validation d'un paiement Mobile Money exige l'authentification PIN sur la carte SIM du payeur (généralement le parent ou tuteur pour les élèves du secondaire).
- Aucun stockage de numéro de carte bancaire ou de données financières sensibles n'est effectué sur les serveurs Elearn Prepa.

### D. Droit à l'oubli et purge sous 30 jours (RGPD / Réglementations CEDEAO)
- Conformément aux exigences internationales et africaines de protection de l'enfance :
  - Tout utilisateur (ou son parent) peut demander la suppression immédiate ou différée de son compte (`request_account_deletion()`).
  - Un délai de grâce de 30 jours permet à l'élève d'annuler sa demande.
  - À l'issue des 30 jours, le cron quotidien `daily-account-deletions` exécute `delete_user_safely(uuid)` qui purge en cascade :
    - Le compte `auth.users` et le profil élève.
    - L'historique des crédits et récompenses (`credit_ledger`, `credit_balances`).
    - Les corrections et énoncés photos (`photo_corrections`).
    - Les fichiers physiques hébergés dans le stockage privé (`storage.objects`).

---

## 3. Matrice de conformité pour les App Stores (Apple & Google Play)

| Exigence App Store / Google Play | Mesure mise en place dans Elearn Prepa |
| :--- | :--- |
| **Familles & Enfants (Google Play Families Policy)** | Application classée 12+ (enseignement secondaire / concours). Pas de publicité ciblée tierce. Données non transmises à des courtiers de données. |
| **Kids Category & COPPA / RGPD-M (Apple App Store)** | Suppression de compte intégrée dans l'application (`Paramètres > Supprimer mon compte`). Politique de confidentialité claire accessible sans connexion. |
| **Contrôle Parental** | Possibilité pour le parent de suivre l'apprentissage de son enfant via WhatsApp sans avoir à installer l'application. |

---

## 4. Contacts DPO et Signalement

Pour toute demande relative aux données d'un élève mineur, contact du Délégué à la Protection des Données :
- **E-mail** : `dpo@elearnprepa.com`
- **Support WhatsApp officiel** : Accessible directement depuis l'application via le bouton de support.
