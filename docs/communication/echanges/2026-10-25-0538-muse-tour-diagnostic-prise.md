# Prise — Tour de première fois du diagnostic [TOEIC-A6] (inventaire de l'existant)

- Date : 25 octobre 2026, 05:38 UTC
- Auteur : Muse
- Sujet : inventaire complet avant construction d'un « tour de première fois » dans le diagnostic TOEIC, demandé par Benny le 25 octobre 2026
- État : pris (inventaire — aucun code applicatif modifié, aucun commit)
- Zones touchées : ce fichier et la ligne d'`EN-COURS.md` uniquement. Lecture seule sur `src/components/`, `src/services/`, `src/app/`, `src/i18n/`, `src/theme/`.

## Cadre

Demande de Benny (dictée vocale du 25 octobre 2026, décomposée) : dans le diagnostic, montrer un tour **une seule fois** (à la première fois), à **deux endroits** :

- **Moment 1 — la première partie groupée avec audio** (parties 3/4 : un audio, plusieurs questions) : un « rappel » en **feuille du bas**, qui explique la mécanique des groupes : on ne peut valider que si chaque question du groupe a une réponse choisie ; choisir une option fait passer automatiquement à la question suivante ; les onglets du haut permettent de revenir sur une question.
- **Moment 2 — la première partie 7** (plusieurs documents, plusieurs questions) : un autre tour, **en étapes**, qui explique que l'ensemble peut avoir plusieurs documents et qu'on touche les onglets « Doc. 1 / Doc. 2 » pour changer de document, avec une dernière étape qui rappelle que l'ensemble a plusieurs questions (onglets « Question 168/169/170 »).
- Le tour reste dans le **thème néo-brutaliste** de l'app.
- Point de départ indiqué par Benny : « Dans le truc de correction des annales, tu vas voir une implémentation du composant de tour. »

Règle maison appliquée : vérifier l'existant avant de construire, réutiliser plutôt que réinventer. La zone TOEIC reste la propriété du dev TOEIC ; cette prise est une réassignation ponctuelle de Benny, dans la continuité de #81 (même écran A6).

## 1. Le composant de tour existant : `Visite` (correction des annales)

### Où il vit

| Pièce | Fichier |
| --- | --- |
| Composant + provider + hook | `src/components/Visite.tsx` (149 lignes) |
| Bibliothèque sous-jacente | `@wrack/react-native-tour-guide` `^2.0.0` (`package.json:12`) — déjà embarquée et livrée, aucun nouveau module |
| Hook d'écran « première ouverture » | `src/components/annales/travail/useVisiteEcran.ts` |
| Persistance « déjà vu » | `src/services/travailSujet.ts:437-451` |
| Montage | `VisiteProvider` posé une fois à la racine, sous `ThemeProvider` : `src/app/_layout.tsx:22` et `:182-193` — donc disponible sur toutes les routes, y compris le Stack `certification` |
| Tests | `src/components/__tests__/Visite.test.tsx` (5 tests : titre traduit, Suivant, action sur cible, action qui échoue = reste sur l'étape, mesure Android sans barre d'état) |

### API

- `useVisite()` → `demarrer(etapes: EtapeVisite[], onFin?: (terminee: boolean) => void)`.
- `EtapeVisite` (`Visite.tsx:14-26`) : `{ id, cible, titre, description, surCible? }`.
  - `cible` = la **ref d'un élément** (`TourStep['targetRef']`) : dans les écrans, `useRef<View>(null)` posé sur un `<View ref={...} collapsable={false}>` qui enveloppe l'élément visé (patron visible dans `PhotosTravail.tsx:30-36` et dans le JSX : viseur, compteur, aide, galerie, obturateur, terminer…).
  - `surCible` (optionnel) : un appui **sur le halo** exécute l'action de l'élément puis passe à l'étape suivante — sauf si l'action renvoie `false` (ex. photo non prise, `PhotosTravail.tsx` `photographier`). Sans `surCible`, l'appui sur la zone mise en avant ne fait rien.
- Ordre des étapes = ordre du tableau ; navigation Retour / Suivant / Passer (skip) / Terminé, fournis par la bibliothèque et habillés maison.

### Présentation (déjà néo-brutaliste, rien à redessiner)

