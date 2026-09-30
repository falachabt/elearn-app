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
- `src/components/` : composants du design system (Bouton, Carte, Bannière, Étiquette, OptionRéponse, Champ, Appui, Apparition, Secousse, Rebond, Visite).
- `src/theme/` : jetons de design (`theme.ts`, issu du guide de design) et `ThemeProvider` (Clair, Sombre, Système).
- `src/i18n/` : tous les textes de l'interface (voir « Langues » ci-dessous).

## Langues

Français par défaut, anglais disponible (i18next + react-i18next + expo-localization). `src/i18n/fr.ts` est la référence et définit le type `Textes` ; `en.ts` doit avoir exactement les mêmes clés (un test compare les deux arbres). La langue de l'appareil est détectée au démarrage, avec repli sur `fr` pour toute langue non prise en charge, et toute clé manquante retombe sur le français.

Dans un composant : `const { t } = useTraduction();` (alias `useT`) puis `t('accueil.titre')` ; les clés sont typées (`CleTexte`). Jamais de texte d'interface en dur. `changerLangue('en')` bascule à chaud. Ajouter une langue : créer `<code>.ts` typé `Textes`, l'inscrire dans `src/i18n/index.ts`. Le choix manuel de la langue n'est pas encore mémorisé (écran Moi, plus tard).

## Modules natifs

Tout le natif est embarqué dès le premier build EAS ; les mises à jour OTA suivantes ne touchent que le JavaScript. Ajouter un module natif plus tard impose un nouveau build. Versions posées par `npx expo install` (SDK 57).

