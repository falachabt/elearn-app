# Règles d'or de Benny

Source : messages de Benny, datés. À respecter par tout agent et par Claude Code en local. Si Benny donne une nouvelle règle, l'ajouter ici avec sa date.

## 1. Méthode de travail
- **Jamais Opus** pour un nouvel agent ou sous-agent (1er octobre) : Sonnet pour le développement et le design, le modèle le moins cher pour les tâches simples. Ne pas lancer d'agents pour rien : chaque agent coûte.
- **Un agent par rôle** (6 octobre) : un seul agent de développement, un seul de design, un seul pour le reste, renouvelés quand leur contexte sature. Avant de s'arrêter, l'agent écrit un fichier de passation (état, fichiers, branches, pièges, prochaine étape).
- Benny code désormais surtout **en local avec Claude Code** ; les tâches restantes sont des issues GitHub à fermer une à une. L'agent chef de projet gère issues, priorités (`docs/PRIORITES.md`) et ne code pas.
- Faire `git pull` avant tout push (Benny commit parfois à la main).

## 2. Qualité
- **Tests unitaires et d'intégration pour toute fonctionnalité** (30 septembre, 1er octobre) : « solide comme un rocher ». Jest côté app, pgTAP côté base. Tests dans `__tests__` dans les dossiers chargés.
- Validation en local avant de pousser : `npm run valider` (typage, Jest en série, export Android + Hermes). Pas d'émulateur comme barrière du CI.
- Un écran commencé est fini avant d'en commencer un autre : états (squelette, vide, erreur, hors ligne, succès), sons et vibrations réglables, clair et sombre, évènements PostHog, tests.
- Code de production propre et typé, sans `ts-ignore` ni `ts-expect-error` hors tests.
- Un module natif se teste aussi sur le web ; un module natif optionnel se charge par `requireOptionalNativeModule` (AGENTS.md §17).

## 3. Design
- **Aucun écran ni composant sans maquette** (1er octobre). Si elle manque, la dessiner (Figma, avec les règles de design) ou demander à Benny, puis coder.
- **Ajuster l'existant, ne pas redessiner** : parcours Figma A à H (E paiement, F page parent, D annales et résultats, H profil, B photo). Une fonction nouvelle s'intègre dans les écrans existants.
- **Jamais d'emojis dans l'interface**, ni dans les maquettes (1er octobre). Icônes Lucide, carrées.
- Tokens sémantiques uniquement (`theme.color.*`), jamais la palette brute. Clavier géré par le conteneur `Ecran` (`KeyboardAvoidingView`), barre d'état et barre de navigation colorées selon le thème, retours sons et haptique via `useFeedback`, désactivables dans les réglages.
- Formules : LaTeX en base, rendu sans défilement latéral.

## 4. Base de données et production
- **Aucune modification de la production, dépense ou suppression sans l'accord de Benny.**
- Migrations **additives** : ne jamais casser l'ancienne app ni le back-office.
- Tester en local (`npx supabase@2.118.0 test db`) avant toute migration poussée. Ne jamais pousser sur `main` de `elearn-supabase` (déploiement automatique en production) : passer par une PR.
- **Rapport à Benny après chaque migration poussée** (1er octobre) : quoi, pourquoi, tests passés, risque évalué, retour arrière.
- Nettoyage de sécurité obligatoire avant les stores : RLS sur les tables sans protection, clés exposées révoquées, liens signés pour les PDF si le contenu devient payant, effacement des comptes à 30 jours.

## 5. Publication
- **Chaque push annule l'OTA ou le build précédent** (workflow EAS preview) : regrouper les commits, attendre la fin d'un run avant d'en pousser un autre, ne pas pousser après un `[build]` avant son lancement.
- `[obligatoire]` dans le message d'un commit rend la mise à jour obligatoire, `[build]` lance un APK : ne l'écrire que si c'est voulu.
- Après l'ajout d'un module natif : incrémenter `version` dans `app.json` (le `runtimeVersion` en dérive) et produire un nouvel APK.
- Dire à Benny ce que contient chaque OTA et quoi tester.

## 6. Produit
- **Modèle à crédits** : les montants (invité, bienvenue, recharge du lundi, coûts des actions, limite IA du pass) viennent de la **configuration serveur**, jamais écrits en dur dans l'app, les tests de maquette ou les textes.
- Prix des pass inchangés : 500 / 2 500 / 7 500 FCFA. Prestataire Mobile Money : pawaPay.
- Pas de récompense individuelle contre un « j'aime » ou un abonnement (règles de Meta).
- Toute décision produit nouvelle de Benny est notée au journal du cahier des charges (section 15).

## 7. Secrets et communication
- Aucun secret, jeton ou clé dans le chat, un commit, une PR, une issue ou la mémoire. Jamais de fichier `.env` versionné : `.env.local` ou secrets EAS.
- Messages à Benny en français clair. Pas d'identifiant de modèle dans les commits, PR ou issues. Pas d'emojis dans les issues et commits.
- Économie de tokens : skill `mode-concis` / `caveman` pour les notes internes seulement ; le code, les commits, les PR et les messages à Benny restent normaux.
