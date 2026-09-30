# Design system

Source de vérité : fichier Figma « Elearn Prepa 2 · Design System & App » (https://www.figma.com/design/GzCvMxp4YpqafQufUJ6xI8, équipe perso de Benny, plan Starter), guide HTML (https://claude.ai/artifact/WJ2imvM8cRF4t4uuVL9geN), tokens `design/theme.ts`, sons `design/sons/` (dossier partagé du projet). Dans ce dépôt : `src/theme/theme.ts` (repris de `design/theme.ts`), `src/theme/ThemeProvider.tsx`, `src/components/`, `assets/sounds/`.

Suivi design (tâches, blocages) : `/mnt/project-files/suivi/design.md`. Le dev le lit avant de coder un écran ; il ne l'écrit pas.

## Style : néo-brutal doux

Bordure 2 px, ombre **dure** de 4 px (sans flou), rayons 6 / 10 / 14. Couleurs : émeraude `#10B981` + encre + papier crème. Polices : Archivo Black (titres), Space Grotesk (texte), Space Mono (étiquettes, données). **Texte toujours noir sur l'émeraude.** Contrastes AA (un test `contraste.test.ts` le vérifie).

Six principes du guide : résultat avant le compte ; clair comme un cahier ; la couleur a un sens (vert = action/réussite, jaune = à retenir, orange = attention, corail = erreur, bleu = information) ; léger, rapide, hors ligne ; honnête et bienveillant (pas de faux compte à rebours ni de fausse progression, limite gratuite dite avec calme) ; complice pour l'élève (tutoiement), rassurant pour le parent (vouvoiement, preuves, reçus).

Logo : aplat émeraude, bordure noire, jamais de dégradé ni d'ombre floue ; écrire « Elearn Prepa » (deux mots). Dans l'app, utiliser le composant `Logo`.

## Règles de code pour les écrans

1. **Couleurs uniquement via `theme.*`** (jamais de valeur en dur ni la palette brute). Le thème suit Clair / Sombre / Système. Tout écran existe en clair **et** en sombre.
2. **Tout écran avec saisie passe par `Ecran`** (`src/components/Ecran.tsx`) : `KeyboardAvoidingView` (comportement `padding`, y compris Android en edge-to-edge SDK 57), `ScrollView` avec `keyboardShouldPersistTaps="handled"`, défilement vers le champ actif, insets haut/bas (`insetBas={false}` dans les onglets, `pied` pour un bouton fixe au-dessus du clavier). Ne jamais poser un `TextInput`/`Champ` directement dans une `View`.
3. **Barre d'état et barre de navigation Android colorées selon le thème** sur tous les écrans (`BarresSysteme` à la racine : `expo-status-bar`, `expo-system-ui`). Le réglage de thème manuel aligne le mode nuit du système via `Appearance.setColorScheme` : **jamais `null`/`undefined`**, utiliser `'unspecified'` (crash Android du 30/09).
4. **Sons, vibrations et mouvement uniquement via `useFeedback()`** (`src/components/useFeedback.ts`) : `declencher(moment)` avec `select`, `success`, `error`, `confirm`, `arrive`, `celebrate`, `streak`, `reward`, `paid`, `problem`, `timerWarning`, `timerEnd`. Aucun écran n'appelle `expo-audio` ou `expo-haptics` directement.
5. **Réduire les animations** : respecter `useReduireAnimations` (réglage système OU interrupteur de l'app) : état final direct, sans mouvement ample ; le retour son/vibration reste selon les préférences.
6. **Durées** : appui 120 ms, standard 200 ms, feuille 300 ms (`theme.mouvement`). Pas de Lottie : animations Reanimated 4 (`Appui`, `Apparition`, `Secousse`, `Rebond`).
7. **Cibles tactiles ≥ 48** (`cibleMin`). Espace insécable avant `? ! : ;` dans les textes français.
8. **Textes d'interface jamais en dur** : `t('cle')` (`src/i18n/fr.ts` référence, `en.ts` mêmes clés ; un test compare les arbres).
9. **Icônes** : icône iOS carrée pleine (le système arrondit) ; icône adaptative Android dans la zone de sécurité de 66 % sur fond émeraude.
10. Ombre dure sur Android : `elevation` floute, donc dessiner l'ombre avec une vue décalée derrière.

## Composants

Bouton, Carte, Bannière, Étiquette, OptionRéponse, Champ (les 6 premiers du design), plus Appui, Apparition, Secousse, Rebond, Interrupteur, Onglet, Visite (visite guidée `@wrack/react-native-tour-guide`), EcranVide, ErrorBoundary, FeuilleMiseAJour, Logo, `FormulaireCompte`, `BoutonsSociaux`, `ParcoursArrivee`. Un composant n'invente pas de style : il lit `theme.*`.

## Sons (M16)

11 sons MP3 mono 64 kb/s, ~120 Ko au total (limite 300 Ko), **licence CC0 1.0**, synthétisés le 30/09/2026 (générateur `generer_sons.py` dans le dossier partagé `design/sons/src/`). Fichiers dans `assets/sounds/` : clic, bonne-reponse, erreur, validation, correction-prete, fin-mission, serie, recompense, paiement-reussi, alerte-chrono, fin-epreuve. Carte moment → son + haptique : `retours` dans `src/theme/theme.ts`. Le son de `select` est désactivé par défaut. Aucun son pour réseau/paiement échoué/quota (bannière + vibration légère). **Aucun son pendant une épreuve chronométrée** sauf alerte des 5 dernières minutes et fin.

Limites connues : Android ne détecte pas le mode silencieux (le son suit le volume média) ; vérifier sur appareil.

Préférences : Sons, Vibrations, Animations réduites, mémorisées en AsyncStorage (`retours.preferences`, aussi en invité) ; écran `src/app/parametres.tsx`. Synchronisation avec le profil : à faire (M16-03).

## Parcours du design (guide, 48 écrans)

Parcours A (arrivée), B (aide par photo), C (mission et accueil), D (annales), E (offres et paiement), F (parent, web), G, H (profil, réglages, classes H6–H7, enseignant H8–H11, classement H12, Sons H2b). Aperçus PNG : `design/apercus-figma/` et captures de l'app : `app/apercus/` (dossier partagé).

## Reste à dessiner (quota Figma remis à zéro le 1er octobre 2026)

Retouches (B1 appareil photo en sombre, E1 « 0 FCFA », insécables), classes élève, enseignant, classement + confidentialité + Sons (H2b), états plein écran, Offres iOS, M15 (jauge, palier, parrainage, « Comment gagner des récompenses »), page ③ handoff, site web. Le guide contient déjà des aperçus HTML pour les sections 11 à 15 : les utiliser pour coder sans attendre Figma.

Règles Figma Starter : 20 appels `use_figma` par mois (remis à zéro le 1er), 3 pages par fichier, 1 mode de variable ; le MCP Figma ne supprime pas de fichiers ; aucune suppression ni dépense sans accord de Benny.
