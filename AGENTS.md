# Instructions pour les Agents IA

## 1. Communications & Pull Requests
- Lorsque tu crées ou modifies une Pull Request et que tu attends une validation de ma part, **fournis toujours le lien direct** vers la PR dans ta réponse.
- Conserve un ton strictement professionnel dans les issues GitHub et le code (pas d'émojis dans les issues ou commits).

## 2. Règle Stricte Git Backend (`elearn-supabase`)
- **NE JAMAIS pusher directement sur la branche `main` de `elearn-supabase`**.
- Un workflow GitHub Actions applique automatiquement en production tout commit arrivant sur `main`.
- Toujours travailler sur une branche de fonctionnalité (ex: `claude/...`) et soumettre une Pull Request (PR) pour validation.
- **TOUJOURS exécuter les tests pgTAP en local** via `npx supabase test db` (ou `supabase test db`) avant de commiter ou d'ouvrir une PR afin d'éviter de faire échouer le CI GitHub Actions.

## 3. Tests Locaux Obligatoires Frontend (`elearn-app`)
- Toujours exécuter `npm test` en local avant de pousser du code frontend afin d'assurer un taux de réussite de 100% sur la suite de tests Jest.

## 3. Design System & Interfaces (UI)
- Avant de créer ou de mettre à jour une interface utilisateur, tu **dois obligatoirement te référer** aux fichiers du Design System présents dans le dossier docs/ (notamment docs/Design system Elearn Prepa.md).
- Respecte scrupuleusement les tokens sémantiques (couleurs, typographie, espacements).
- Règles de travail design (ajuster l'existant, pas d'emojis, Lucide, thèmes clair et sombre, crédits épuisés, limites Figma) : **docs/design-regles.md**.

## 4. Mise à jour des consignes
- Si je te donne de nouvelles règles ou consignes de travail en cours de session, **tu as la consigne de mettre à jour ce fichier AGENTS.md** toi-même pour t'en souvenir lors de nos futures sessions.

## 5. Liens importants
- **Site web officiel** : https://elearnprepa.com (à utiliser pour toutes les redirections ou actions "site web").

## 6. Mémoire Globale du Projet
- Pour le contexte global, l'avancement et l'historique, réfère-toi au fichier central : docs/MEMOIRE_PROJET.md.
