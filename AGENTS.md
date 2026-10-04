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

## 4. Mise à jour des consignes
- Si je te donne de nouvelles règles ou consignes de travail en cours de session, **tu as la consigne de mettre à jour ce fichier AGENTS.md** toi-même pour t'en souvenir lors de nos futures sessions.

## 5. Liens importants
- **Site web officiel** : https://elearnprepa.com (à utiliser pour toutes les redirections ou actions "site web").

## 6. Mémoire Globale du Projet
- Pour le contexte global, l'avancement et l'historique, réfère-toi au fichier central : docs/MEMOIRE_PROJET.md.

## 7. Règles de Build Web (`elearn-site`)
- **Vercel très strict (ESLint)** : Le compilateur Next.js sur Vercel bloque le déploiement au moindre avertissement ESLint grave (apostrophes non échappées comme `l'accès` au lieu de `l&apos;accès`, variables non utilisées dans les `catch`, etc.).
- **Vérification avant Push** : Toujours exécuter `npm run build` ou `npx tsc --noEmit` en local dans le dossier `elearn-site` pour corriger les erreurs TS/ESLint avant de pousser sur `main`.

## 8. Génération d'Images Open Graph (OG)
- **Outil** : Utiliser `next/og` (`ImageResponse`) dans Next.js.
- **Design System** :
  - Fond : Crème `#FFF7E3`.
  - Textes principaux : Encre `#0A0A0A` (extrablold pour les titres).
  - Couleur de marque : Émeraude `#10B981` (pour le logo et les accents).
  - Surlignage (Highlight) : Jaune Soleil `#FFD83D`.
  - **Bordure** : Toujours encadrer l'image complète avec une bordure noire de 8px (`border: '8px solid #0A0A0A'`).
- **Logo** : Utiliser la structure SVG exacte du symbole `Elearn Prepa` (le livre avec la courbe et le point), sans texte additionnel dans le carré vert.
- **Positionnement des éléments flottants** : Les badges/tags d'information (ex: "Paiement sécurisé" ou "Code Promo") doivent être placés en **Haut à Droite** (`top: 80px, right: 80px`) pour éviter que WhatsApp ou d'autres messageries ne les coupent avec leurs interfaces superposées en bas de l'aperçu.
- **Limitation technique (Satori)** : Satori ne supporte pas bien les balises `<span>` en ligne (inline) avec des `margin` ou `padding` à l'intérieur d'un `<p>`, surtout quand le texte est multiligne. Cela crée des chevauchements de texte (bugs de rendu). **Solution** : Toujours utiliser des colonnes et des conteneurs Flex (`display: 'flex'`) propres pour séparer les éléments visuels, sans abuser des marges internes dans les textes continus.
