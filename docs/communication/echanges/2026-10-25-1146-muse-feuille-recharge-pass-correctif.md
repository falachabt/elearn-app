# Correctif — Régression #124 : écran « Oups » au toucher de la notification d'expiration du Pass (25 octobre 2026, Muse)

## Incident

Le 25/10/2026 vers 12:07 (heure de Paris), après l'application de l'OTA du commit `bd5fa2d` (livraison #124),
Benny touche la notification d'expiration de son Pass (`pass_ending`, reçue le matin même) : au lieu de la
feuille « recharger le Pass », l'app affiche l'écran global « Oups — Un problème est survenu. L'erreur a été
enregistrée. » Deux chemins le produisent, constatés par Benny : (1) toucher du push ; (2) ouverture normale
de l'app, centre de notifications (cloche), toucher de la même notification. Le lancement normal, lui, ne
plante pas.

## Cause racine (prouvée)

`FeuilleRechargePass` était montée dans `src/app/_layout.tsx` **après** `</BottomSheetModalProvider>`, donc
**hors du provider**. Or elle rend une `Feuille`, c'est-à-dire un `BottomSheetModal` de
@gorhom/bottom-sheet, dont le rendu appelle `useBottomSheetModalInternal()` : le contexte
`BottomSheetModalInternalContext` est créé à `null` par la librairie et le hook **lève la chaîne
`'BottomSheetModalInternalContext' cannot be null!`** quand aucun provider n'est ancêtre (vérifié dans
`node_modules/@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetModalInternal.js` et
`contexts/modal/internal.js`).

Chaîne complète du plantage : les deux interceptions (`suivreOuvertures` dans `rappels.ts`,
`CentreNotifications.ouvrir`) partagent le même code — `demanderFeuilleRecharge(...)` → le composant racine
pose sa présentation → rendu de `Feuille` ouverte → la modale lève pendant le rendu → la frontière d'erreur
racine (`ErrorBoundary`) affiche le repli « Oups » et journalise (`journaliserErreur(..., 'boundary')` :
journal local `erreurs.journal` sur l'appareil + exception PostHog via `suivreException`). Un écran de
frontière ne peut d'ailleurs venir que d'une levée **pendant un rendu** : les erreurs asynchrones des
interceptions partent au handler global, pas à la frontière. Le suspect « démarrage à froid / charge utile »
est innocent : l'extraction de `days_left`/`notificationId` est défensive, et le plantage est postérieur à
tout traitement de données, au rendu.

Reproduction déterministe (Jest, **vrai** module @gorhom/bottom-sheet) : la même `Feuille` ouverte rendue
sans provider produit l'écran exact de la capture (« Oups » + « Un problème est survenu ») et l'erreur
journalisée exacte ci-dessus ; avec provider, l'erreur de contexte n'est jamais levée.

### Pourquoi la validation locale ne l'a pas vu

`jest.setup.js` remplace `@gorhom/bottom-sheet` par un passe-plat pour **toute** la suite (« les feuilles
sont rendues à plat »), et le test composant le re-simulait : le `BottomSheetModal` simulé n'appelle jamais
le hook interne, donc l'exigence du provider est invisible aux tests. Le montage fautif venait d'une
analogie avec `BienvenuePass`, montée au même endroit — mais elle ne rend pas de `Feuille`.

### Portée : la feuille plante à TOUT affichage effectif, pas seulement au toucher

Le composant est le même pour les trois entrées : toute présentation posée rend la modale hors provider et
lève. L'ouverture automatique plantera donc à sa première présentation effective — pour un élève à J-3 qui
n'a encore rien touché, dès le premier démarrage à froid dans la fenêtre. Si Benny ne l'a pas vue au
lancement ordinaire du 25/10, c'est circonstanciel : (1) sa première interaction avec le nouveau code a été
le toucher de 12:07 ; (2) `traiterDemande` pose le drapeau `pass.recharge.affichee.<fin>` **avant** de poser
la présentation, donc la tentative plantée a consommé le créneau du jour — les lancements directs suivants
trouvent `doitPresenter(...) === false` et ne présentent rien ; (3) feuille fermée, la modale n'est jamais
rendue, donc un lancement sans présentation due ne peut pas planter. Sans correctif, le 26/10 (J-2), la
première ouverture du jour aurait planté au démarrage, et chaque toucher (push ou cloche) plante
immédiatement.

### Puits d'erreurs

L'écran dit vrai : l'erreur a été enregistrée — journal local de l'appareil (`erreurs.journal`, 50 entrées,
message + pile) et exception PostHog (origine `boundary`, écran, version). Ni l'un ni l'autre ne sont
lisibles depuis la VM (aucune clé API PostHog, seule la clé publique d'ingestion ; journal sur le
téléphone). Le message attendu dans les deux : `'BottomSheetModalInternalContext' cannot be null!`. La
preuve repose sur la reproduction ci-dessus (message et écran identiques).