- Caméra et photo de question : `expo-camera`, `expo-image-picker`, `expo-image`, `expo-image-manipulator`. Micro bloqué (`RECORD_AUDIO`).
- Notifications : `expo-notifications` (icône blanche 96x96, couleur émeraude `#10B981`, son `assets/sounds/notification.wav`, canal `default`), `@react-native-community/datetimepicker` (heure des rappels).
- Connexion : `expo-secure-store`, `expo-web-browser`, `expo-auth-session`, `expo-crypto`, `expo-apple-authentication`. Auth Supabase, Google via `expo-auth-session` + `expo-web-browser` (OAuth Supabase) : `@react-native-firebase/*` n'est pas ajouté (pas nécessaire ; si un jour les notifications push passent par FCM natif, les clés `google-services.json` se gèrent côté EAS).
- Partage et retours : `expo-sharing`, `expo-clipboard`, `expo-haptics`.
- Médias : `expo-video`, `expo-audio` (sons de bonne/mauvaise réponse ; remplace `expo-av`, déprécié), `expo-asset` (pair d'`expo-audio`).
- Documents : `expo-document-picker`, `expo-file-system`, `react-native-pdf` + `react-native-blob-util` (lecteur PDF natif uniquement : à charger dans un fichier `.native.tsx`, prévoir un `.web.tsx` avec `<iframe>` pour ne pas casser le web).
- Animations, gestes, rendu : `react-native-reanimated` 4, `react-native-worklets` (prérequis de Reanimated 4), `react-native-gesture-handler`, `react-native-svg`, `expo-linear-gradient`, `expo-blur`, `expo-system-ui`, `@gorhom/bottom-sheet`.
- Composants d'animation (`src/components/`, `react-native-reanimated` 4 + `react-native-worklets` ; plugin Babel ajouté automatiquement par `babel-preset-expo`, `GestureHandlerRootView` à la racine de `src/app/_layout.tsx`) : `Appui` (wrapper pressable, s'enfonce de 2 à 4 px, l'ombre dure se réduit, retour sec en ressort ; utilisé par `Bouton`), `Apparition` (entrée en glissant avec court rebond, délai échelonné via `delai` ; utilisé sur l'accueil), `Secousse` (erreur : secousse horizontale franche, déclenchée par `declencheur`), `Rebond` (succès : pop avec overshoot). Tous respectent « Réduire les animations » via `useReduireAnimations` : état final direct, sans mouvement.
- Visite guidée : `@wrack/react-native-tour-guide` 2.x (composants `VisiteProvider` à la racine et hook `useVisite().demarrer(etapes)` dans `src/components/Visite.tsx`, couleurs du thème clair/sombre et textes traduits). Choisie parce que c'est celle de l'ancienne app (mêmes habitudes), la seule des candidates encore maintenue (publiée en août 2026, contre 2024-2025 pour `react-native-copilot`, `rn-tourguide`, `react-native-spotlight-tour`, `react-native-walkthrough-tooltip`), sans module natif propre (JS pur, seul pair requis : `react-native-svg`, déjà là ; les autres pairs sont optionnels), compatible Nouvelle Architecture / RN 0.86 et web, avec thèmes (`createTheme`) et `expo-doctor` propre.
- Contenu : `react-native-webview` (formules mathématiques).
- Sécurité : `expo-screen-capture` (l'ancienne app bloquait la capture sur les manuels payants).
- Build : `expo-build-properties` (SDK 36, réduction de code en release), plugins locaux `plugins/withAndroid16KBPageSize.js` (Google Play, pages de 16 Ko) et `plugins/withBlockMediaPermissions.js` (retire `READ_MEDIA_*`, refusé par Google Play : le sélecteur de photos système suffit).
- Déjà présents : `expo-linking` (schéma `elearnprepa`), `expo-updates`, `expo-dev-client`, `expo-localization`, etc.

Écartés (redondants ou remplacés) : `lottie-react-native` (animations Lottie hors du thème néo-brutal ; à reconsidérer plus tard), `antd` / `@ant-design/icons-react-native` (design system maison), `nativewind` (thème maison), `axios` (fetch), `swr` (état serveur à venir via Supabase), `@amplitude/*` (PostHog), `@react-navigation/*` direct (Expo Router), `firebase` / `@react-native-firebase/*` (Supabase), `expo-av` (→ expo-video + expo-audio), `react-native-video` (→ expo-video), `react-native-modal` (→ bottom-sheet), `react-native-animatable`, `react-native-swipe-gestures` (→ gesture-handler), `react-pdf`, `mathlive`, `react-native-katex` (→ webview), `expo-random` (→ expo-crypto), `expo-symbols`, `@google/generative-ai`, `@legendapp/state`.

Limites : le lien de domaine (Universal Links / App Links) n'est pas configuré faute de domaine connu : à ajouter (`ios.associatedDomains`, `android.intentFilters`) avec un build. `react-native-pdf` et `@gorhom/bottom-sheet` n'ont pas été exercés sur appareil avec RN 0.86 ; l'export Android ne vérifie que les modules importés par le code. `npm ci` passe sans `.npmrc` (pas de `legacy-peer-deps`).

## Images et logo

Les images de l'app sont dans `assets/images/` (icône iOS 1024 carrée pleine sans coins arrondis (le système applique le masque), icône adaptative Android avant-plan + monochrome dans la zone de sécurité de 66 % sur fond émeraude `#10B981` défini dans `app.json`, splash logo plat clair/sombre, favicon, icône de notification blanche 96x96, logos). Elles sont fabriquées depuis le kit de marque par `node scripts/fabriquer-assets.mjs [--kit dossier] [--apercu [fichier.png]]` (`--apercu` écrit l'aperçu sous masques rond et squircle, par défaut `/mnt/project-files/app/apercus/icones-apercu.png`) (Chromium via Playwright, le kit n'est jamais modifié). Dans l'app, utiliser le composant `Logo` (`variante` symbole ou horizontal ; la version horizontale suit le thème clair/sombre).

## Rangement des tests

Règle de Benny : quand un dossier (`src/services`, `src/session`, `src/components`, …) contient beaucoup de fichiers, les tests vont dans un sous-dossier `__tests__` du même dossier, nommés `<fichier>.test.ts(x)`, et importent le code avec `../`. Jest ne lance que `**/__tests__/**/*.test.[jt]s(x)` (voir `jest.testMatch` dans `package.json`) ; un test placé ailleurs est donc ignoré. Pas de test dans `src/app/` (uniquement des routes).

Les écrans n'utilisent que `theme.*` et les composants, jamais une couleur en dur. Plan de développement : phases 0 à 6, voir le document du projet.

## Prévisualisation et mises à jour OTA (EAS)

Le projet Expo est `@ezardive/elearn_mobile` (celui de l'ancienne app, identifiant `com.ezadrive.elearn`). Canal de la nouvelle app : `preview` (la prod reste sur `production`). Les variables `EXPO_PUBLIC_*` viennent de l'environnement EAS `preview`.

- Chaque push sur `main` ou `claude/project-thread-cvknuk` publie une mise à jour OTA sur le canal `preview` (workflow `eas-preview.yml`).
- Premier build installable : Actions > EAS preview > Run workflow, cocher « build ». Installer l'APK, puis les mises à jour arrivent seules.
- Prérequis : secret de dépôt `EXPO_TOKEN`.

Premier build de prévisualisation (Android, APK, canal `preview`) lancé le 30/09/2026.

## Mise à jour OTA (feuille de mise à jour)

`src/services/miseAJour.ts` (hook `useMiseAJour()`) vérifie `Updates.checkForUpdateAsync` au démarrage et à chaque retour au premier plan (désactivé en `__DEV__`, sur le web et si `expo-updates` est inactif ; une erreur de simple vérification reste silencieuse). États : `aucune`, `disponible`, `telechargement`, `prete`, `erreur`. `installer()` télécharge (`fetchUpdateAsync`) puis redémarre (`reloadAsync`) ; en cas d'échec, l'état `erreur` propose « Réessayer ». `plusTard()` masque la proposition jusqu'à la prochaine ouverture de l'app. Le composant `MiseAJour` (monté dans `src/app/_layout.tsx`) affiche `FeuilleMiseAJour` : un bottom sheet (`@gorhom/bottom-sheet`) avec « Mettre à jour » / « Plus tard » et une barre de téléchargement. Textes : clés `miseAJour.*` (fr et en).

**Mise à jour obligatoire.** Convention : l'update est obligatoire si son manifeste porte un drapeau `obligatoire`, soit `expo.extra.obligatoire: true` dans la config au moment du `eas update` (le client le lit dans `manifest.extra.expoClient.extra.obligatoire`), soit un message d'update commençant par `[obligatoire]` quand le serveur le fournit dans les métadonnées du manifeste. Dans ce cas, plus de « Plus tard » : un écran plein écran reste affiché jusqu'à l'installation. `expo.extra.obligatoire` est désormais calculé par `app.config.ts` (qui complète `app.json`, sans toucher au natif : ni `runtimeVersion` ni plugins) : `process.env.UPDATE_OBLIGATOIRE === '1'`. Dans le workflow `eas-preview.yml`, l'étape de publication OTA pose `UPDATE_OBLIGATOIRE=1` quand le message du commit (titre ou corps) contient `[obligatoire]`, sinon `0` : **ajoute `[obligatoire]` dans le message du commit pour forcer l'installation**. Rien à éditer ni à remettre à `false` ensuite. En local : `UPDATE_OBLIGATOIRE=1 eas update ...` ; vérification : `UPDATE_OBLIGATOIRE=1 npx expo config --json`. Le message EAS seul n'est pas fiable (EAS ne le renvoie pas au client) : préférer le drapeau `extra`.

Aperçu sans appareil : route cachée `src/app/(dev)/mise-a-jour.tsx` (`/mise-a-jour?etat=disponible|telechargement|erreur|prete&obligatoire=1`), accessible seulement si `__DEV__` ou `EXPO_PUBLIC_APERCU=1` (sinon redirection vers l'accueil). `node scripts/apercu-mise-a-jour.mjs [--sortie dossier] [--port 4174] [--sans-build]` exporte le web avec `EXPO_PUBLIC_APERCU=1` dans `dist-apercu/` et capture chaque état en clair et en sombre (`maj-<etat>-<clair|sombre>.png`, par défaut dans `/mnt/project-files/app/apercus/`).