- **Projecteur** : calque assombri (`theme.ombre`, opacité 0,72), halo **pulsant jaune soleil** (`theme.accent.soleil`, largeur 4) autour de l'élément visé (`Visite.tsx:100-106`).
- **Carte d'explication** : fond `theme.fond.surface`, **bordure 2 px** (`bord.normal`) couleur `theme.bord.fort`, **ombre dure sans flou** (décalage `ombre.carte` = 3, rayon 0 ; sur Android, bord bas et droit épaissis car `elevation` floute), rayon `rayon.l`, padding `espace[4]`, **pas de flèche** (`Visite.tsx:76-98`).
- **Boutons maison** : `Suivant`/`Retour` = composant `Bouton` (petit, principal/secondaire), `Passer` = lien souligné, **compteur en pastille jaune doux** « 2/5 » (`theme.accent.soleilDoux`, bordure forte) (`Visite.tsx:29-64`).
- Textes génériques traduits : `visite.suivant/precedent/passer/termine/etape` (`src/i18n/fr.ts:275`, `en.ts:274`). Les textes d'étapes vivent chez le consommateur (annales : `travail.visiteGuide.*`, `fr.ts:1068` et suivantes).
- Mesure : `margesVisite` (`Visite.tsx:73`) corrige le décalage Android (la mesure part du haut de l'écran, barre d'état comprise ; `insets.top` forcé à 0, la carte évite la barre via `extraInsets`).

### « Déjà vu » : comment c'est mémorisé (annales)

- `useVisiteEcran(ecran, construire, pret = true)` (`useVisiteEcran.ts`) : à la première ouverture de l'écran, si `pret` et visite non vue → lancement automatique après **700 ms** (le temps que les éléments soient mesurables). `construire` est relue à chaque lancement (refs et étapes conditionnelles à jour). Le hook renvoie `lancer` pour **rejouer à la demande** (bouton d'aide `CircleHelp`, libellé accessibilité `travail.revoirVisite` « Revoir la visite », `fr.ts:984`).
- Fin de visite (terminée **ou passée**) : `marquerVisiteVue(ecran)` + évènement analytics `annale_visite_vue { terminee, ecran }` (déclaré dans `src/services/evenements.ts:126`, documenté dans `docs/analytics/dictionnaire-evenements.md:170`).
- Stockage (`travailSujet.ts:440-451`) : **AsyncStorage par appareil** (ni serveur, ni compte), une clé par écran : `annales.visite.${ecran}.vue` = `'1'`, avec `EcranVisite = 'photos' | 'apercu' | 'ordre'`. Une lecture qui échoue compte comme « déjà vue » : **jamais bloquant**.

### Usages actuels (3, tous dans la correction du travail sur annale)

- `PhotosTravail.tsx:63` — 7 étapes (viseur, obturateur avec `surCible: photographier`, miniatures, galerie, compteur, terminer, aide).
- `ApercuFeuille.tsx:42` — 5 étapes, `pret = !!feuille && !recadrage` (étapes conditionnelles).
- `OrdreFeuilles.tsx:44` — 5 étapes, `pret = feuilles.length > 0`.

### Générique ou couplé ?

- `Visite.tsx` est **générique** : aucun import annales, thèmes et textes paramétrés. Réutilisable tel quel dans le diagnostic.
- `useVisiteEcran` et la persistance sont **couplés aux annales** par l'import de `travailSujet` (type `EcranVisite`, clés `annales.*`) et par l'évènement analytics nommé `annale_*`. Pour la certification, il faudra un équivalent cert (voir §4) plutôt que d'étendre le type annales.

## 2. La feuille du bas maison : `Feuille` (pour le moment 1)

- `src/components/Feuille.tsx` (131 lignes), construite sur `@gorhom/bottom-sheet` (`BottomSheetModal`, provider à la racine) : elle s'ouvre **au-dessus de tout, quel que soit l'endroit où elle est déclarée** (même dans un défilement).
- API : `ouverte`, `onFermer`, `icone` (pastille jaune par défaut `theme.accent.soleil`), `titre`, `texte`, `actions[]` (`{ libelle, onPress, variante, icone?, badge? }`), `mention`, `avant`, `illustration`, `centre`, `bloquante` (pas de fermeture au glissé ni au fond). Style : fond surface, **bordure 2 px `bord.fort`, rayon `rayon.l`** — même langage néo-brutaliste que la carte de visite.
- **Déjà utilisée dans l'écran du diagnostic** : `FeuilleQuitter` (`src/components/certification/FeuilleQuitter.tsx`), rendue par `Diagnostic.tsx:209`. Ajouter une feuille « rappel » dans le même écran suit donc un patron déjà en place dans ce fichier.
- C'est aussi le composant des blocages (consigne de Benny, AGENTS.md §21 : un blocage se présente par une feuille du bas qui dit la raison).

