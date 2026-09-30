# Produit et décisions validées

Sources : cahier des charges v1.3 (voir `02-cahier-des-charges.md`), mémoire du projet, fils « Redéfinir le besoin client », « Plan de développement », « Cahier des charges et récompenses ». État au 30/09/2026.

## Pourquoi on refait tout

L'ancienne app (`falachabt/elearn_mobile`, Expo 54) mélangeait 4 produits (prépa concours, secondaire par abonnement, documents, réseau social), demandait un compte et un mot de passe avant toute valeur, et affichait un paywall total. Résultat : très peu de ventes, énormément d'abandons à l'inscription et au paiement. Les chiffres détaillés sont confidentiels (dépôt privé `elearn-supabase`, `docs/projet/`).

Leçons retenues :
- Donner de la valeur **avant** le compte (invité d'abord).
- Un **premier résultat en moins de 2 minutes**.
- **Prix d'entrée bas**, pass courts, un seul moyen de paiement fiable, confirmé côté serveur.
- 99 % Android, usage le soir (19 h–22 h) : app légère, rappels le soir, habitude quotidienne.

## Vision

> **Le tuteur de poche de l'élève africain.** Bloqué sur un exercice ? Prends-le en photo, reçois la correction expliquée. Prépare ton examen ou ton concours avec les vrais sujets.

Cibles : élève (11–18 ans), candidat à un concours, parent ou tuteur (payeur, souvent sans compte), enseignant relais (classes), partenaire (écoles privées, sponsors), équipe Elearn Prepa (back-office).

Modèle retenu : **hybride** (contenu gratuit + pass courts + revenus tiers : écoles, partenaires). Multi-pays dès le départ (6 pays ciblés, Cameroun d'abord). Pilote de 12 mois (janvier–décembre 2027).

## Décisions validées par Benny (ne pas les rediscuter sans lui)

| Sujet | Décision | Date |
|---|---|---|
| Prestataire Mobile Money | **pawaPay** (MTN et Orange). Déjà branché dans le back-office de l'ancienne app (`staff.elearnprepa.com/api/payments/pawapay`) | 30/09/2026 08:12 |
| Prix des pass | **Semaine 500 FCFA · Mois 2 500 FCFA · Concours 7 500 FCFA** (noms alignés sur l'écran E1 du design) | 30/09/2026 |
| Logo | Logo plat redessiné (kit de marque), validé | 30/09/2026 |
| Parcours | **Invité d'abord** : aucun compte demandé avant le premier résultat ; la progression d'invité est migrée dans le compte (M1-04) | cahier des charges |
| Connexion | Google, Apple (obligatoire sur iOS), Facebook (S). Pas de numéro + SMS par défaut (coût). E-mail + mot de passe existe aussi dans l'app | cahier des charges |
| Plateformes | **Android et iOS au lancement**, web pour le lien parent et le site. Benny a déjà un compte Apple Developer et une Play Console | 30/09/2026 |
| Identifiant d'app | La nouvelle app garde celui de l'ancienne : `com.ezadrive.elearn`, version 3.0.0 | 30/09/2026 |
| Base de données | **Même projet Supabase** que l'ancienne app (contenu et comptes existants). Changements de base = ajouts uniquement tant que l'ancienne app est en ligne | plan de dev |
| Tests backend | **Pas de branche Supabase payante** : tout se teste en local (Docker + CLI) | 30/09/2026 09:21 |
| Ordre du plan | Paiement (phase 3) **avant** mission du jour (phase 4) ; mais le code des paiements se fait en dernier dans l'ordre réel décidé par Benny (« paiements à la fin ») | 30/09/2026 |
| Sécurité | Nettoyage sécurité (RLS, clés) **différé** : à faire avant toute production / stores, au plus tard en phase 5 | 30/09/2026 09:23 |
| Stockage | Fichiers sur **Cloudflare R2** (réduire les coûts) | 30/09/2026 |
| Design | Autonomie totale laissée à Claude sur les choix de design (hors dépenses et suppressions) | 30/09/2026 |
| Animations | Pas de Lottie (hors thème néo-brutal) : Reanimated | 30/09/2026 |

## Récompenses et parrainage (M15), décidé le 30/09/2026 11:27

Principe : « free to play ». Tout le monde gagne quand la communauté grandit ; **jamais de récompense individuelle contre un like ou un abonnement** (règles Meta) ; **pas de tirage au sort**, **pas de mois gratuit pour tous**.

Paliers d'abonnés Facebook + Instagram additionnés, récompense pour **tous les inscrits** :

| Palier | Récompense |
|---|---|
| 1 000 | +5 crédits de correction (14 jours) |
| 2 000 | 1 concours blanc corrigé offert (choix du sujet : à confirmer par l'agent contenu) |
| 5 000 | Code −50 % sur le premier pass (7 jours) |
| 10 000 | **+20 crédits (30 jours) + code −50 % sur un pass au choix** (14 jours) |
| Ensuite | Un palier tous les 5 000, toujours pour tout le monde |

Parrainage :
- À l'**activation** du filleul (compte + premier résultat + une mission sous 7 jours) : **+10 crédits parrain, +5 filleul**.
- Si le filleul paie son premier pass : parrain **+15 crédits** et **+7 jours** (pass semaine) ou **+14 jours** (pass mois ou concours). Annulé si remboursement.
- Filleul : **−15 % sur son premier pass**, valable 30 jours, non cumulable avec un code de palier.
- Partage d'une correction : +1 crédit quand un nouvel appareil ouvre le lien, 3 par jour maximum.
- Anti-abus côté serveur (M15-12). Tout crédit est écrit **par le serveur seul** (`reward_ledger`).

Découpage : phase 2 = capture du code de parrainage à l'inscription (fait) ; phase 4 = portefeuille, paliers, récompenses.

## Interactivité (M16), ajouté le 30/09/2026

Benny insiste : l'expérience interactive ne doit pas être négligée. Sons courts, vibrations légères, animations, avec trois réglages séparés (Sons, Vibrations, Animations réduites). Service unique `useFeedback`. Détail : `04-design-system.md`.

## Demandes de design encore à construire

- Classes : où l'élève voit les missions de sa ou ses classes ; comment l'enseignant crée une mission (écrans H6–H11 du guide).
- Classement d'effort hebdo : l'élève peut choisir de ne pas apparaître (masqué par défaut pour les concours).
- États de retour (succès, erreur, vide, réseau) pour chaque écran.

## Points encore ouverts (à confirmer avec Benny)

- Règles Apple pour le paiement sur iOS (M8-13) : achat intégré Apple probable ; lien parent là où c'est autorisé.
- Droits sur les annales avant publication.
- Fournisseur WhatsApp Business et coût par message.
- Modèle d'IA pour l'aide par photo et budget mensuel.
