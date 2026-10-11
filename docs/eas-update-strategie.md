# Stratégie EAS Update & Changelog Dynamique (B9-OTA)

Ce document décrit la gouvernance et le cycle de mise à jour Over-The-Air (OTA) d'Elearn Prépa via Expo EAS Update, ainsi que le système de changelog dynamique.

---

## 1. Canaux EAS Update

L'application Elearn Prépa utilise 3 canaux distincts configurés dans `eas.json` :

| Canal | Utilisation | Fréquence de déploiement | Public cible |
|---|---|---|---|
| `development` | Tests locaux et développeurs via le client de développement | À la demande | Développeurs |
| `preview` | Builds internes et tests d'équipe / QA avant publication | Automatique à chaque push sur branche de travail | Équipe produit, testeurs |
| `production` | Application distribuée sur le Google Play Store et l'Apple App Store | Planifiée ou correctif urgent | Tous les élèves en production |

---

## 2. Règle de décision : OTA vs Nouveau Build Natif

Toute modification ne peut pas être déployée via une mise à jour OTA. La règle stricte est la suivante :

### ✅ Déploiement OTA autorisé (`eas update`)
- Modifications de code JavaScript / TypeScript / React.
- Mises à jour des styles, thèmes, textes et traductions (`i18n`).
- Corrections de bugs logiques (calculs, navigation, affichage de contenu).
- Améliorations de performance applicative (sans nouveau package natif).
- Déploiement d'un correctif critique en production sans attendre la validation des stores.

### ⛔ Nouveau Build EAS obligatoire (`eas build`)
- Ajout, mise à jour ou suppression de dépendances avec code natif (Android / iOS).
- Modification des permissions (`app.json` : caméra, notifications, etc.).
- Changement du `runtimeVersion` ou de la politique de version.
- Mise à jour du SDK Expo (ex. passage à une version majeure supérieure).
- Changement de configuration native dans `plugins`, `infoPlist`, `intentFilters`, etc.

---

## 3. Commandes de publication OTA

### Publier sur le canal Preview
```bash
npx eas update --branch preview --message "Correctif UI et partage"
```

### Publier sur le canal Production
```bash
npx eas update --branch production --message "Correction critique calcul des scores"
```

### Forcer une mise à jour obligatoire
Pour imposer le téléchargement sans possibilité de reporter (« Plus tard » désactivé) :
- Préfixer le message de l'update par `[obligatoire]` :
  ```bash
  npx eas update --branch production --message "[obligatoire] Correctif sécurité"
  ```
- Ou renseigner le champ `obligatoire: true` dans la table `changelogs` Supabase.

---

## 4. Changelog Dynamique (Table `changelogs`)

Pour informer les élèves des nouveautés et correctifs apportés sans avoir à redéployer l'application, un système de changelog dynamique est connecté à la base Supabase :

### Schéma de la table `public.changelogs`
- `id` (uuid, primary key)
- `version` (text) : Version cible de l'application (ex: `3.1.0`).
- `title_fr` / `title_en` (text) : Titre de la mise à jour (ex: *« Nouveautés de rentrée »*).
- `content_fr` / `content_en` (text) : Liste détaillée des améliorations.
- `obligatoire` (boolean) : Définit si l'élève doit obligatoirement installer la mise à jour.
- `published_at` (timestamptz) : Date et heure de publication.

### Accès & Sécurité (RLS)
- **Lecture publique** : Accessible à tous les utilisateurs (`anon` et `authenticated`) pour charger les notes de version.
- **Écriture sécurisée** : Réservée aux administrateurs et membres du staff (`is_staff() = true`).

---

## 5. Gestion depuis le Back-office
Les administrateurs peuvent consulter, créer et modifier les changelogs directement depuis l'espace `Mobile > Mises à jour` du back-office sans aucune ligne de code.
