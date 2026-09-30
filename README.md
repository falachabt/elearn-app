# Elearn Prepa — nouvelle app

Application Expo (Android, iOS, web) d'Elearn Prepa, version 3. Elle remplace `elearn_mobile` et reprend le même identifiant d'application (`com.ezadrive.elearn`) et la même base Supabase (dépôt `elearn-supabase`).

## Démarrer

```bash
npm install
npx expo start        # puis a (Android), i (iOS) ou w (web)
npm run typecheck
npm run lint
npm test
```

Configuration Supabase : copier `.env.example` vers `.env.local` et renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé anon uniquement). Sans elles, l'app démarre et la session invité signale une erreur claire.

## Vérifier la session invité contre Supabase local

Avec le Supabase local de `elearn-supabase` démarré (`npx supabase start`, `enable_anonymous_sign_ins = true` dans `supabase/config.toml`) et un `.env.local` pointant vers `http://127.0.0.1:54321` avec la clé anon locale (`npx supabase status -o env`) :

```bash
node scripts/verifier-session-locale.mjs [--sortie dossier] [--port 4173] [--sans-build]
```

Le script exporte l'app web, la sert en statique, l'ouvre dans Chromium (Playwright, navigateur déjà installé, `PW_CHROMIUM` pour le chemin), vérifie via `docker exec psql` qu'un utilisateur `is_anonymous = true` est créé dans `auth.users`, puis capture Accueil, Réviser et Moi en clair et en sombre (`local-<ecran>-<clair|sombre>.png`, par défaut dans `/mnt/project-files/app/apercus/`). Il refuse de tourner si l'URL Supabase n'est pas locale.

## Organisation

- `src/app/` : écrans (Expo Router). Uniquement des routes.
- `src/components/` : composants du design system (Bouton, Carte, Bannière, Étiquette, OptionRéponse, Champ).
- `src/theme/` : jetons de design (`theme.ts`, issu du guide de design) et `ThemeProvider` (Clair, Sombre, Système).
- `src/i18n/` : tous les textes de l'interface (voir « Langues » ci-dessous).

## Langues

Français par défaut, anglais disponible (i18next + react-i18next + expo-localization). `src/i18n/fr.ts` est la référence et définit le type `Textes` ; `en.ts` doit avoir exactement les mêmes clés (un test compare les deux arbres). La langue de l'appareil est détectée au démarrage, avec repli sur `fr` pour toute langue non prise en charge, et toute clé manquante retombe sur le français.

Dans un composant : `const { t } = useTraduction();` (alias `useT`) puis `t('accueil.titre')` ; les clés sont typées (`CleTexte`). Jamais de texte d'interface en dur. `changerLangue('en')` bascule à chaud. Ajouter une langue : créer `<code>.ts` typé `Textes`, l'inscrire dans `src/i18n/index.ts`. Le choix manuel de la langue n'est pas encore mémorisé (écran Moi, plus tard).

## Images et logo

Les images de l'app sont dans `assets/images/` (icône iOS 1024 opaque, icône adaptative Android avant-plan + monochrome sur fond émeraude `#10B981` défini dans `app.json`, splash clair/sombre, favicon, logos). Elles sont fabriquées depuis le kit de marque par `node scripts/fabriquer-assets.mjs [--kit dossier]` (Chromium via Playwright, le kit n'est jamais modifié). Dans l'app, utiliser le composant `Logo` (`variante` symbole ou horizontal ; la version horizontale suit le thème clair/sombre).

## Rangement des tests

Règle de Benny : quand un dossier (`src/services`, `src/session`, `src/components`, …) contient beaucoup de fichiers, les tests vont dans un sous-dossier `__tests__` du même dossier, nommés `<fichier>.test.ts(x)`, et importent le code avec `../`. Jest ne lance que `**/__tests__/**/*.test.[jt]s(x)` (voir `jest.testMatch` dans `package.json`) ; un test placé ailleurs est donc ignoré. Pas de test dans `src/app/` (uniquement des routes).

Les écrans n'utilisent que `theme.*` et les composants, jamais une couleur en dur. Plan de développement : phases 0 à 6, voir le document du projet.
