# Architecture Expo, EAS, OTA et CI

Lire aussi `AGENTS.md` (règles Expo) et `README.md` (très détaillé, sur la branche de dev). **Expo change à chaque SDK : lire la doc versionnée** `https://docs.expo.dev/versions/v57.0.0/` et `https://docs.expo.dev/llms.txt`, jamais la mémoire.

## Stack

Expo SDK **57**, React Native **0.86**, React 19.2, Expo Router (routes uniquement dans `src/app/`), TypeScript, Reanimated 4 + worklets, Supabase JS v2, PostHog (`posthog-react-native`), i18next, `@gorhom/bottom-sheet`, `expo-updates`. Installer avec `npx expo install <paquet>` (jamais `npm add`). Écartés : Lottie, antd, nativewind, axios, firebase, expo-av, react-native-modal, etc. (liste dans le README). Pas de dossiers `ios/` `android/` (génération native continue : configurer dans `app.json` et plugins ; plugins locaux dans `plugins/`).

Arborescence : `src/app/` (écrans : `(accueil)` parcours d'arrivée, `(onglets)`, `compte/`, `rejoindre/[code]`, `parametres`, `(dev)/mise-a-jour`), `src/components/`, `src/services/` (supabase, session, compte, parrainage, retours, analytics, evenements, miseAJour, profil…), `src/session/`, `src/theme/`, `src/i18n/`, `src/contenu/`. Tests dans des sous-dossiers `__tests__` (Jest ne lance que `**/__tests__/**/*.test.[jt]s(x)`).

## Identité et EAS

- Identifiant : `com.ezadrive.elearn` (celui de l'ancienne app), schéma de lien `elearnprepa://`, version 3.0.0.
- Projet Expo : `@ezardive/elearn_mobile` (celui de l'ancienne app : le slug reste `elearn_mobile`). Canal de la nouvelle app : **`preview`** (`production` est réservé à l'ancienne app jusqu'au lancement).
- `runtimeVersion` : politique `appVersion` (= version de l'app, 3.0.0). **Une OTA ne peut atteindre que les binaires de même runtimeVersion.** Toute modification de bibliothèque native (ajout d'un module, changement de plugin, `app.json` natif) impose un **nouveau build**, pas une OTA. Changer la version de l'app = nouveau runtimeVersion = les anciens APK ne reçoivent plus d'OTA.
- Variables `EXPO_PUBLIC_*` : environnement EAS `preview`. Noms : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **anon** publique seulement), `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_APERCU`. Jamais de valeur dans le dépôt (`.env.example` ne contient que des modèles).
- Secret de dépôt GitHub : `EXPO_TOKEN` (valeur jamais lue ni recopiée).

## CI (GitHub Actions)

- `Contrôles` (`ci.yml`) : `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --ci`, sur PR et push `main`.
- `EAS preview` (`eas-preview.yml`) : à chaque push sur `main` ou sur une branche de travail listée, publie une **OTA sur le canal `preview`**. Job `verifier` obligatoire avant (`ota` en dépend) : Jest, typage, `expo export --platform android` (bundle Metro + Hermes) et contrôle que le bundle `.hbc` fait plus de 1 Mo. S'il échoue, **aucune OTA n'est publiée**.
- `[obligatoire]` dans le message d'un commit (titre ou corps) → mise à jour **obligatoire** (`extra.obligatoire` via `app.config.ts`, écran plein écran chez le testeur). `[build]` → lance aussi un **build Android APK** (coût EAS) : ne l'écrire que si voulu. Premier APK preview installé par Benny le 30/09.
- Les nouvelles branches de travail doivent être ajoutées à la liste `branches:` de `eas-preview.yml` pour publier des OTA.
- **Ne pas lancer de build via le MCP Expo** : il a lancé un build de l'ancienne app (SDK 54). Passer par GitHub Actions. Le budget d'usage Expo n'a pas pu être créé : tout build supplémentaire est une dépense à cadrer avec Benny.
- Valider tout YAML de workflow avant de pousser (`python3 -c "import yaml; yaml.safe_load(open(f))"`) : des éditions scriptées ont déjà cassé le workflow.

## Mise à jour dans l'app

`useMiseAJour()` (`src/services/miseAJour.ts`) : vérifie au démarrage et au retour au premier plan, états `aucune/disponible/telechargement/prete/erreur`, feuille `FeuilleMiseAJour` (« Mettre à jour » / « Plus tard »), écran obligatoire si drapeau. Aperçu sans appareil : route cachée `/mise-a-jour?etat=…` (seulement `__DEV__` ou `EXPO_PUBLIC_APERCU=1`).

## Pièges rencontrés

1. **Crash au démarrage (OTA du 30/09)** : `Appearance.setColorScheme(null)` plante Android. Le typage le signalait, masqué par un `@ts-expect-error`. Correctif `'unspecified'`, règle lint contre `ts-expect-error`/`ts-ignore` hors tests et test garde-fou `src/__tests__/garde-natif.test.tsx`. **Jest ne voit pas les crashs natifs : après chaque OTA, ouvrir l'app sur le téléphone.** Un émulateur en CI a été refusé par Benny (20–30 min par push, fragile). Ne pas compter sur la récupération automatique d'expo-updates.
2. Workflow EAS invalide après édition scriptée (voir ci-dessus).
3. MCP Expo a buildé la mauvaise app.
4. `git stash` efface le travail d'un agent concurrent ; `pkill -f` peut tuer son propre shell.
5. Android : pas de détection du mode silencieux pour les sons.
6. Lien universel (Universal/App Links) non configuré faute de domaine : à faire avec un prochain build (`ios.associatedDomains`, `android.intentFilters`).
7. `react-native-pdf` et `@gorhom/bottom-sheet` pas encore exercés sur appareil avec RN 0.86.
8. Projets Vercel de l'ancienne app qui échouent au build : à traiter.

## Commandes

`npm ci` · `npm test -- --ci` · `npm run typecheck` · `npm run lint` · `npx expo start` · `npx expo-doctor` · `node scripts/verifier-session-locale.mjs` (vérification de bout en bout contre Supabase **local**, captures clair/sombre ; refuse de tourner si l'URL n'est pas locale) · `node scripts/fabriquer-assets.mjs` (icônes depuis le kit de marque) · `node scripts/apercu-mise-a-jour.mjs`.
