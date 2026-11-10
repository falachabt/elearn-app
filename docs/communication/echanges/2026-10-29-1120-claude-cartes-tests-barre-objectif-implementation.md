# Cartes des listes de tests : barre de progression + repère objectif, et liste collée — implémentation (temps 2)

- **Date** : 29 octobre 2026 (11 h 20 UTC)
- **Auteur** : Muse
- **État** : implémenté, validé en local, poussé sur `claude/project-thread-kw792g` ; en attente de validation terrain de Benny (double relance de l'app preview)
- **Prise** : `echanges/2026-10-29-1034-claude-cartes-tests-barre-objectif-prise.md` (inventaire + maquette)
- **Zones touchées** : `src/components/certification/ui.tsx` (nouveau composant `BarreScoreObjectif`), `src/components/certification/ListeTests.tsx` (lignes migrées en bloc collé), `src/components/certification/__tests__/listesMini.test.tsx`, `src/i18n/fr.ts` et `src/i18n/en.ts` (clés `certification.tests.listes.*`). Réassignation ponctuelle de Benny pour ce chantier, comme au temps 1.

## Validation de Benny et ajustement appliqué

Maquette validée le 29 octobre 2026 (« le design et tout c'est très bien »), avec **un ajustement imposé** : supprimer toute mention textuelle de l'objectif dans la description/légende des cartes (le « Objectif : 800 » de la maquette ferait passer le texte à la ligne, « ce n'est pas bon pour le design ») — à la place, **juste la valeur (« 800 ») en petit, directement au-dessus du repère vertical** sur la barre. La ligne conseillée en fond soleil très doux est validée « totalement » (« je valide mais totalement »). Rien d'autre ne change par rapport à la maquette.

Conséquence pour les demi-tests : la légende « Objectif : 800 · repère à 400 par section » disparaît aussi ; la valeur écrite au-dessus du repère est celle de l'échelle de la barre (400 sur 495) — écrire « 800 » à cet endroit de la piste serait faux géométriquement. L'objectif total (800) reste dit dans le libellé d'accessibilité de la barre, qui dit tout en mots (valeur, échelle, au-dessus / en dessous / juste à l'objectif).

## Ce qui est implémenté

1. **`BarreScoreObjectif`** (`ui.tsx`, à côté de `BarreProgression`, dont elle reprend la piste : fond creux, bordure forte, remplissage `marque.principale`, hauteur 10) :
   - props `valeur: number | null` (null = piste vide), `max: number`, `objectif?: number | null` (déjà ramené à l'échelle par l'appelant), `libelle: string` (accessibilité) ;
   - remplissage au meilleur par rapport au **maximum de l'échelle**, jamais par rapport à l'objectif ;
   - repère = vue absolue de 3 px, couleur `bord.fort`, dépassant la piste de 4 px en haut et en bas ; valeur en petit (Space Grotesk Bold 12) juste au-dessus, centrée sur le repère ; aucun repère si l'objectif est null ou hors échelle.
2. **`ListeTests`** : l'en-tête de liste est inchangée ; les lignes vivent désormais dans **`GroupeColle`** (`src/components/liste/ListeCollee.tsx`) — un seul contour, séparateur `bord.fin` couleur `bord.doux` entre les lignes, ligne conseillée en fond `soleilTresDoux` (la bordure jaune individuelle des cartes séparées disparaît). Chaque ligne : pastille du type, titre + statut, mention « Conseillé », score compact « **980** sur 990 » (le nombre reste écrit, jamais la barre seule), la barre, puis « Tentatives : N · N questions » sous la barre.
   - Échelles : `mixed` / `full` → `objectifMax` (990) ; `listening` / `reading` → `objectifMax / 2` (495), repère à `objectif / 2` ; `mini` par partie → nombre de questions de la définition, **aucun repère** (arbitrage 1 de la maquette : un compte de questions ne se compare pas à un score TOEIC).
   - Objectif lu par `lirePlan()` au chargement de l'écran (clé locale `cert.plan`, aucune nouvelle donnée) ; objectif null (étape A3 passée) → barre seule, aucun repère inventé (cas B5 de la maquette).
   - Test pas encore fait : piste vide **avec** le repère et sa valeur (arbitrage 2 : la cible se voit avant de commencer, hauteurs homogènes dans le bloc).
   - Repli sans réglages (échelle inconnue) : la ligne garde son ancien texte sans barre.
3. **Textes** : nouvelles clés fr/en `listes.surMax`, `listes.barreAuDessus`, `listes.barreEnDessous`, `listes.barreObjectifAtteint`, `listes.barreVideObjectif` (libellés d'accessibilité de la barre). Aucune clé « objectif » visible n'a été créée, conformément à l'ajustement.

## Tests

`listesMini.test.tsx` passe de 12 à **19 tests** : assertions existantes alignées sur le nouveau format (score compact, méta « Tentatives : N · N questions ») et nouveaux verrous — fait au-dessus de l'objectif (repère à 800/990, valeur « 800 » au-dessus, **aucune légende textuelle** « Objectif » sur la carte, position dite en accessibilité), fait en dessous, pas encore fait (piste vide + repère + valeur), sans objectif (barre seule), mini par partie sans repère avec barre sur les questions, demi-test (repère à 400, valeur de section, objectif total dit en accessibilité), bloc collé unique (pas de contour par ligne, trait fin 1,5 px entre les lignes). Suites voisines relues : `tests.test.tsx` et `detailTest.test.tsx` verts (68 tests) ; ESLint propre sur les fichiers touchés.

## Validation et push

Validation locale complète (`npm run valider`) verte avant push : typage, ESLint (0 erreur), **Jest 235 suites / 2 631 tests**, export Android Hermes. Push par l'API GitHub (scripts `push_api_bin.py`, contrôle de tête distante) sur `claude/project-thread-kw792g` — le workflow « Contrôles et EAS preview » republie l'OTA preview si ses contrôles passent ; issue laissée ouverte pour la validation terrain de Benny, comme les lots précédents de ces listes.

## Captures de recette (app web locale, API de démonstration, Playwright)

Dans `~/workspace/captures-cartes-tests/` (390 px, clair + sombre, objectif semé à 800) :
- `liste-mixtes-390-clair.png` / `-sombre.png` : les six mixtes en un bloc collé, pistes vides avec repère « 800 », ligne conseillée en fond soleil très doux ;
- `liste-ecoute-390-clair.png` / `-sombre.png` : demi-tests d'écoute de la démo — n° 1 à **410** (remplissage au-delà du repère 400), n° 4 à **380** (remplissage en deçà), n° 2 conseillée et n° 3 pas faite en pistes vides avec repère.

## Retest pour Benny

Après la double relance de l'app preview (l'OTA se télécharge à une ouverture, s'applique à la suivante) : ouvrir les listes de tests (mixtes, une partie, demi-tests, complets) — les cartes forment un bloc collé, la barre montre le meilleur avec le repère de son objectif et sa valeur au-dessus ; aucun texte « Objectif » sur les cartes.
