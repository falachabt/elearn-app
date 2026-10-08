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
- **La validation se fait en local, pas sur le CI.** Les runners distants sont mis en file d'attente et ne servent plus de retour rapide : on valide tout ici, puis on déploie.
- **Une seule commande** : `npm run valider` enchaîne le typage, Jest en série et l'export Android + Hermes. Elle reproduit exactement le job `verifier` du workflow `EAS preview`, qui est la barrière avant toute publication OTA.
- Équivalent manuel, dans cet ordre : `npm run typecheck`, puis `npm test -- --runInBand`, puis `npm run export:android`.
- Le hook `.githooks/pre-push` rejoue typage + Jest (`--runInBand`) avant chaque push. L'activer une fois par clone : `git config core.hooksPath .githooks`.

## 4. Design System & Interfaces (UI)
- Avant de créer ou de mettre à jour une interface utilisateur, tu **dois obligatoirement te référer** aux fichiers du Design System présents dans le dossier docs/ (notamment docs/Design system Elearn Prepa.md).
- Respecte scrupuleusement les tokens sémantiques (couleurs, typographie, espacements).

## 5. Mise à jour des consignes
- Si je te donne de nouvelles règles ou consignes de travail en cours de session, **tu as la consigne de mettre à jour ce fichier AGENTS.md** toi-même pour t'en souvenir lors de nos futures sessions.

## 6. Liens importants
- **Site web officiel** : https://elearnprepa.com (à utiliser pour toutes les redirections ou actions "site web").

## 7. Mémoire Globale du Projet
- Pour le contexte global, l'avancement et l'historique, réfère-toi au fichier central : docs/MEMOIRE_PROJET.md.

## 8. Règles de Build Web (`elearn-site`)
- **Vercel très strict (ESLint)** : Le compilateur Next.js sur Vercel bloque le déploiement au moindre avertissement ESLint grave (apostrophes non échappées comme `l'accès` au lieu de `l&apos;accès`, variables non utilisées dans les `catch`, etc.).
- **Vérification avant Push** : Toujours exécuter `npm run build` ou `npx tsc --noEmit` en local dans le dossier `elearn-site` pour corriger les erreurs TS/ESLint avant de pousser sur `main`.

## 9. Génération d'Images Open Graph (OG)
- **Outil** : Utiliser `next/og` (`ImageResponse`) dans Next.js.
- **Design System** :
  - Fond : Crème `#FFF7E3`.
  - Textes principaux : Encre `#0A0A0A` (extrablold pour les titres).
  - Couleur de marque : Émeraude `#10B981` (pour le logo et les accents).
  - Surlignage (Highlight) : Jaune Soleil `#FFD83D`.
  - **Bordure** : Toujours encadrer l'image complète avec une bordure noire de 8px (`border: '8px solid #0A0A0A'`).
- **Logo** : Utiliser la structure SVG exacte du symbole `Elearn Prepa` (le livre avec la courbe et le point), sans texte additionnel dans le carré vert.
- **Positionnement des éléments flottants** : Les badges/tags d'information (ex: "Paiement sécurisé" ou "Code Promo") doivent être placés en **Haut à Droite** (`top: 80px, right: 80px`) pour éviter que WhatsApp ou d'autres messageries ne les coupent avec leurs interfaces superposées en bas de l'aperçu.
- **Limitation technique (Satori)** : Satori ne supporte pas bien les balises `<span>` en ligne (inline) avec des `margin` ou `padding` à l'intérieur d'un `<p>`, surtout quand le texte est multiligne. Cela crée des chevauchements de texte (bugs de rendu). **Solution** : Toujours utiliser des colonnes et des conteneurs Flex (`display: 'flex'`) propres pour séparer les éléments visuels, sans abuser des marges internes dans des textes continus.

## 10. SEO & Métadonnées (`elearn-site`)
- **Pages Publiques** : Lors de la création d'une nouvelle page publique (dans `(vitrine)` ou `(public)`), il est **obligatoire** d'exporter un objet `metadata` (ou la fonction `generateMetadata`) contenant au minimum un `title` et une `description` spécifiques au contenu de la page.
- **Images Open Graph** : Ne pas définir manuellement la propriété `images` pour les pages statiques (Next.js utilise automatiquement `opengraph-image.png` du layout global). Les images OG dynamiques (`next/og`) ne doivent être créées que pour les pages dont le contenu varie fortement (ex: liens de partage avec codes promo ou prénoms dynamiques).

## 11. Build et Mises à Jour EAS (`elearn-app`)
- EAS construit, signe et soumet l'app dans le cloud (`eas build`, `eas submit`) et publie les mises à jour à chaud (`eas update`), sans Xcode ni Android Studio en local.
- CLI : `bunx eas-cli <commande>` en projet Bun, sinon `npx eas-cli@latest <commande>` (remplacer tout `eas` seul des exemples de la documentation).
- Documentation : https://docs.expo.dev/eas/index.md
- Si `ios/` et `android/` n'existent pas, ils sont générés (Continuous Native Generation) : ne jamais les créer ni les modifier à la main, la configuration native passe par `app.json` et les config plugins.
- Expo Go n'embarque que ses modules natifs : après l'ajout d'une librairie avec du code natif, il faut un development build (`npx expo run:ios|android` en local, ou `eas build --profile development`).
- Préférer les modules Expo recommandés aux librairies tierces, et vérifier les skills disponibles avant d'ajouter une dépendance : https://docs.expo.dev/versions/latest/index.md

