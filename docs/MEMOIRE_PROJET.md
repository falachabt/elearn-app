# Mémoire du Projet Elearn Prepa (Agents AI)

Ce fichier sert de cerveau collectif. Il doit être consulté pour comprendre le contexte global et doit être mis à jour par les agents à chaque fois qu'un chantier majeur est complété.

## 1. Architecture Globale
- **elearn-app** : Application mobile React Native (Expo).
- **elearn-site** : Site vitrine et web-app Next.js 15 (Tailwind).
- **elearn-supabase** : Backend Supabase (PostgreSQL, Edge Functions, RLS, RPC).

## 2. État d'avancement (Octobre 2026)
- **Paiement Parent (/p/[token])** : Fusionné sur site et backend. Permet aux parents de payer via Mobile Money (pawaPay). Liens enrichis dynamiquement pour WhatsApp.
- **Notifications Push (EAS)** : xpo-notifications configuré avec Firebase (google-services.json via EAS Secrets). Routage actif en place dans src/services/rappels.ts pour rediriger les clics de notification.
- **Synchronisation Hors-Ligne** : Reprise de l'historique invité après inscription fonctionnelle.
- **En cours d'implémentation** : **Système de Parrainage (M15)**.
  - *Règles métier parrainage* : 3 étapes (1. Clic, 2. Création compte, 3. Achat Pass). Le parrain gagne à chaque étape + reçoit une notification. Le filleul gagne à l'étape 2.

## 3. Processus de Build
- Les builds Android de preview se lancent via GitHub Actions (as-preview.yml) lors d'un push si le commit contient le tag [build].
