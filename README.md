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

## Organisation

- `src/app/` : écrans (Expo Router). Uniquement des routes.
- `src/components/` : composants du design system (Bouton, Carte, Bannière, Étiquette, OptionRéponse, Champ).
- `src/theme/` : jetons de design (`theme.ts`, issu du guide de design) et `ThemeProvider` (Clair, Sombre, Système).
- `src/i18n/` : tous les textes de l'interface, en français pour l'instant.

Les écrans n'utilisent que `theme.*` et les composants, jamais une couleur en dur. Plan de développement : phases 0 à 6, voir le document du projet.