## 12. Écrans avec saisie (`elearn-app`)
- Tout écran avec saisie (`Champ`, `TextInput`) passe par le conteneur `Ecran` (`src/components/Ecran.tsx`) : clavier, défilement, insets et fond du thème. Ne jamais poser un `TextInput` directement dans une `View`/`ScrollView` d'écran. Voir README, « Écrans avec saisie ».

## 13. Git & Déploiement (`elearn-app`)
- **NE JAMAIS PUSHER DIRECTEMENT SUR LA BRANCHE `main`**.
- La branche de travail et de déploiement EAS Update de l'app mobile est **`claude/project-thread-kw792g`**. Toutes les fonctionnalités et modifications de l'app mobile y sont poussées (ou font l'objet d'une PR).
- Un push sur cette branche déclenche le workflow `Contrôles et EAS preview` (`.github/workflows/eas-preview.yml`, un seul job) : typage, ESLint, tests Jest et export Hermes, puis publication OTA sur le canal `preview` uniquement si tous les contrôles passent.
- **Quand les runners GitHub sont indisponibles** (file d'attente), on déclenche l'OTA et le build **depuis cette machine** : `npx --yes eas-cli@latest update --platform android --channel preview --environment preview --non-interactive` pour l'OTA, et `... build --platform android --profile preview --non-interactive` pour l'APK. La session EAS est déjà valide dans cet espace de travail. Valider en local (`npm run valider`) **avant**, puisque plus rien ne sert de barrière distante.
- **Après l'ajout d'un module natif**, incrémenter `version` dans `app.json` : `runtimeVersion` en dérive (aucun n'est défini explicitement), donc les binaires plus anciens ne reçoivent pas l'OTA qui les casserait. Un nouveau build natif reste nécessaire pour que le module existe.
- **Ne jamais committer de fichier `.env`** : les secrets de ce dépôt public ont déjà fuité une fois. Utiliser `.env.local` (ignoré) ou les secrets EAS.

## 14. Mode concis (skill caveman)
Le skill `.claude/skills/caveman` réduit la consommation de tokens. Il s'applique aux échanges internes et aux journaux des agents. Les messages à Benny (clairs, en français), le code, les commits, les descriptions de PR et le README restent normaux.

## 15. Contraintes d'exécution (session sandbox Windows)
- **Jest doit tourner avec `--runInBand`** : sans ce drapeau, les workers de Jest échouent avec `spawn EPERM` (le bac à sable interdit les pipes nommés). `npm test -- --runInBand`.
- Ne pas faire passer la sortie de `npx jest` par un pipe PowerShell (`| Select-Object`) : le pipe ne se ferme qu'à la fin du run et masque le résultat pendant plusieurs minutes. Lire la sortie directement.
- Le bac à sable refuse `Remove-Item`, `Set-Content` et `Move-Item` dans le dépôt (accès refusé) : utiliser les outils d'édition de fichiers, et vider un fichier plutôt que le supprimer.

## 16. Connectivité et mode hors ligne (issue #25, issue #13)
- L'état de connexion est centralisé dans `src/services/connectivite.ts` : `lireConnectivite()` pour les services, `ecouterConnectivite()` pour l'interface, `sonder()` pour vérifier que le serveur répond vraiment.
- **Aucun module natif n'est indispensable à la connectivité.** La sonde serveur (`GET /auth/v1/health` **avec la clé publique**, pour obtenir un vrai 200 et non un 401 trompeur) reste la **seule source de vérité**, avec `signalerEchec()` / `signalerSucces()` / `signalerActivite()` qu'une action ou un écran appelle selon le résultat réel de sa requête.
- **`expo-network` sert uniquement à déclencher une sonde**, pour réagir en moins d'une seconde à un changement d'interface réseau. Il ne décide jamais de l'état : une interface active ne prouve pas que le serveur répond. Il doit être chargé par `requireOptionalNativeModule`, **jamais par un import direct** (voir §17), et le code doit continuer de fonctionner sans lui (repli par sondage).
- **La cadence de sonde est dégressive, jamais fixe et rapide.** `DELAIS_REESSAI_MS` (2 s → 60 s) pendant une coupure, et `INTERVALLE_EN_LIGNE_MS` (10 s, filet de sécurité sans évènements réseau) quand tout va bien. Une sonde coûte ~1,6 Ko : une cadence rapide permanente dépasserait 1 Mo par heure, inacceptable sur un forfait mobile. Ne pas « simplifier » en `setInterval` fixe.
- Ne jamais déduire « en ligne » de la seule interface réseau : `navigator.onLine` et `isConnected` sont faux avec un portail captif ou un backend éteint, donc seule la sonde prouve que le serveur est joignable.
- Toute action qui exige une réponse du serveur passe par la garde réseau (`useGardeReseau`) et affiche un message clair plutôt que d'échouer silencieusement.

### 16 bis. Expiration du contenu hors ligne : passer par `lireLocalHorsLigne`

- **Le cache hors ligne est éparpillé en plusieurs clés**, chacune rangée par la préparation et lue par son propre chemin : `reviser.quiz.horsLigne.*`, `entrainement.exercice.corrige.*`, `mission.horsLigne.*`. Les contenus rangés par `avecCopie` (cours, leçons, fiches, exercices, quiz libres, annales) passent par ce même point.
- **Toute lecture d'une clé locale de contenu doit passer par `lireLocalHorsLigne()`** (`src/services/reviser.ts`), qui applique l'expiration. Un `AsyncStorage.getItem()` direct **contourne la règle** — c'est l'erreur commise deux fois, en annonçant à tort que l'expiration bloquait le contenu alors que quiz et corrigés restaient accessibles.
- Ne pas recopier `contenuHorsLigneValide()` au cas par cas : le contrôle vit dans `lireLocalHorsLigne` et `avecCopie`. Une nouvelle clé locale de contenu doit être ajoutée à la liste ci-dessus **et** couverte par un test.
- `src/services/__tests__/reviser.test.ts` contient le bloc « clés locales hors ligne : toutes soumises à l'expiration », qui couvre chaque clé. **Toute nouvelle clé de contenu local doit y ajouter son test.**
- Les clés qui ne sont **pas** du contenu (index de téléchargements, réglages, scores, historique) ne sont pas concernées : ne pas les soumettre à l'expiration.

## 17. Modules natifs : interdiction d'en ajouter sans nouvel APK
- **Un module natif importé par le JS doit être compilé dans l'APK installé.** Sinon `requireNativeModule` lève à l'évaluation du module, donc **au démarrage de l'app, avant tout rendu** : aucun `try/catch` autour de l'appel ne peut l'attraper.
- Le garde-fou `src/__tests__/garde-module-natif.test.ts` fait échouer le CI dans ce cas. Si ce test échoue, la correction n'est **pas** d'ignorer le test :
  - soit c'est un ajout natif légitime : produire un nouvel APK, l'installer, **puis** ajouter le paquet à `NATIFS_EMBARQUES` ;
  - soit le paquet ne contient aucun code natif : le déclarer dans `PURS_JS` avec sa justification.
- **Un module optionnel se charge par `requireOptionalNativeModule`**, jamais par un import direct — c'est le cas d'`expo-network` dans `src/services/connectivite.ts`. `requireNativeModule` **lève** quand le module est absent, donc un import direct suffit à faire planter au démarrage un binaire qui ne l'embarque pas. `requireOptionalNativeModule` renvoie `null` : le code retombe alors sur son repli. Le garde-fou interdit tout import direct d'`expo-network` et exige le chargement optionnel.
- Un nouvel APK ne suffit pas à lui seul : `app.config.ts` ne définit pas de `runtimeVersion`, donc Expo prend `appVersion`. Sans incrément de version, l'OTA partirait aussi vers les anciens APK et les casserait.
- Incident de référence (5 octobre 2026) : `expo-network` ajouté pour la détection réseau, importé directement. Le natif était absent de l'APK de prévisualisation en circulation ; l'OTA aurait planté l'app au démarrage chez tous les testeurs. Aucun test ne l'a vu, car Jest ne charge jamais le natif, et le test en Expo Go ou en development build ne le révèle pas non plus (le natif y est précompilé). Le module a ensuite été réintégré **correctement** (chargement optionnel + `version` incrémentée) pour la détection instantanée.

## 18. Permission des notifications : jamais au démarrage (demande de Benny, 7 octobre 2026)
- La permission des notifications ne se demande **jamais** au lancement de l'app ni à la connexion : enregistrerJetonPush (src/services/push.ts) lit la permission sans la demander.
- Elle se propose une fois, par la feuille PropositionNotifications (src/components/PropositionNotifications.tsx), à la fin d'une première mission, d'un quiz ou d'un chapitre : « Autoriser » demande au téléphone puis ouvre Paramètres, Notifications ; « Plus tard » ne revient pas avant 7 jours. Jamais pour un invité, ni si la permission est déjà donnée ou refusée pour de bon (src/services/proposerNotifications.ts).
- Les demandes déclenchées par un geste de l'élève restent permises : réglages des notifications, envoi d'une photo, téléchargement hors ligne, rappel quotidien.

## 19. App Store (iOS)
- Plan et règles Apple : **docs/app-store.md**. Sur iOS, aucune mention d'Android ni de paiement externe (Mobile Money, pawaPay) ; partout où Google est proposé pour se connecter, Apple l'est aussi (règle 4.8). Achats iOS via RevenueCat.
