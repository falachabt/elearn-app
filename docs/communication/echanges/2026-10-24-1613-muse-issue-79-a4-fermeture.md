# Fermeture de la prise — issue #79 [TOEIC-A4] Temps par jour

- Date : 24 octobre 2026, 16:13 UTC
- Auteur : Muse
- Sujet : vérification de l'écran A4 existant, correction de l'écart E-06, captures de recette
- État : fait
- Zones touchées : `src/components/certification/TempsParJour.tsx`, `src/services/certification/reglages.ts`, `src/components/certification/__tests__/arrivee.test.tsx`, `src/services/certification/__tests__/apiFausse.ts`, `src/services/certification/__tests__/fixtures.ts`
- Commit : le correctif avait été commité en local (`54aca5b`), puis dé-commité le même jour sur la consigne « maquette d'abord » de Benny (échange de 16:14) ; il est poussé dans le commit de livraison du 24 octobre au soir, après validation de la maquette de parcours par Benny (hash : voir l'historique de la branche).

## Règle appliquée (consigne de Benny du 24 octobre 2026)

Avant de construire quoi que ce soit sur une issue TOEIC, vérifier systématiquement ce qui existe déjà (composant et son état réel, tests, cahier, revue d'écrans, maquettes, échanges, écarts catalogués) et partir de l'existant. C'est ce qui a été fait ici : **aucune réécriture** — l'écran existait, le travail était de la vérification et une correction ciblée.

## Ce qui existait déjà (état réel constaté)

- `TempsParJour.tsx` complet et conforme au §5.A du cahier v1.35 : textes exacts fr et en (en-tête, « Étape 4 sur 4 », titre, aides des trois durées, aide basse, « Commencer mon plan ») ; valeurs 10/20/30 servies par `cert_settings` ; présélection du défaut ou du choix déjà enregistré ; enregistrement par `ecrirePlan` (local puis serveur, sans bloquer) ; mode `modifier` pour D4 ; évènement `cert_daily_time_set` déclaré dans `evenements.ts` et au dictionnaire des évènements.
- Tests déjà présents : AC-A4-1 (20 présélectionné et recommandé), AC-A4-2 (enregistrement et ouverture de A5), relecture du choix enregistré (D4).
- Chaînage vérifié : AC-A4-2, le choix alimente F7 (`certSeance` lit `plan.minutes`, `accueil` retombe sur le défaut) ; AC-A4-3, le temps est modifiable et relu dans D4 (`ObjectifCertification` et mode `modifier` de A4).

## Ce qui manquait (écart E-06, catalogué au cahier ligne 782)

La résolution consignée de E-06 est : libellé « Recommandé pour ton objectif » porté **côté serveur** par `cert_settings.session_minutes_recommended`. La clé existe dans les données (démonstration alignée sur la production : 20) mais **l'app ne la lisait pas** : le composant affichait le libellé sur la ligne égale au défaut de présélection. Si le défaut changeait un jour, le libellé se déplaçait, apparaissait deux fois et la ligne devenue défaut perdait son aide descriptive. En production actuelle (défaut 20, recommandé 20), le rendu était juste par coïncidence.

## Ce qui a été fait

- `reglages.ts` : `seanceMinutesRecommande` lu depuis `session_minutes_recommended`, avec repli sur le défaut si la ligne est absente (anciennes lignes servies ou en cache) — un libellé d'aide ne doit pas faire échouer le chargement des réglages.
- `TempsParJour.tsx` : le libellé suit la recommandation servie ; chaque autre durée affiche l'aide descriptive que le cahier lui associe.
- Test E-06 ajouté (défaut servi à 10 via une surcharge de réglages de l'API fausse) : la présélection suit le défaut (10), l'aide descriptive de 10 s'affiche, « Recommandé » n'apparaît qu'une fois, sur la ligne 20. Le test échouait avant le correctif, il passe après.
- `fixtures.ts` : `session_minutes_recommended` (20) ajoutée au seed de test, en miroir des données servies.

## Validation

- `npm run valider` : vert — typage, ESLint, Jest complet (226 suites, 2 508 tests, dont le nouveau test E-06), export Android Hermes. Aucun flake rencontré.
- Captures de recette demandées par l'issue, faites sur l'app web locale (Expo web, API de démonstration embarquée, Playwright) : 390 et 360 px, clair et sombre, page entière (l'écran tient en une vue, haut et bas visibles) — 20 minutes présélectionnée et recommandée dans les quatre cas, aucun débordement à 360 px. Fichiers : `~/workspace/captures-a4-79/a4-390-clair.png`, `a4-390-sombre.png`, `a4-360-clair.png`, `a4-360-sombre.png`, script `capturer-a4.js` au même endroit. **À poster en commentaire de l'issue #79 après validation de Benny** (en même temps que le push).

## Suites

- Push effectué après le « oui » de Benny sur la maquette de parcours (24 octobre au soir) ; CI et OTA suivent le protocole habituel.
- L'issue #79 pourra alors passer en revue de fermeture par le manager qualité (captures jointes).
