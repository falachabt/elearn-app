# Implémentation — diagnostic TOEIC obligatoire : barre d'onglets masquée avant le diagnostic (issue #121)

- Date : 24 octobre 2026, 19:37 UTC
- Auteur : Muse
- Sujet : implémentation du masquage des menus tant que le diagnostic n'est pas fait, sur décision validée de Benny
- État : fait (commit local, push en attente du feu vert de Benny sur les captures)
- Zones touchées : `src/app/(onglets)/_layout.tsx` (masquage + réserve basse), nouveau test `src/__tests__/barreOngletsMasquee.test.tsx`, cette ligne d'EN-COURS. Aucun écran Tests, Réviser, Statistiques, aucun moteur d'exercice.
- Suite de : `echanges/2026-10-24-1836-muse-diagnostic-obligatoire-prise.md` (inventaire et maquette).

## Décision appliquée (Benny, 24 octobre au soir)

La proposition initiale (onglets verrouillés atténués + cadenas + feuille du bas) a été écartée par Benny : **masquage**. Tant que le diagnostic n'est pas terminé, l'élève ne voit pas les autres menus du tout ; il ne voit que l'écran du diagnostic à faire, et se sent obligé de le faire. La barre apparaît dès la fin du diagnostic.

## Issue créée

**#121 — [TOEIC-A5] Diagnostic obligatoire : menus masqués avant le diagnostic** (P1, toeic, ecran, status:in-progress). Le besoin n'était couvert par aucune issue ouverte (vérifié dans la prise).

## Mécanisme (layout des onglets uniquement)

- Nouvel état `diagnosticFait` dans `src/app/(onglets)/_layout.tsx`, lu par `lireDiagnostic()` (`src/services/certification/etat.ts`) dans le même effet qui calcule déjà la reprise et la garde d'arrivée : `!!diag?.fin` — exactement le drapeau de `DonneesAccueil.diagnosticFait`. L'effet se relance à chaque changement d'écran (`chemin`) : au retour sur l'accueil après le diagnostic, la barre réapparaît sans relancer l'app. Un diagnostic commencé mais non terminé (`fin` absente) laisse la barre masquée ; la reprise se fait depuis le même accueil (« Reprendre le diagnostic »).
- `barreMasquee = barreToeic && !diagnosticFait`. Quand elle est vraie :
  - la vue de la barre reçoit le style `masquee` (`display: 'none'`) ;
  - la réserve basse du `TabSlot` passe de `DEPASSEMENT_CENTRAL + espace[3]` (30 dp, prévue pour le bouton central qui déborde) à l'inset bas de la zone sûre : pas d'espace fantôme, et le pied de l'accueil (bouton « Commencer le diagnostic » de `AccueilToeic`, `insetBas={false}`) se pose en bas de l'écran, au-dessus de la zone sûre.
- Le commentaire du layout qui documentait le comportement inverse (« les onglets TOEIC s'ouvrent dès l'arrivée ») est mis à jour : la garde d'arrivée laisse toujours passer dès l'arrivée, c'est la barre qui reste masquée.

## Contrainte technique rencontrée (à connaître)

Retirer purement `TabList` fait lever au navigateur d'`expo-router/ui` : « Couldn't find any screens for the navigator » — les écrans d'onglets sont découverts depuis les `TabTrigger` enfants de `TabList`, et l'app tombait sur son écran d'erreur (constaté en captures réelles, pas en test unitaire dont les doubles masquaient le problème). La barre reste donc **montée mais non affichée** (`display: 'none'` : invisible, non touchable, sortie de l'arbre d'accessibilité). Pour l'élève, le résultat est celui de la décision : aucun menu visible avant le diagnostic.

## Effets de bord vérifiés

- Arrivée A1 à A4 (routes `/certification/*`, hors onglets) : inchangée. Écrans du diagnostic (consignes, A6, A8, A7) : atteignables, hors layout d'onglets.
- Profils secondaire et concours, barre élève (Photo centrale, Questions) : `barreMasquee` exige `barreToeic`, donc strictement inchangés — couverts par le test (d).
- `EtatReseau` (bandeau hors ligne) reste rendu entre le contenu et la barre, masquée ou non.
- Diagnostic terminé : barre complète, réserve normale de 30 dp restaurée.

## Tests et validation

- Nouveau fichier `src/__tests__/barreOngletsMasquee.test.tsx` (4 tests, layout monté avec services doublés) : (a) profil TOEIC + aucun diagnostic → barre en `display:none`, réserve = zone sûre ; (b) diagnostic commencé non terminé → toujours masquée ; (c) résultat posé → barre affichée, onglets Tests et Statistiques présents, réserve 30 dp ; (d) profil élève → barre inchangée.
- `npm run valider` sur le code final : **vert** — typage, ESLint, Jest complet (227 suites, 2 512 tests), export Android Hermes. Aucun flake rencontré (run à 19 h 30 UTC, hors fenêtre 0 h–2 h du flake connu).

## Captures réelles (Expo web local, API de démonstration, Playwright, 390 px)

Dans `~/workspace/captures-diagnostic-obligatoire/` (script `capturer-diagnostic-obligatoire.js`) :
- `avant-diagnostic-sans-barre-390-clair.png` et `-sombre.png` : accueil S7 « Commence par le diagnostic », **aucune barre d'onglets**, bouton « Commencer le diagnostic » posé en bas de l'écran. Contrôle par le texte de la page : aucun libellé d'onglet présent.
- `apres-diagnostic-avec-barre-390-clair.png` et `-sombre.png` : accueil complet (séance du jour, score estimé) et barre complète Accueil · Réviser · Tests · Statistiques · Moi.

## Reste à faire

- Push du commit local après le feu vert de Benny sur les captures (puis OTA preview par le workflow, changelog à rédiger à ce moment-là).
- Inscription de la décision au cahier TOEIC (le besoin y est nouveau) : à porter par le coordinateur / le dev TOEIC.
