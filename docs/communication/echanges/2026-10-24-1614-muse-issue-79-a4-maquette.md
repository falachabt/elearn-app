# Issue #79 [TOEIC-A4] — séquence modifiée : maquette HTML d'abord, code en attente

- Date : 24 octobre 2026, 16:14 UTC (consigne de Benny)
- Auteur : Muse
- Sujet : arrêt de l'implémentation React Native de A4 jusqu'à validation d'une maquette HTML
- État : ouvert (en attente de la validation de Benny sur la maquette)
- Zones touchées : aucune modification de code dans cette étape

## Consigne reçue

Benny change la séquence pour l'issue #79 (et en fait la règle pour les écrans) : **maquette HTML d'abord**, fidèle au design system réel (fichier theme, composants réels, bordures et effet néo-brutaliste du produit), validation du rendu par Benny, **ensuite seulement** l'implémentation. Ne pas implémenter l'écran A4 en React Native pour l'instant.

## État exact du code (transparence)

Le correctif E-06 avait été écrit et **commité en local** lors de la séquence précédente (commits `54aca5b` et `cc469eb`, jamais poussés, distant intact à `21fcc06`). Pour appliquer la consigne, ces deux commits ont été **dé-commités** (`git reset --mixed 21fcc06`) : la branche locale est revenue à la tête distante et **tout le travail est présent en modifications non commitées** dans l'arbre de travail (6 fichiers modifiés : `TempsParJour.tsx`, `reglages.ts`, tests et fixtures ; plus les échanges de prise et de fermeture, non suivis). Rien n'a été perdu, rien n'a été poussé. Ce code reste **en attente** : il ne sera repris, commité et poussé qu'après la validation de la maquette par Benny.

Rappel du contenu en attente (détail dans l'échange de fermeture du même jour) : écran A4 déjà existant et vérifié conforme au §5.A ; seul écart, E-06 — le libellé « Recommandé » branché sur le réglage serveur `session_minutes_recommended` au lieu du défaut de présélection ; validation `npm run valider` verte au moment de l'écriture (226 suites, 2 508 tests) ; captures réelles de l'app faites (360/390, clair/sombre).

## Maquette livrée

- Fichier : `~/workspace/maquettes-a4-79/maquette-a4-temps-par-jour.html` (autonome, hors dépôt, aucun commit).
- Trois cadres téléphone 390 px côte à côte, numérotés, avec légendes : **1 · Clair — arrivée** (20 minutes présélectionnée, « Recommandé » sur cette ligne), **2 · Sombre — même état**, **3 · Clair — autre choix** (30 minutes sélectionnée, « Recommandé » resté sur 20 : le comportement E-06 à valider).
- Fidélité : jetons copiés de `src/theme/theme.ts` (fond papier 50 `#FFF7E3` / encre 900 `#141614` en sombre, bordures 2 px et 3 px sur la ligne active, ombres dures sans flou, rayons 14/10/6, vert émeraude 500/400, pastille soleil très doux) et géométrie des composants réels (`Ecran`, `EnteteToeic` + `BoutonFermer` 44 px, `LigneChoix` pastille 40 px et radio 28 px, `Bouton` 52 px en pied) ; polices réelles de l'app (Archivo Black, Space Grotesk, Space Mono) ; libellés = textes exacts du cahier §5.A.

## Prochaine étape

Validation de la maquette par Benny. Après son accord : reprise du code en attente, commit `muse:`, push et OTA selon le protocole habituel, captures postées en commentaire de l'issue #79.
