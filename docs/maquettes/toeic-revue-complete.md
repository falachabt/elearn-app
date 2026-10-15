# Profil TOEIC : revue complète des écrans (15 octobre 2026)

Aperçu : `docs/maquettes/toeic-revue-complete.html` (ouvrir dans un navigateur). Clair et sombre, cadres de téléphone 360 x 780. Règles générales : `docs/design-regles.md`. Onboarding validé en amont : `docs/maquettes/toeic-parcours-arrivee.md`.

Montants de crédits et durées sont des exemples, pas des valeurs à figer.

## Écrans par parcours

1. **Arrivée et objectif (A1 à A3)** : Bienvenue avec la carte « Je prépare une certification », liste des certifications (TOEIC en bas, logo à fournir), objectif (600, 700, 800, 900, ou valeur libre entre 10 et 990, 800 par défaut), temps par jour (10, 20, 30 minutes).
2. **Diagnostic (A4)** : accueil « Mon TOEIC » avec le diagnostic proposé en premier.
3. **Réviser TOEIC (C, parcours D)** : onglets Parcours, Parties, Cours, Carnet, Tests ; navigation par parties 1 à 7 ; carte de maîtrise (sans rouge agressif) ; notions d'une partie avec état ; cours groupés par famille.
4. **Fiche d'une notion** : règle, exemples, piège TOEIC, faux amis, trois questions d'ancrage, bouton d'entraînement.
5. **Carnet de mots** : trois listes (à revoir, en cours, connus), recherche, fiche d'un mot avec audio et questions ratées, séance de mots en rappel espacé (recto, verso, « je savais / je ne savais pas »), fin de séance avec boîtes.
6. **Séance du jour et plan (D, H)** : séance du jour avec « Pourquoi cette séance ? » et composition, mon plan de la semaine, objectif et temps par jour dans Moi.

## Écrans encore absents ou à compléter

- Logo réel des certifications (un emplacement « LOGO À FOURNIR » est prévu, pas de faux logo).
- États vide, hors ligne, erreur et squelette pour chaque écran ; seuls quelques états sont dessinés.
- Résultats de recherche dans le carnet.
- Parcours d'un élève sans séance du jour.
- Explication d'une question avec notion nommée et « Pourquoi j'ai raté » : à reprendre dans la revue globale.
- Moteur d'exercice (sept types) et lecteur audio : hors de cet aperçu.
- Test blanc et page web de démo : non dessinés (V2 ou décision de Benny).

## Questions pour Benny

1. Logos des certifications : les fournit-il, ou garde-t-on l'emplacement ?
2. Temps par jour : 20 minutes par défaut, ou 10 ?
3. Les quatre écrans ajoutés au cours de la revue (crédits, signaler une erreur, quitter la série, pack audio manquant) restent-ils dans le périmètre ?
4. Budget ElevenLabs : 133 000 ou 131 000 par mois ? (le planning indique 133 000)

## Identifiants stables (version 2, 15 octobre 2026)

Chaque écran porte un identifiant `TOEIC-<section><n>`. Un identifiant ne change plus. Si un écran déjà livré est modifié, son identifiant reste le même et la modification est notée dans le fil.

| Section | Écrans | Contenu |
| --- | --- | --- |
| A | A1 à A8 | Arrivée, objectif, temps par jour, diagnostic et résultat (A1 à A5 = anciens O1 à O4 et A3) |
| B | B1 à B11 | Moteur d'exercice : sept types, lecteur audio, explication, « Pourquoi j'ai raté ? », fin de série |
| C | C1 à C9 | Réviser TOEIC : onglets, carte de maîtrise, parties, cours, notion, carnet, mot, séance de mots |
| D | D1 à D4 | Accueil TOEIC, séance du jour, mon plan, objectif dans Moi |
| E | E1 à E7 | Test blanc (V2, épreuve sombre) : introduction, Listening, transition, Reading, pause, bilan, coût |
| S | S1 à S9 | États transverses : squelette, erreurs, hors ligne, réponse non envoyée, vides, expiration |
| X | X1 à X4 | Écrans ajoutés, à valider : crédits, signaler une erreur, quitter la série, pack audio manquant |

Les états sont nommés dans l'écran concerné (par exemple TOEIC-S3 pour une série hors ligne). Le cahier des charges reprendra ces identifiants un par un.

## États du moteur d'exercice (version 2.1)

- `TOEIC-B1-CHARGE` à `TOEIC-B7-CHARGE` : chargement d'une question, un écran par type (squelette, valider grisé).
- `TOEIC-B1-AUDIO-KO` à `TOEIC-B4-AUDIO-KO` : son indisponible sur les types audio (parties 1 à 4). Le texte reste lisible ; « Réessayer le son » ou « Passer la question », la question est rejouée plus tard.
- `TOEIC-B3-ERR-AUDIO` : lecture interrompue dans une conversation, reprise sans recommencer, réponse gardée.
- `TOEIC-B8-ERR-AUDIO` : erreur de lecture dans le lecteur audio, reprise à la même position.

Les types 5 à 7 n'ont pas d'audio : leur seul état d'erreur est le chargement (`TOEIC-B5-CHARGE` à `TOEIC-B7-CHARGE`).

## Navigation du profil TOEIC (version 3)

