# Tour de première fois du diagnostic — implémentation (issue #123)

**De :** Muse — **Date :** 25 octobre 2026 — **Statut :** implémenté et validé en local, commits locaux sur `claude/project-thread-kw792g`, **push en attente du « Pousse » de Benny**.

## Changement de forme (décision de Benny, 25 octobre 2026)

Le corps de l'issue #123 prévoyait une feuille au moment 1 et une **visite projecteur** en 3 étapes (`Visite`) au moment 2. **Benny a tranché le 25 octobre 2026 : feuille du bas aux deux moments, aucun tour projecteur** — au moment 2, la feuille dit simplement « plusieurs questions, plusieurs documents ». Le présent échange fait foi ; le commentaire de livraison sur l'issue annoncera le changement au moment du push. La planche du parcours (`maquettes-a4-79/maquette-parcours-a4.html`) a été mise à jour en conséquence : les cadres « Visite 1/3 – 3/3 » sont remplacés par le cadre de la feuille partie 7, dans les deux thèmes.

## Ce qui est livré

- **Service de drapeaux** `src/services/certification/tourDiagnostic.ts` (patron des annales) : deux drapeaux indépendants par appareil, `cert.tourDiagnostic.audio.vue` et `cert.tourDiagnostic.partie7.vue` (valeur `'1'`) ; lecture en échec = déjà vu (`tourDiagnosticDejaVu`), écriture sans jamais lever (`marquerTourDiagnosticVu`), posés **à la fermeture** de chaque feuille.
- **Composant** `src/components/certification/FeuilleTourDiagnostic.tsx` : habillage `Feuille` maison (aucune modification de `Feuille.tsx` ni de `Visite.tsx`), pastille soleil à icône Lucide (`Layers` pour l'audio, `Files` pour la partie 7), explications numérotées (pastilles soleil), bouton « C'est parti ». Aucun `surCible`, aucune cible à mesurer : le lecteur à écoute unique n'est pas touché.
- **Câblage** dans `src/components/certification/Diagnostic.tsx` (seul écran touché) : un contrôle par groupe affiché, sur la phase question, une fois les consignes de la partie passées :
  - **Moment 1** : premier groupe avec `membres.length > 1 && membres[0].group?.audio_path` (en pratique la partie 3) → feuille « Un audio, plusieurs questions » : une réponse par question pour pouvoir valider ; choisir une réponse fait passer automatiquement à la question suivante ; les onglets du haut permettent de revenir.
  - **Moment 2** : premier groupe avec `part === 7 && membres.length > 1 && documentsDuPassage(passage).length > 1` → feuille « Plusieurs questions, plusieurs documents » : plusieurs questions (onglets « Question »), plusieurs documents (touche « Doc. 1 / Doc. 2 »). **Différé** si le premier groupe de partie 7 servi n'a qu'un document : la feuille attend le premier groupe multi-documents.
  - Piège rencontré pendant l'implémentation : ne pas annuler la lecture du drapeau au nettoyage de l'effet — un rendu intermédiaire (réinitialisation des réponses au changement de groupe) perdait l'ouverture ; le garde-fou « un contrôle par groupe » suffit, sans annulation.
- **Textes** `certification.tour.*` en français et en anglais (`src/i18n/fr.ts`, `src/i18n/en.ts`). **Aucun événement analytics ajouté** (présentation pure, comme les consignes de partie).
- **Aucune modification** de `Visite.tsx`, `Feuille.tsx`, `groupes.ts`, `QuestionExercice.tsx` (son export `documentsDuPassage` est seulement importé) ni des écrans Tests, Réviser, Statistiques.

## Tests

- `src/services/certification/__tests__/tourDiagnostic.test.ts` (4 tests) : non vu par défaut ; marquage indépendant par moment ; échec de lecture = déjà vu ; échec d'écriture ne lève pas.
- `src/components/certification/__tests__/diagnostic.test.tsx`, bloc « A6 · Tour de première fois du diagnostic (#123) » (6 tests) : feuille audio ouverte au premier groupe audio et drapeau posé à la fermeture ; aucune feuille si le drapeau est pré-posé ; pas de seconde feuille au groupe audio suivant (partie 4) ; aucune feuille sur le groupe de partie 6 ; feuille partie 7 au premier groupe multi-documents, drapeau partie 7 seul posé ; cas différé (premier groupe P7 à un document → feuille au groupe multi-documents suivant).
- **Validation complète `npm run valider` verte** (typecheck, ESLint, Jest complet, export Android Hermes).

## Captures de recette (démo, `EXPO_PUBLIC_CERT_DEMO=1`)

Dossier `~/workspace/captures-tour-123/` (contextes navigateur neufs à chaque passage : drapeaux non posés) :

- `moment1-feuille-audio-390-clair.png` et `moment1-feuille-audio-390-sombre.png` : feuille audio ouverte sur le premier groupe de partie 3 (« Diagnostic · 4 / 21 »).
- `moment2-feuille-partie7-390-clair.png` et `moment2-feuille-partie7-390-sombre.png` : feuille partie 7 ouverte sur le premier groupe multi-documents (« Diagnostic · 17 / 21 », onglets « Doc. » visibles derrière la feuille) ; le journal du passage montre le drapeau audio déjà posé (la feuille du moment 1 a été fermée en chemin, comme pour un élève) et le drapeau partie 7 encore non posé (feuille ouverte).
- Observation au passage : la banque de démonstration contient aussi des groupes de partie 7 à **document unique** (ex. `g-p7_4`, `multi: false`) — sur ces tirages, aucune feuille ne s'ouvre en partie 7, ce qui est le comportement voulu (la condition porte sur les documents du groupe servi) ; les captures du moment 2 ont donc été prises sur des tirages multi-documents, après plusieurs essais documentés dans le journal de capture.
