# Issue #79 [TOEIC-A4] — maquette étendue au parcours complet (consigne de Benny)

- Date : 24 octobre 2026, 17:55 UTC (consigne de Benny du même jour)
- Auteur : Muse
- Sujet : la maquette de A4 devient une maquette de PARCOURS — première arrivée TOEIC A1 → A7 + entrée secondaire « modifier »
- État : ouvert (en attente de la validation de Benny sur la maquette de parcours)
- Zones touchées : aucune modification de code ; un échange ajouté (non commité, comme tout le travail #79 en attente)

## Règle reçue (nouvelle, permanente)

Benny : « un parcours, c'est un ensemble d'écrans qui sont liés à une fonctionnalité » — quand un écran appartient à un processus lié à d'autres écrans, la maquette montre le **parcours complet** (écrans dans l'ordre de navigation, avec les enchaînements), jamais un écran isolé. La maquette mono-écran A4 livrée à 16:14 UTC est donc étendue, sans être remplacée.

## Parcours déterminé (chaque lien sourcé : cahier v1.35 §5.A + navigation réelle du code)

Flux principal — première arrivée au profil TOEIC, sans compte, lot S1 :

1. **A1 · Bienvenue** (`ParcoursArrivee.Bienvenue`, écran partagé existant) — la carte « Je prépare une certification » (drapeau PostHog `cert_profile_enabled`) pousse vers `/certification`.
2. **A2 · Choix de la certification** (`ChoixCertification`, /certification) — « Continuer » enregistre le profil local et pousse vers `/certification/objectif` ; retour → A1, choix conservés.
3. **A3 · Objectif** (`ObjectifCertification`, /certification/objectif) — « Continuer » et « Passer pour l'instant » poussent vers `/certification/temps`.
4. **A4 · Temps par jour** (`TempsParJour`, /certification/temps) — « Commencer mon plan » enregistre (`ecrirePlan`) et `router.replace('/')` : l'accueil du profil affiche A5.
5. **A5 · Arrivée sur le profil TOEIC** (`ArriveeToeic` + `PreparationDiagnostic`, /certification/arrivee) — « Commencer le diagnostic » pousse vers `/certification/diagnostic` (évènement `cert_diagnostic_started`). A5 et S7 sont le même écran (écart E-07, fusion déjà faite dans le code).
6. **A6 · Question du diagnostic** (`Diagnostic` + `QuestionExercice`, /certification/diagnostic) — 20 questions, aucune correction ; avant la 1re question de chaque partie, `ConsignesPartie` s'intercale (D-P1/D-P3, signalé en légende, non dessiné) ; retour → feuille X3 (reprendre, ou quitter vers /certification/arrivee) ; dernière réponse → `router.replace('/certification/fin')`.
7. **A8 · Fin du diagnostic** (`FinDiagnostic`, /certification/fin) — « Voir mon résultat » → `router.replace('/certification/resultat')`.
8. **A7 · Résultat du diagnostic** (`ResultatDiagnostic`, /certification/resultat) — « Voir mon plan » termine le profil (`termine: true`) et `router.replace('/')` : accueil du profil (N1), première séance composée par F7 avec le temps choisi en A4. « Revoir mes réponses » → /certification/diagnostic-revue.

Entrée secondaire (hors première arrivée) : onglet **Moi** (`EcranMoi`, profil TOEIC) — ligne « Temps par jour » → `/certification/temps?modifier=1` (A4 sans étiquette d'étape, choix relu, bouton « Enregistrer », retour à Moi ; AC-A4-3) ; ligne voisine « Mon objectif » → `/certification/objectif?modifier=1` (A3 mode modifier, fiche D4 : score, date et minutes au même endroit).

## Maquette livrée

- Fichier : `~/workspace/maquettes-a4-79/maquette-parcours-a4.html` (autonome, hors dépôt, aucun commit ; la maquette mono-écran `maquette-a4-temps-par-jour.html` est conservée).
- Aperçu PNG de la planche complète : `~/workspace/maquettes-a4-79/maquette-parcours-a4.png` (Playwright, Chromium du cache ; aucun cadre ne déborde, vérifié par mesure et par lecture des cadres denses A1, A5, A7).
- Contenu : 10 cadres téléphone 390 px numérotés dans l'ordre du flux (A1, A2, A3, A4 arrivée, A4 autre choix E-06, A5, A6, A8, A7), flèches et bandes « suite du parcours » entre les rangées, un cartouche de sortie (accueil N1, non dessiné en cadre car hors arrivée), puis le cadre de l'entrée secondaire A4 « modifier » en bordure pointillée et un cartouche de lecture. Légende par écran : nom, code, ce qui s'y passe, ce que l'élève y fait, navigation sortante.
- Fidélité : **tous les écrans du parcours existent déjà en code** — la planche reflète l'existant (textes exacts de `src/i18n/fr.ts`, jetons de `src/theme/theme.ts`, géométrie des composants réels : `Ecran`, `EnteteToeic`, `LigneChoix`, `ChoixCarte`, `Carte`, `Champ`, `Curseur`, `Pastille` de A3, `OptionReponse`, `BarreProgression`, `PastilleEtat`, lecteur audio). Thème clair (le sombre de A4 reste dans la maquette mono-écran). Valeurs de A7 = exemples de la fiche du cahier ; A6 = exemple du cahier (partie 2, question 6).
- Écarts assumés et signalés sur la planche : le **logo officiel du TOEIC n'est pas encore fourni** (A1/A2 affichent l'icône Award de `LogoToeic` en repli — blocage connu de l'issue #77) ; **ConsignesPartie** n'est pas dessiné (mentionné dans la légende de A6) ; A5 est dessiné d'après l'écran réel (maquette TOEIC-A5 v16 : carte, tuiles, contenu), pas d'après l'ancienne description du §5.A (rangées Cours/Carnet/Séance).

## État du code

Aucun code modifié, aucun commit, aucun push dans cette étape. L'arbre de travail reste exactement celui décrit dans l'échange de 16:14 UTC (correctif E-06 en attente non commité, distant intact à `21fcc06`).

## Prochaine étape

Validation de la maquette de parcours par Benny. Après son accord : reprise du code en attente de l'issue #79, commit `muse:`, push et OTA selon le protocole habituel, captures postées en commentaire de l'issue #79.
