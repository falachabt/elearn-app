# Demi-tests : score des cartes des listes converti en équivalent 990 — correctif

- **Date** : 31 octobre 2026 (23 h 55 UTC)
- **Auteur** : Muse
- **État** : implémenté, validé en local, poussé sur `claude/project-thread-kw792g` ; en attente de validation terrain de Benny (double relance de l'app preview)
- **Suite de** : `echanges/2026-10-29-1120-claude-cartes-tests-barre-objectif-implementation.md` (commit `0688f8d`) — ce correctif ne touche que le volet demi-tests de ce lot.
- **Zones touchées** : `src/components/certification/ListeTests.tsx`, `src/components/certification/__tests__/listesMini.test.tsx`, `src/i18n/fr.ts` et `src/i18n/en.ts` (clés `certification.tests.listes.*`). Réassignation ponctuelle de Benny pour ce chantier, comme le lot du 29 octobre.

## Décision de Benny (1er novembre 2026)

Sur les cartes des listes demi-tests (écoute et lecture), le lot du 29 octobre plaçait le repère à la moitié de l'objectif, étiqueté de la valeur de section (« 400 » pour un objectif de 800). Benny : « 800 n'est pas bon pour les demi », « essaie de faire une sorte d'équivalence, une règle de 3 », puis choix explicite entre les deux lectures proposées : **« Score converti en équivalent 990, repère à 800 »**. Il croyait le correctif déjà fait (« je pense que c'est déjà fait je crois ») — vérification faite avant de toucher au code : **ce n'était pas le cas**.

## État AVANT, prouvé (code + captures)

Dans le code livré par `0688f8d` : pour `listening` / `reading`, l'échelle de la barre valait `objectifMax / 2` (495), le repère valait `objectifTotal / 2` et `BarreScoreObjectif` écrivait cette valeur de section (« 400 ») au-dessus du repère ; la ligne lisait « 410 sur 495 » et l'en-tête de liste annonçait « Meilleur de la section : 410 sur 495 ».

Captures AVANT (app web locale, API de démonstration `EXPO_PUBLIC_CERT_DEMO_STATS=1`, objectif semé à 800, script `capturer-demi.js`) dans `~/workspace/captures-demi-equivalence/` : `avant-liste-ecoute-390-clair.png` / `-sombre.png` (écoute n° 1 à 410 et n° 4 à 380, « sur 495 », repère « 400 »), `avant-liste-lecture-390-clair.png` / `-sombre.png` (lecture n° 1 à 395, repère « 400 »).

## Correctif (affichage seulement — aucune donnée, aucun serveur)

Dans `ListeTests.tsx` uniquement ; mixtes, test complet et minis par partie inchangés :

1. **Conversion par règle de 3** : `equivalentTotal(score) = score × objectifMax / sectionMax` (× 990/495). Les scores TOEIC sont des multiples de 5, l'équivalent tombe juste (385 → 770). Le score converti remplit la barre et s'écrit en compact sur la carte : « **770** équiv. · sur 990 » (nouvelle clé `listes.equivSurMax` fr/en) — une ligne, aucun passage à la ligne, conformément à la règle de Benny.
2. **Barre sur l'échelle totale** : pour un demi-test, `echelle` vaut désormais `objectifMax` (990), comme mixtes et complet.
3. **Repère à l'objectif total réel** : `repere = objectifTotal` pour les demi-tests aussi ; la valeur écrite au-dessus du repère est donc « 800 » — la même que sur les mixtes et le complet.
4. **En-tête de liste rendu cohérent** : il annonçait l'échelle 495 (« Meilleur de la section : 410 sur 495 ») que plus aucune carte n'affiche ; il annonce désormais l'équivalent (nouvelle clé `listes.meilleurSectionEquiv` : « Meilleur de la section : 820 équiv. sur 990 »).
5. **Le vrai score de section reste la référence** : détail du test, bilan et historique (« sur 495 ») inchangés ; sur la carte elle-même, il vit dans le **libellé d'accessibilité** de la barre (« Meilleur : 385 sur 495, en dessous de ton objectif de 800 »), la position au-dessus / en dessous étant jugée entre l'équivalent et l'objectif total.
6. **Cas limites** : pas encore fait → piste vide sur 990, repère déjà à l'objectif total étiqueté de sa valeur ; sans objectif (plan sans `objectif`) → conversion affichée, aucun repère inventé ; meilleur nul → piste vide ; sans réglages (échelle inconnue) → repli texte d'origine, inchangé.

## Tests

`listesMini.test.tsx` passe de 19 à **23 tests**. L'ancien verrou demi-test (« repère à la moitié de l'objectif, valeur de section 400 ») est remplacé par le verrou de la conversion : écoute 385 → « 770 équiv. · sur 990 », en-tête converti, aucune trace visible de « sur 495 », repère à (800/990) étiqueté 800, barre `{ min: 0, max: 990, now: 770 }`, libellé d'accessibilité au vrai score de section. Nouveaux verrous : lecture au-dessus après conversion (450 → 900, « au-dessus de ton objectif de 800 »), demi-test sans objectif (conversion sans repère), demi-test pas encore fait (piste vide sur 990, repère à 800), test complet inchangé (720 natif « sur 990 » en en-tête et sur la carte, aucune mention « équiv. », repère à 800). Non-régression mixtes et minis couverte par les verrous existants du lot du 29 octobre.

## Validation et push

Validation locale complète (`npm run valider`) verte avant push : typage, ESLint (0 erreur, 0 avertissement), Jest complet (dont `listesMini` 23/23), export Android Hermes. Push par l'API GitHub (script `push_api_bin.py`, contrôle de tête distante `0688f8d` et contrôle fichier par fichier par hash de blob : les écarts distants se limitaient exactement à ce correctif). Le workflow « Contrôles et EAS preview » republie l'OTA preview si ses contrôles passent.

## Captures APRÈS (même recette que l'AVANT)

Dans `~/workspace/captures-demi-equivalence/` : `apres-liste-ecoute-390-clair.png` / `-sombre.png` — en-tête « Meilleur de la section : 820 équiv. sur 990 », écoute n° 1 « 820 équiv. · sur 990 » (remplissage au-delà du repère « 800 »), n° 4 « 760 équiv. · sur 990 » (en deçà), pistes vides avec repère « 800 » ; `apres-liste-lecture-390-clair.png` / `-sombre.png` — lecture n° 1 « 790 équiv. · sur 990 » (395 → 790, juste sous le repère). Plus aucune valeur « 400 » comme repère.

## Retest pour Benny

Après la double relance de l'app preview : ouvrir « Demi-tests d'écoute » et « Demi-tests de lecture » — les meilleurs s'y lisent en « équiv. · sur 990 », le repère porte son objectif réel avec sa valeur au-dessus (comme sur les mixtes), et l'en-tête annonce le même équivalent. Le détail d'un demi-test, son bilan et l'historique continuent d'afficher le vrai score de section « sur 495 » : c'est voulu, seule la liste convertit.