## 3. Le flux diagnostic : où accrocher les deux moments

### Cartographie (acquis de #81, revérifiée)

- Route : `src/app/certification/diagnostic.tsx` (réexporte le composant) ; écran dans le Stack `src/app/certification/_layout.tsx` (pas de barre d'onglets sur cet écran ; le masquage #121 concerne le layout `(onglets)`, sans effet ici).
- Composant : `src/components/certification/Diagnostic.tsx`. État : `etat.tentative.questions` (liste ordonnée), `etat.index` = index de la **première question du groupe courant** ; `membres = membresGroupe(questions, index)` (`src/services/certification/groupes.ts:7-17`) ; `onglet` = question affichée dans le groupe ; `reponses` = réponses **locales au groupe**, envoyées seulement à la validation du groupe (`envoyer`, `Diagnostic.tsx:122-140`).
- Ordre garanti : `ordonnerDiagnostic` (`src/services/certification/certDiagnostic.ts:10-16`) trie par partie croissante, stable, **groupe d'un seul tenant** (D-19). Le plan servi (`diag_counts`) donne : P1 ×1 seule, P2 ×2 seules, **P3 un groupe de 3 (audio)**, **P4 un groupe de 3 (audio)**, P5 ×3 seules, **P6 un groupe de 4 (texte à trous)**, **P7 5 questions en groupes de 2 à 4 (documents)**.
- Avant la première question de **chaque partie**, l'écran intercale déjà `ConsignesPartie` (D-P1/D-P3, `Diagnostic.tsx:165-171` + `src/components/certification/ConsignesPartie.tsx`) : les deux tours se placent donc **après** le « Commencer la partie N » des consignes, au premier affichage du groupe visé — pas avant (les cibles n'existent pas encore à l'écran des consignes).

### Comment le rendu distingue les familles de groupes

Via `question.group` (`GroupeServi`, `src/services/certification/types.ts:22-29`) et `QuestionExercice.tsx` :

| Famille | Donnée | Rendu |
| --- | --- | --- |
| Groupe audio (P3/P4) | `group.audio_path ≠ null` ; lecteur affiché si `part <= 4` | `LecteurAudio` **une piste par groupe** (`key = group.id`), mode `unique` = **écoute unique** en diagnostic (`QuestionExercice.tsx:164-174`, prop `unique` passée par `Diagnostic`) |
| Groupe texte à trous (P6) | `group.passage.text` avec marqueurs `{k}` | `PassageTrous` : tags numérotés jaunes (motif livré par #81, actif depuis les groupes entiers) |
| Groupe multi-documents (P7) | `group.passage.docs[]` (+ `multi`) ; `documentsDuPassage` (`QuestionExercice.tsx:130-134`) | **onglets « Doc. N » internes à `QuestionExercice`** si `docs.length > 1` (état local `doc`, `QuestionExercice.tsx:146,179-193`), carte passage bordée en dessous |
| Toutes | `membres.length > 1` | `OngletsGroupe` (onglets « Question N » + coche si répondue), passé en prop `enteteGroupe` par `Diagnostic.tsx:207` et rendu par `QuestionExercice` entre l'audio et les documents (`QuestionExercice.tsx:175`) |

### Mécanismes déjà présents (ce que les textes du tour décriront — rien à construire)

- **Avancement automatique** : au choix d'une option, `onChoix` (`Diagnostic.tsx:188-196`) enregistre la réponse du groupe et **saute à la première question sans réponse** ; idem pour « Passer cette question » (réponse `null`, `passer`, `Diagnostic.tsx:110-118`).
- **Validation par groupe** : pied fixe de l'`Ecran` (hors défilement) : bouton « Valider (n/total) » (`certification.exercice.validerN`), **désactivé tant que 0 réponse** ; si le groupe est incomplet au premier appui → bannière « Tu n'as pas tout répondu » (`Banniere` ton alerte) et le bouton devient « Valider quand même (n/total) » au second appui (`Diagnostic.tsx:176-186,208`). C'est la formulation exacte de la consigne de Benny : « il ne peut valider que si il a au moins choisi une réponse à chaque question » — en pratique : validation directe seulement groupe complet, sinon confirmation « quand même ».
- **Onglets questions** : `OngletsGroupe.tsx` — appui libre dans le groupe, coche sur les questions répondues.
- **Onglets documents (P7)** : état **interne** à `QuestionExercice` (remis à zéro à chaque groupe par la `key` sur le groupe, `Diagnostic.tsx:192`), non pilotables depuis `Diagnostic`.

### Points d'accroche exacts

**Moment 1 (premier groupe audio)** — dans `Diagnostic.tsx`, quand la phase est `question` et que le groupe courant vérifie, **détecté par les données** (pas par le numéro de partie en dur) : `membres.length > 1 && membres[0].group?.audio_path` (en pratique : le groupe P3, premier groupe rencontré). Le drapeau « moment 1 vu » se lit à ce moment-là ; s'il n'est pas posé, ouvrir la `Feuille` rappel ; le poser à la fermeture de la feuille (patron `marquerVisiteVue` à la fin). La reprise en cours de groupe (`reprise.ts` : retour direct sur la question en cours) ne doit pas rouvrir la feuille : c'est le drapeau qui décide, pas la position.

**Moment 2 (première partie 7 multi-documents)** — même endroit, condition : `membres[0].part === 7 && membres.length > 1 && documentsDuPassage(membres[0].group?.passage).length > 1`. Lancer la `Visite` (délai ~700 ms comme `useVisiteEcran`, après le « Commencer la partie 7 » des consignes) avec des étapes ciblant : (a) les onglets documents, (b) la carte passage/le document affiché, (c) en dernière étape les onglets questions. Drapeau propre au moment 2.

## 4. Persistance « première fois » côté certification

- Existant local cert : `src/services/certification/etat.ts:9-13` — `cert.plan`, `cert.diagnostic`, `cert.serie`, `cert.cache.examens`, `cert.cache.reglages`, tous en **AsyncStorage par appareil** (le diagnostic lui-même est « une tentative par appareil », `etat.ts:44`). Le profil (invité ou connecté) vit côté `src/services/profil.ts` (`lireProfil`) ; **aucun état cert n'est rattaché au compte** : un invité et un connecté partagent les mêmes clés sur le même appareil.
- Proposition, alignée sur le patron annales (`annales.visite.<ecran>.vue`) et la convention `cert.*` : deux clés indépendantes, une par moment —
  - `cert.tourDiagnostic.audio.vue` (moment 1)
  - `cert.tourDiagnostic.partie7.vue` (moment 2)
  - valeur `'1'`, lecture en échec = « déjà vu » (jamais bloquant), écriture silencieuse (`.catch(() => {})`), posées **à la fin** de chaque présentation (feuille fermée / visite terminée ou passée).
  - Fonctions `tourDiagnosticDejaVu(moment)` / `marquerTourDiagnosticVu(moment)` à placer dans un petit service cert (nouveau `src/services/certification/tourDiagnostic.ts`, ou dans `etat.ts` à côté des clés).
- Ce ne sont **pas des clés de contenu** : la règle d'expiration `lireLocalHorsLigne` (AGENTS.md §16 bis) ne s'applique pas (comme les réglages et les drapeaux annales). Pas de test d'expiration à ajouter dans `reviser.test.ts`.
- Limite assumée, identique aux annales : appareil partagé = le deuxième élève ne voit pas le tour ; changement d'appareil = le tour se rejoue. La maquette/recette devra prévoir d'effacer ces deux clés pour revoir les tours (ou un bouton de relecture — voir décision ouverte §6).

## 5. Écarts et pièges relevés

1. **Aucune cible de visite n'existe encore dans l'écran du diagnostic.** La bibliothèque vise des refs (`<View ref collapsable={false}>`). Faisable sans toucher au partagé pour : les **onglets questions** (envelopper `<OngletsGroupe>` dans une `View` à ref côté `Diagnostic`, puisque c'est lui qui construit le nœud `enteteGroupe`), le **bouton Valider** (le pied est construit par `Diagnostic`), le **bloc question entier** (envelopper `<QuestionExercice>`). **Point dur** : les **onglets « Doc. » sont internes à `QuestionExercice`** (composant partagé avec Série et MiniTest, moteur B* du dev TOEIC) — aucune prise extérieure. Options : (a) viser la carte passage entière (interne aussi — même problème, seule l'enveloppe externe du composant est visable) ; (b) ajouter à `QuestionExercice` une prop optionnelle de ref pour la rangée d'onglets documents (ajout additif, patron `enteteGroupe` déjà en place) — **seule modification du partagé à négocier** ; (c) première étape du moment 2 sans cible précise (carte seule de la bibliothèque, non utilisée dans les annales : toutes leurs étapes ont une cible).
2. **Défilement** : l'écran du diagnostic défile (`Ecran` avec `ScrollView`, `defilement` par défaut) ; les usages actuels de `Visite` sont sur des écrans **fixes ou courts** (photos : layout fixe ; aperçu : `defilement={false}`). La bibliothèque mesure l'élément à l'écran (`measureInWindow`) : une cible **hors de la zone visible** au lancement serait mal visée. Au démarrage d'un groupe, les cibles du haut (audio, onglets questions, onglets Doc.) sont en haut du bloc question — mais la position de défilement n'est pas explicitement ramenée en haut au changement de groupe dans `Diagnostic`/`Ecran` (les contenus sont remontés par `key`, pas le défilement). À traiter à l'implémentation (déclencher le tour à l'arrivée sur le groupe, et vérifier en recette réelle clair/sombre, 360/390) — risque principal de ce chantier.
3. **Audio à écoute unique** : ne **pas** mettre de `surCible` sur une éventuelle étape visant le lecteur : un appui sur le halo lancerait l'action du lecteur et consommerait l'unique écoute sans que l'élève l'ait décidé. Pour le moment 1 en feuille, le problème ne se pose pas (aucune cible). Si le moment 1 devenait une visite, étape audio en lecture seule (pas de `surCible`).
4. **Chevauchement des couches** : la feuille du bas (modale gorhom) et le calque de visite (racine) peuvent coexister techniquement ; les deux moments sont à des endroits différents du diagnostic, jamais simultanés. La feuille du moment 1 doit être fermée avant toute réponse (elle couvre le bas de l'écran, dont le pied Valider) : comportement natif de la modale, OK. Attention à ne pas ouvrir la feuille pendant l'écran `ConsignesPartie` de la partie 3 : l'accroche est sur la phase `question`, après les consignes — vérifié dans le code (§3).
5. **Reprise et cas limites** : diagnostic repris en cours de groupe audio (le drapeau évite la réouverture) ; diagnostic recommencé sur le même appareil après un premier passage (drapeau par appareil : pas de second tour — cohérent avec les annales, à valider par Benny) ; groupe P7 servi avec **un seul document** (la condition `docs.length > 1` diffère le moment 2 — dans le plan actuel P7 du diagnostic, le premier groupe a 2 documents dans la démo comme dans la capture de Benny du 25 octobre, mais la banque peut servir un groupe à document unique en tête : le tour attendrait alors le groupe multi-documents suivant, ou ne se montrerait pas si aucun ne vient — à trancher à la maquette).
6. **Ni `Visite` ni aucune visite n'existent encore dans la certification** (recherche `Visite`/`useVisite` dans `src/components/certification/`, `src/app/certification/`, `src/services/certification/` : aucun usage) : ce sera la première, le patron annales fait foi.
7. **Accessibilité et i18n** : les textes des deux moments doivent exister en **français et en anglais** (`src/i18n/fr.ts` / `en.ts`), sous un nouvel espace `certification.tour.*` (les génériques `visite.*` sont déjà traduits). Analytics : si l'on suit le patron annales, nouvel évènement (ex. `cert_tour_vu { moment, terminee }`) à déclarer dans `src/services/evenements.ts` **et** `docs/analytics/dictionnaire-evenements.md` (règle AGENTS.md §20).
8. **Recette** : la démo embarquée (`EXPO_PUBLIC_CERT_DEMO=1`, `src/services/certification/demo/`) sert le même plan (`apiDemo.ts:61-62`, `diag_counts`) avec un groupe P3 audio et un groupe P7 à documents multiples dans `contenu.json` : les deux moments sont donc capturables en recette démo, à condition d'effacer les clés `cert.tourDiagnostic.*` entre deux passages.

## 6. Périmètre d'implémentation proposé (à valider)

**Nouvelle issue à créer** — la suivante après la PR #122, libellé type : « [TOEIC-A6] Tour de première fois du diagnostic : rappel au premier groupe audio, visite à la première partie 7 » (labels P1 ou P2, toeic, ecran — à confirmer par le chef de projet ; réassignation ponctuelle de Benny comme #79/#81/#121).

Fichiers prévisibles :

| Fichier | Changement |
| --- | --- |
| `src/services/certification/tourDiagnostic.ts` (nouveau) | Drapeaux « vu » par moment (clés `cert.tourDiagnostic.*`), patron annales |
| `src/components/certification/Diagnostic.tsx` | Détection des deux moments (conditions §3), feuille rappel (moment 1), lancement de la visite (moment 2), refs cibles : enveloppe des onglets questions, pied Valider, bloc question |
| `src/components/certification/QuestionExercice.tsx` | **Seul point partagé, à négocier** : prop optionnelle exposant une ref sur la rangée d'onglets documents (moment 2, étape documents) — sinon étape documents dégradée sur le bloc entier |
| `src/i18n/fr.ts` + `src/i18n/en.ts` | Textes `certification.tour.*` (feuille : titre, 3 explications, bouton ; visite P7 : étapes) |
| `src/services/evenements.ts` + `docs/analytics/dictionnaire-evenements.md` | Évènement de fin de tour (si suivi retenu) |
| Tests : `src/components/certification/__tests__/diagnostic.test.tsx` (+ nouveau test du service de drapeaux) | Moment 1 : feuille affichée une fois au premier groupe audio, pas à la reprise, pas au groupe suivant ; moment 2 : visite lancée au premier groupe P7 multi-documents, drapeaux posés |
| EN-COURS + échange d'implémentation | Protocole habituel |

**Aucun changement** : ni `Visite.tsx`, ni `Feuille.tsx`, ni `groupes.ts`, ni le plan servi, ni les écrans Tests/Réviser/Statistiques.

Décisions ouvertes pour Benny (à l'étape maquette) :
1. Moment 1 : feuille seule (sa formulation) — ou feuille **puis** mini-visite sur les onglets questions ? L'inventaire recommande la feuille seule : elle couvre les trois explications sans cible fragile (lecteur audio, défilement).
2. Moment 2 : accepter la petite prop additive dans `QuestionExercice` pour viser précisément les onglets Doc., ou viser le bloc passage entier depuis l'extérieur ?
3. Relecture : aucun bouton de relecture dans le diagnostic (flux d'examen) — les annales ont « Revoir la visite » ; à confirmer qu'on s'en passe ici.
4. Groupe P7 à document unique servi en premier : le tour attend le prochain groupe multi-documents, ou se montre quand même (étape documents adaptée) ?

## 7. Cadres de maquette à produire (parcours « Première arrivée », planche A6)

Base : captures réelles de la démo alignée (dossier `~/workspace/captures-a6-81/2026-10-25-recette/` pour A6 actuel ; nouvelles captures à faire pour les deux moments, groupes P3 et P7 de la démo). Présentation standard : rangée claire puis rangée sombre, écrans à l'horizontale.

Moment 1 — premier groupe audio (partie 3, groupe de 3) :
1. A6-P3 · écran du groupe **avant** ouverture (consignes P3 déjà passées) — état de référence.
2. A6-P3 · **feuille rappel ouverte** : titre, les trois explications (valider = chaque question répondue ; choisir fait avancer tout seul ; onglets du haut pour revenir), bouton « J'ai compris » (libellé à valider).
3. A6-P3 · après fermeture, une réponse choisie → **avancement automatique** visible (onglet 2 actif, coche sur l'onglet 1).
4. A6-P3 · groupe incomplet + premier appui sur Valider → bannière « pas tout répondu » + « Valider quand même » (déjà réel, sert de preuve du texte de la feuille).

Moment 2 — première partie 7 multi-documents (groupe de 3, documents 1 et 2) :
5. A6-P7 · écran du groupe (onglets Question 168/169/170, onglets Doc. 1/Doc. 2, carte passage) — état de référence (capture réelle de Benny du 25 octobre comme témoin).
6. A6-P7 · **visite étape 1/N** : projecteur sur les onglets documents, carte « Plusieurs documents » (+ compteur de la visite).
7. A6-P7 · **visite étape 2/N** : projecteur sur la carte passage (document affiché, après toucher Doc. 2 ou sur le même écran).
8. A6-P7 · **visite dernière étape** : projecteur sur les onglets questions, rappel « plusieurs questions, une réponse chacune » + bouton Terminé.

Chaque cadre en clair puis en sombre, 390 px (et 360 px pour la feuille du moment 1, la plus dense en texte).