## Correctif

- `src/app/_layout.tsx` : `<FeuilleRechargePass />` déplacée **dans** `<BottomSheetModalProvider>`, juste
  après `<Navigation />`, avec un commentaire d'incident. Aucun autre déplacement (`BienvenuePass` et les
  toasts restent où ils sont : ils ne rendent pas de `BottomSheetModal`). Aucun try/catch ajouté : si une
  erreur de rendu survenait encore, elle resterait journalisée par la frontière comme avant, et les replis
  existants (navigation vers `/offres` quand la feuille n'est montée nulle part) sont inchangés. Aucun
  changement serveur, aucun écran TOEIC touché.

## Tests de régression

- Nouveau `src/components/pass/__tests__/feuilleRechargePass.racine.test.tsx` — charge le **vrai**
  @gorhom/bottom-sheet (contourne le passe-plat global) : (a) sans provider, la feuille ouverte produit
  « Oups » et l'erreur exacte de la librairie (le mode de défaillance, verrouillé) ; (b) avec provider,
  l'erreur de contexte n'est jamais levée. Limite documentée dans le fichier : sous Jest, le mock officiel
  de Reanimated ne sait pas achever la mise en page de la vraie modale — le cas (b) vise l'erreur de
  production, pas le contenu.
- Nouveau `src/__tests__/garde-feuille-racine.test.ts` — garde-fou structurel (style
  `garde-module-natif`) : lit `_layout.tsx` et exige chaque feuille racine déclarée (aujourd'hui
  `FeuilleRechargePass`) entre `<BottomSheetModalProvider>` et `</BottomSheetModalProvider>`. C'est le test
  qui aurait attrapé la régression avant publication.
- `feuilleRechargePass.test.tsx` : le montage de test enrobe désormais la feuille dans
  `BottomSheetModalProvider` (miroir du layout corrigé), et un nouveau test de bout en bout couvre le chemin
  fautif : `suivreOuvertures()` + toucher simulé avec la **charge utile réelle** du serveur
  (`{ type: 'pass_ending', days_left: 3, screen: '/paiements', notificationId }`) → la feuille s'ouvre à J-3
  et `router.push` n'est jamais appelé (ni « Mes paiements », ni le repli offres).
- Suites ciblées : 5 suites, 48 tests, verts. `npm run valider` complet : **vert** (typage, ESLint, Jest
  entier `--runInBand`, export Android Hermes).

## Reste à faire

- Push sur le « Pousse » de Benny, puis poster le commentaire de correctif sur l'issue #124 (texte préparé
  ci-dessous) ; fermeture = revue de Benny sur son appareil (toucher du push et de la cloche, feuille
  affichée ; le lendemain, ouverture automatique à J-2).

## Commentaire préparé pour l'issue #124 (à poster au push)

> Correctif de la régression constatée le 25/10/2026 (écran « Oups » au toucher de la notification
> d'expiration, push et cloche) : la feuille était montée à la racine **hors** de
> `BottomSheetModalProvider`. Le rendu de sa modale @gorhom/bottom-sheet levait
> `'BottomSheetModalInternalContext' cannot be null!` au premier affichage — l'app démarrait normalement
> tant que la feuille restait fermée, et toute présentation (toucher ou ouverture automatique) plantait.
> La suite de tests ne pouvait pas le voir : la librairie y est remplacée par un passe-plat.
>
> Correctif : `FeuilleRechargePass` déplacée sous le provider dans `_layout.tsx`. Régression couverte par
> trois tests nouveaux : rendu avec la vraie librairie (l'erreur exacte, avec et sans provider),
> garde-fou structurel sur le montage racine, et toucher de bout en bout avec la charge utile réelle du
> serveur (feuille ouverte, aucune navigation). Validation locale complète verte. Détails :
> `docs/communication/echanges/2026-10-25-1146-muse-feuille-recharge-pass-correctif.md`.
