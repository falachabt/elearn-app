# Issue #125 — Correction : des tabs, pas des chips (25 octobre 2026, 15:32 UTC)

## Demande de Benny

En revoyant la capture de l'onglet Certification de la page de changement livrée par
l'échange `2026-10-25-1333-claude-choix-parcours-implementation-125.md`, Benny tranche :
**« Je veux des tabs, pas des chips »**. Le sélecteur des 3 parcours en haut de
`/profil/changer` était rendu en pastilles séparées (composant local `OngletChip` :
pilules à rayon plein, largeur au contenu, retour à la ligne possible) — il exige une
vraie **barre d'onglets**.

## Correctif

- La page utilise désormais le composant **`Onglets`** du design system (celui de
  Réviser, du rythme, de l'entraînement, des statistiques) : un cadre bordé
  (`bord.normal`, `rayon.m`) où **trois segments se partagent toute la largeur**
  (`flex: 1`), le segment consulté rempli en `fond.inverse`. `OngletChip` est supprimé.
- Le **point soleil** de la famille ACTIVE est conservé : prop optionnelle **`marque`**
  ajoutée à `Onglets` (additif, aucun des 8 usages existants ne change) — le segment de
  la famille active porte un point `accent.soleil` bordé `bord.fort`, lisible sur le
  segment rempli comme sur les segments en `fond.surface`, distinct de l'onglet consulté.
- **Aucun changement de comportement** : mêmes entrées (chip de l'accueil, Moi sur le bon
  onglet), même onglet par défaut, changer d'onglet ne bascule jamais le profil,
  adoption intra/inter-familles inchangée.

## Fichiers

- `src/components/Onglets.tsx` : prop `marque` + point soleil dans le segment marqué ;
  commentaire du composant (« barre d'onglets segmentée »).
- `src/components/profil/PageChangementParcours.tsx` : sélecteur remplacé par
  `<Onglets valeurs valeur onChange marque={famille} />` ; `OngletChip` et ses styles
  supprimés.
- `src/components/profil/__tests__/pageChangement.test.tsx` : +1 test — le point soleil
  (`testID="onglets-point-marque"`) est dans l'onglet de la famille active et y reste
  quand on consulte un autre onglet.

## Validation

`npm run valider` complet vert (exit 0) : typage, ESLint, **Jest 233 suites /
2 572 tests** (2 571 + le test du point), export Android Hermes.

## Captures (démo Playwright, `~/workspace/captures-parcours/`, suffixe `-tabs`)

`onglet-secondaire-tabs-{clair,sombre}.png`, `onglet-concours-tabs-{clair,sombre}.png`,
`onglet-certification-tabs-{clair,sombre}.png`,
`adoption-secondaire-depuis-concours-tabs-{clair,sombre}.png` (+ script
`capturer-tabs.js`). Vérifiées visuellement : barre pleine largeur, segment consulté
rempli, point soleil sur la famille active (Secondaire en consultant Concours ; Concours
en consultant Secondaire, thème sombre, bloc d'adoption dessous). Mêmes limites de démo
que la première passe : sans backend joignable, les listes Concours et Certification
s'affichent dans leurs états d'erreur réels, et l'icône de drapeau est une image cassée
(CDN injoignable depuis la VM).

## Planche

Les cadres 14 à 18 du parcours « Choix et changement de parcours »
(`~/workspace/maquettes-a4-79/maquette-parcours-a4.html`) dessinaient déjà la barre
(classes `.pc-tabs`) — l'écart était côté app. Seul ajustement de fidélité : l'ombre dure
de `.pc-tabs` est retirée (clair et sombre), le composant réel n'en a pas. Aperçu
`maquette-parcours-choix-apercu.png` régénéré (section complète, deux rangées et sources).

## Suite

Commits locaux sur kw792g, **aucun push** : la correction partira avec le push de #125,
en attente du « Pousse » de Benny.
