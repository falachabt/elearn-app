# Contexte produit (sans donnée confidentielle)

Ce dépôt est public : on n'y met ni chiffres financiers, ni statistiques de conversion, ni secret. Le contexte confidentiel est dans le dépôt privé `elearn-supabase` (`docs/projet/`).

## Pourquoi cette refonte
Elearn Prepa a du mal à vendre. Benny et son associé repartent du besoin : repenser le produit et refaire l'app, pour des élèves du secondaire et des candidats aux concours en Afrique francophone (Cameroun, Gabon, Côte d'Ivoire, Sénégal, Burkina Faso, Togo, Bénin, Guinée), sur Android d'abord, avec des connexions et des forfaits limités. D'où le mode hors ligne, la légèreté et le paiement Mobile Money.

## Dépôts
| Dépôt | Rôle |
| --- | --- |
| `elearn-app` | Nouvelle app Expo (SDK 57, React Native, Expo Router) |
| `elearn-supabase` | Backend : migrations, RPC, Edge Functions, pgTAP. Un push sur `main` déploie en production |
| `elearn-site` | Site vitrine et pages web publiques (Next.js), dont la page de paiement parent `/p/[token]` |
| `elearn` | Back-office (administration, contenus, paiements) |
| `elearn_mobile` | Ancienne app, à ne pas casser tant que les comptes ne sont pas repris |

## Produit
- **Parcours** : premier résultat sans compte (mini-test, score), puis compte pour sauvegarder. Mission du jour et série, Réviser (cours, leçons, fiches, entraînement, annales), Questions (entraide, sondages), Photo et IA (correction par photo), Moi (profil, progression, réglages).
- **Modèle hybride à crédits** (cahier des charges v1.13, M18) : invité 5 crédits ; 40 crédits de bienvenue une fois par appareil (compte requis) ; 25 crédits chaque lundi, non cumulables ; coûts : explication de quiz 1, corrigé 2, PDF 3, annale 5, question IA ou photo 5. Un **pass** (semaine 500, mois 2 500, six mois 7 500 FCFA) donne l'accès illimité, avec 30 questions IA par jour. Crédits épuisés : feuille « Recharger / Plus tard » et « Gagner des crédits » (page des actions : visiter le site, réseaux sociaux). Un proche peut payer à la place de l'élève (« Demander à quelqu'un de payer », page parent).
- **Récompenses** : parrainage (parrain gagne à chaque étape, filleul à l'inscription), palier communautaire.
- **Décisions validées** (30 septembre 2026) : prestataire pawaPay, prix des pass, nouveau logo plat.
- **Hors ligne** : préparation limitée au programme de l'élève, contenu valable 7 jours sans contact serveur, crédits débités localement puis rejoués au serveur de façon idempotente. Le serveur vérifie le droit d'accès avant de servir un corrigé payant (option A, décision du 6 octobre).

## Phases du plan
0 Assainir et comptes (faite) · 1 Socle Expo et design system (faite) · 2 Compte et premier résultat (faite) · 3 Vendre : pawaPay, droits, lien parent (en cours) · 4 Mission, cours, annales, récompenses (largement faite) · 5 Reprise des comptes, recette, sécurité, stores (à faire) · 6 Lancement en janvier 2027, puis lots 2 et 3 (écoles relais, partenaires, WhatsApp).

## Où trouver quoi
- Cahier des charges v1.13, plan, bilan : fichiers du projet Claude (`refonte/`), copie privée dans `elearn-supabase/docs/projet/`.
- Design : Figma « Elearn Prepa 2 · Design System & App » (8 parcours A à H), guide `docs/Design system Elearn Prepa.md`.
- État technique et pièges : `docs/MEMOIRE_PROJET.md`, `docs/TODO.md`, `AGENTS.md`.
- Ordre des tâches : `docs/PRIORITES.md`.

## Historique des agents (jusqu'au 6 octobre 2026)
Neuf agents par page ont travaillé du 1er au 6 octobre (Accueil et Réviser, Questions, Profil, Photo, Finitions, Backend, Paiements, Publication, Design). Depuis le 6 octobre : pause, un agent chef de projet (issues, priorités), un agent design (veille Figma), et Claude Code en local pour le développement.
