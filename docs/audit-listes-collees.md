# Audit des listes collées : écrans TOEIC

Règle de Benny (voir `docs/design-regles.md`, section 6) : les listes sont collées en un seul bloc (`GroupeColle` / `LigneGroupe`, `src/components/liste/ListeCollee.tsx`), avec un seul contour et des séparateurs fins. Exceptions : les options de réponse des questions de quiz (cartes séparées) et les grilles déjà collées (`GrilleCollee`).

Périmètre : `src/components/certification`, `src/app/certification`, et les écrans TOEIC de Moi, des paramètres du profil et du choix de profil. Les listes du parcours d'arrivée (commit e755339) n'ont pas été refaites.

## Déjà collés avant cet audit (rien à faire)

Via `ListeChoix` / `LigneChoix`, `GrilleCollee` ou `GroupeColle` : Réviser (liens, grilles des parties), Cours et Notions (grilles), Carnet de mots, Fiche notion (ancrages), Liste des tests d'un type, Choix de partie, Historique et Tentatives (lignes), Détail d'une tentative (notions, questions ratées, parties), Statistiques (parties, temps), Bilan de série et récap de la semaine, Gagner (gains), Séance du jour, Temps par jour, Réglage du mini-test, Choix du test (moitiés), Consignes de partie, Résultat du diagnostic, Préparation du diagnostic, Signaler une erreur, Choix de certification, Choisir un profil, Moi (lignes TOEIC et réglages), feuille d'explication payante.

## Écrans corrigés

| Écran | Avant | Après |
| --- | --- | --- |
| Tests (onglet) : mini-tests, puis demi-tests, test complet et corrigé | cinq `CarteTest` séparées par un écart | deux blocs collés (`GroupeTests`, dans `CarteTest.tsx`) ; la carte garde son contenu, son bouton et son opacité « Bientôt » ; ajoute `collee` / `premier` à `CarteTest` |
| Tests (onglet) : score estimé et tests faits | deux `Tuile` séparées | un bloc `TuilesCollees` |
| Carte de maîtrise (Réviser, Carte) | sept cartes de partie séparées | un seul `GroupeColle`, même contenu (nom, état, barre, pourcentage), même libellé d'accessibilité |
| Statistiques | quatre tuiles de décompte (vus, validés, maîtrisés, à revoir), deux tuiles meilleur score et tests faits, deux tuiles de mots, chacune séparée | trois blocs `TuilesCollees` |
| Historique des tests | deux tuiles (score, tendance) | un bloc `TuilesCollees` |
| Détail d'une tentative | tuiles score et temps | un bloc `TuilesCollees` |
| Fin de séance de mots | quatre tuiles des boîtes | un bloc `TuilesCollees` (2 colonnes) |
| Mon plan et Parcours (Réviser) : jours d'un groupe « Les jours suivants » ou « Semaine du… » une fois ouvert | cartes de jour séparées | un seul `GroupeColle` (lignes `EnteteJour` en mode collé) |
| Feuille « Pourquoi j'ai raté ? » | quatre cartes séparées | un seul `GroupeColle` |

Composant ajouté : `TuilesCollees` (`src/components/certification/ui.tsx`), qui s'appuie sur `GrilleCollee` (même hauteur partout, séparateurs fins). Aucun texte, aucune fonction, aucun libellé d'accessibilité n'a changé.

## Écrans laissés tels quels, et pourquoi

| Écran | Raison |
| --- | --- |
| Options de réponse (série, mini-test, diagnostic, exercice), propositions de la séance de mots | exception de Benny : options de quiz en cartes séparées |
| Frise de Mon plan : étapes du jour (heure, point, fil, carte) | chronologie : la carte est reliée à un fil, ce n'est pas une liste de lignes sans hiérarchie |
| Mon plan : « Aujourd'hui », « Demain », jours de test, « Les jours suivants », semaines (en-têtes repliés) | chaque en-tête est suivi de son propre contenu (étapes dépliées), la liste n'est pas continue |
| Choix de durée, de palier d'objectif, de partie du mini-test (`Cube`, `GrilleEgale`) | sélecteurs compacts à état actif (bordure épaisse), pas des lignes de liste |
| Onglets et puces (mots-clés, notions de fin de série, chips de document) | ce sont des boutons ou des étiquettes en ligne, pas des lignes |
| Cartes seules (score, séance verte, couverture, bilan, correction, progression, invitation en pointillés, lecteur audio) | un seul élément : rien à coller |
| Tuile isolée « jours de la semaine » dans Statistiques | une seule tuile |
| Statistiques : barres par catégorie de cours | lignes sans contour, rien à coller |
| Détail par partie du bilan, Résultat du diagnostic (barres de maîtrise) | déjà un seul bloc contenant ses lignes |

## À noter

- `ConsignesPartie.tsx` garde une fonction `CarteConsigne` et ses styles (`zone`, `ombre`, `carte`, `pastille`, `texte`) qui ne sont plus utilisés depuis le passage aux lignes collées : code mort à retirer.
- Tests : `src/components/certification/__tests__/listesCollees.test.tsx` (feuille Pourquoi j'ai raté, carte de maîtrise, tuiles, jours de Mon plan), `testsGabarit.test.tsx` (cartes de l'onglet Tests en deux blocs).