- `TOEIC-N1` : accueil TOEIC (séance du jour, score estimé, reprise, accès rapides). Remplace le rôle de `TOEIC-D1` (accueil compact de la semaine 1).
- `TOEIC-N2` : Moi (objectif, temps par jour, crédits et Pass, certification, réglages).
- `TOEIC-N3` : Réviser, avec les sous-onglets Parcours, Parties, Cours, Carnet, Tests.
- Barre d'onglets : identique à celle de l'app (Accueil, Réviser, Photo, Questions, Moi). Aucun menu latéral ; deux niveaux maximum.
- Schéma complet, différences par profil et crédits : dans l'aperçu, en tête de page.
- Crédits : tableau des actions, proposition à valider par Benny (le cœur du produit reste gratuit, les montants viennent de la configuration serveur).

## Options de réponse (version 4)

- Une option sélectionnée n'affiche plus le libellé « Choisi » ni la coche. Elle est signalée par le fond vert, un contour plus épais (3 px) et une lettre inversée (fond sombre, lettre claire). Ce n'est donc pas la couleur seule qui la porte.
- Les libellés « Juste » et « Faux » (`TOEIC-B2`, `TOEIC-B5` et les autres types à correction) restent : ils donnent le résultat à quelqu'un qui ne voit pas la couleur, et la règle de design l'impose (`docs/design-regles.md`).
- Les identifiants ne changent pas.

## Onglet Tests, à la place de Questions (version 5)

Décision de Benny (15 octobre) : en profil TOEIC, il n'y a pas d'onglet Questions. L'onglet devient Tests.

- Barre d'onglets TOEIC : Accueil, Réviser, Photo, Tests, Moi. Les élèves et concours ne changent pas.
- `TOEIC-N3` (Réviser) : quatre sous-onglets, Parcours, Parties, Cours, Carnet. Tests n'est plus dedans.
- Nouveaux écrans : `TOEIC-T1` (accueil de Tests : mini-tests, test complet, score estimé), `TOEIC-T2` (réglage d'un mini-test : partie, longueur, temps, coût), `TOEIC-T3` (reprise d'un test interrompu), `TOEIC-T4` (historique et score estimé).
- Les tests complets gardent leurs identifiants `TOEIC-E1` à `TOEIC-E7` (V2).
- Les identifiants existants ne changent pas. `TOEIC-N3` est mis à jour (sous-onglet Tests retiré).

Question ouverte : la Photo (correction par photo) n'a pas de sens pour un examen à choix multiples. Elle ne sert en TOEIC que pour la rédaction, qui est hors périmètre (V2). Proposition : garder l'onglet Photo au centre pour l'instant, puis le remplacer ou le retirer quand la rédaction sera décidée.

## Crédits TOEIC et états manquants (version 6, cahier v1.4 section 12.6)

Montants : valeurs de seed du cahier, modifiables au back-office. Ils ne sont jamais écrits dans l'app ni dans les textes ; la maquette les montre comme exemples.

- `TOEIC-B9` : bouton « Explication détaillée · 1 crédit » ; « Question suivante » reste le bouton vert. Le reste de l'explication est gratuit.
- `TOEIC-T1` : coûts affichés sur les lignes. Mini-test par partie 1 crédit, mixte 2, demi-test 8, test complet 15, corrigé complet 3. Pass : 0 (« Avec le Pass, tout est inclus. »).
- `TOEIC-T2` : coût du mini-test : 1 crédit par partie, 2 en mixte, Pass 0.
- `TOEIC-T5` : demi-test (V2), nouvel écran.
- `TOEIC-T6` : test complet « Bientôt », bouton désactivé, nouvel état.
- `TOEIC-T7` : détail d'une tentative (score, temps, notions, questions ratées), nouvel état.
- `TOEIC-G1` : page « Gagner » en TOEIC : séance du jour terminée +2, 7 jours de suite +10, objectif atteint +20, premier mini-test mixte +3, plafond 15 par semaine.
- `TOEIC-E7` : le coût du test complet passe de 5 à 15 crédits (cahier 12.6).

Les identifiants existants ne changent pas. Les nouveaux sont T5, T6, T7 et G1.

## Écarts E-42 à E-45 (version 7, cahier v1.5)

- **E-42, coût de l'explication avec Pass** : `TOEIC-B9-PASS` (nouveau). Avec un Pass actif, le bouton devient « Explication détaillée · inclus au Pass », sans coût affiché. Proposition : ne pas afficher de coût à un élève qui n'en paie pas. Choix de produit à confirmer par Benny.
- **E-43, demi-test** : `TOEIC-T5` montre désormais deux demi-tests distincts, « écoute seule » et « lecture seule ». Les durées restent à fixer (elles ne figurent pas dans le cahier) ; la maquette ne les invente plus. Le coût (8 crédits, Pass 0) est inchangé.
- **E-44, test complet « Bientôt »** : `TOEIC-T6` ne promet plus de prévenir l'élève, car aucune notification n'existe pour ce cas. Texte : « Il n'est pas encore disponible. En attendant, les mini-tests et ton historique restent accessibles. » Si Benny veut une notification, c'est une exigence nouvelle à écrire dans le cahier.
- **E-45, phrase sur les crédits mis de côté** : retirée de `TOEIC-E7`. Le texte devient « Le montant vient du serveur et s'affiche avant le lancement. »
- Les identifiants existants ne changent pas ; `TOEIC-B9-PASS` est le seul nouvel identifiant de cette version.
