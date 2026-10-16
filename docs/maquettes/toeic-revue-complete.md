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

## Durées des demi-tests (version 8, cahier v1.6)

- `TOEIC-T5` : demi-test écoute, parties 1 à 4, 100 questions, 45 minutes. Demi-test lecture, parties 5 à 7, 100 questions, 75 minutes. Chacun 8 crédits, Pass 0. Les durées « à fixer » sont remplacées.

## Barre TOEIC : Photo remplacée par Statistiques (version 9, décision de Benny du 15 octobre)

- Barre TOEIC : Accueil, Réviser, **Tests (au centre)**, Statistiques, Moi. Tests occupe la place centrale que tenait Photo dans l'app, car c'est l'action principale du profil TOEIC. Statistiques est à côté de Moi, parce que la progression se lit là.
- Photo n'apparaît plus dans le profil TOEIC. La correction par photo reste dans les autres profils ; elle ne sert à rien à un examen à choix multiples.
- `TOEIC-ST1` : page Statistiques. Score estimé dans le temps, maîtrise par partie (P1 à P7, état par icône et texte), mots du carnet, régularité, temps passé, accès à l'historique (`TOEIC-T4`). Les segments Semaine, Mois et Tout ne sont dessinés que pour Semaine.
- `TOEIC-ST2` : vide, pas encore de statistiques (nouvel élève).
- `TOEIC-ST3` : première semaine, quelques données, pas encore de tendance.
- `TOEIC-ST4` : hors ligne, dernier calcul daté, mise à jour à la reconnexion.
- `TOEIC-B9` : le bouton devient « Explication détaillée » avec un badge « 1 crédit ». Le badge disparaît quand le coût est nul (Pass actif). C'est une règle, pas un écran : `TOEIC-B9-PASS` est supprimé.
- `TOEIC-G1` : validé tel quel par Benny.
- Les identifiants existants ne changent pas. Nouveaux : `TOEIC-ST1` à `TOEIC-ST4`. Supprimé : `TOEIC-B9-PASS`.

## Variante en attente : expiration des crédits gagnés (version 10, cahier v1.8)

Non activée : Benny n'a pas encore confirmé l'expiration à 30 jours des crédits gagnés. Les deux écrans sont dans la section « Variante en attente ».

- `TOEIC-X5` : feuille de coût. Ligne ajoutée sous le solde : « dont {e} à utiliser avant le {date} ». Les valeurs de la maquette (12 crédits, 14 novembre 2026) sont des exemples.
- `TOEIC-X6` : Moi, ligne « Crédits et Pass » avec la même mention.
- Les écrans actuels (TOEIC-X1, TOEIC-N2) restent la version valide tant que la variante n'est pas confirmée.
- Les identifiants existants ne changent pas. Nouveaux : `TOEIC-X5` et `TOEIC-X6`.

## Expiration des crédits gagnés : validée (version 11, réponse de Benny)

Benny a répondu « Oui, 30 jours ». La variante est active.

- `TOEIC-X5` : feuille de coût avec « dont {e} à utiliser avant le {date} ». **Valide**. Remplace `TOEIC-X1` pour le solde.
- `TOEIC-X6` : solde dans Moi, avec la même mention. **Valide**. Remplace la ligne « Crédits et Pass » de `TOEIC-N2`.
- `TOEIC-X1` et `TOEIC-N2` restent dans l'aperçu, marqués comme remplacés pour ces parties.
- Les valeurs affichées (12 crédits, 14 novembre 2026) sont des exemples : le montant et la date viennent du serveur.

## Date du test saisie au clavier (version 12, cahier v1.10, E-50)

L'objectif de score (écran A3) se saisit au clavier au format JJ/MM/AAAA. Pas de calendrier natif, donc pas de nouvel APK.

- `TOEIC-A3-DATE-VIDE` : champ vide, placeholder « JJ/MM/AAAA », date facultative, « Continuer » actif.
- `TOEIC-A3-DATE-VALIDE` : date saisie, coche placée dans la ligne de message sous le champ (pas dans le champ), texte « Test le … : il reste N jours », « Continuer » actif.
- `TOEIC-A3-DATE-FORMAT` : format invalide (JJ/MM sans année), message avec icône et texte, bordure épaissie, « Continuer » désactivé.
- `TOEIC-A3-DATE-PASSEE` : date passée, message « Cette date est passée. Choisis une date à venir. », « Continuer » désactivé.
- `TOEIC-A3` (écran d'origine, champ calendrier) : remplacé pour la date par les quatre états ci-dessus.
- Les états s'appuient sur le texte et l'icône, pas sur la couleur seule.

## Alignement E-04 et coche de la date (version 13, cahier v1.10)

- E-04 : l'étiquette de A3 passe à « TOEIC · étape 3 sur 4 », le parcours comptant 4 étapes avec A4 (« Étape 4 sur 4 »). A1 et A2 n'ont pas de compteur dans la maquette ni dans le cahier : aucun compteur ajouté.
- La coche de `TOEIC-A3-DATE-VALIDE` est dans la ligne de message sous le champ, comme dans le code ; le champ ne porte plus d'icône.
- Identifiants inchangés.

## Moi et Accueil TOEIC repris de l'app secondaire (version 14, 16 octobre 2026)

Demande de Benny (16/10) : repartir de la page Moi et de l'accueil du secondaire, garder ce qui est propre au TOEIC, et prévoir la déconnexion.

- `TOEIC-N1` (Accueil) : **révisé**. Carte « Séance du jour » verte (comme la mission du jour du secondaire), bloc « Test dans N jours » avec date d'examen et avancement du plan, score estimé, mots à revoir, reprise. Les accès rapides ont été retirés : les onglets les remplacent.
- `TOEIC-D1` (Accueil après le diagnostic) : **révisé**, même structure que N1, avec le diagnostic à la place du score estimé.
- `TOEIC-N2` (Moi) : **révisé**, en-tête identité repris du secondaire, puis `Progression vers ton objectif` à la place des points XP (score visé 800, score estimé 650 à 730, écart 70 à 150 points). Pas de points XP en certification.
- `TOEIC-N2-2` (Moi, suite) : **nouveau**. Certification, parent, identifiant, aide, réglages, puis la ligne « Se déconnecter » visible.
- `TOEIC-N2-DECO` (confirmation) : **nouveau**. Feuille « Se déconnecter ? » avec « Annuler » (action verte) et « Se déconnecter » (secondaire).
- Hors maquette, à trancher : « Documents » (factures et reçus) et « Parrainage » du secondaire ne sont pas dessinés dans cette version, par manque de place sous la barre d'onglets.
- Les montants et dates sont des exemples : le solde, le score et la date viennent du serveur.

## Page avant diagnostic : préparation (version 15, 16 octobre 2026)

Demande de Benny (16/10) : sur « Mon TOEIC » avant le diagnostic, ne plus afficher les cartes Cours, Carnet de mots et Séance du jour. Montrer ce que le diagnostic contient, puis le bouton pour commencer.

- `TOEIC-A5` (arrivée, sans barre d'onglets) : **révisé**. Badge « Premier pas », « Commence par le diagnostic », trois repères (20 questions, environ 15 minutes, gratuit), ce qu'il contient (écoute parties 1 à 4, 10 questions ; lecture parties 5 à 7, 10 questions), ce que ça donne (estimation sur 990, fourchette large, carte de maîtrise, pas un score officiel), règle du passage (une question passée compte fausse), sans compte. Bouton « Commencer le diagnostic ».
- `TOEIC-S7` (Mon TOEIC avant diagnostic, avec la barre d'onglets) : **révisé**, même page. Le bloc « Ce que ça donne » est retiré pour tenir sous le bouton.
- Plus aucune carte vide dans cette page.
- Les chiffres (20 questions, 10 et 10, environ 15 minutes) viennent du cahier, section A5 et A6.
- Point hors maquette, signalé à Benny : la première question du diagnostic n'a pas d'image (contenu partie 1, à fournir).

## Changer de profil : secondaire, concours ou TOEIC (version 16, 16 octobre 2026)

Demande de Benny (16/10) : dans Moi, « changer de classe ou de concours » devient un choix de profil en trois. Choisir le TOEIC bascule vers la mise en page TOEIC ; depuis Moi TOEIC, on peut revenir au secondaire ou à un concours. La page Moi TOEIC part de Moi du secondaire, avec quelques lignes en plus ou en moins.

- `TOEIC-P1` : Moi secondaire ou concours. La ligne « Classe » devient « Mon profil » (« Secondaire · Terminale · changer »). Lignes du bas non dessinées, inchangées.
- `TOEIC-P2` : choix du profil. Trois choix : Secondaire (6e à terminale), Candidat à un concours, Je prépare une certification (TOEIC, puis d'autres examens). Le profil actuel porte la mention « Actuel ». Continuer.
- `TOEIC-P3-SEC` : choix de la classe, de la 6e à la terminale.
- `TOEIC-P3-CONC` : choix du concours, dans la liste du pays.
- `TOEIC-P4` : confirmation pour passer au TOEIC (feuille sur Moi secondaire). Le profil secondaire reste enregistré.
- `TOEIC-P5` : confirmation pour revenir au secondaire ou au concours (feuille sur Moi TOEIC). Le profil TOEIC reste enregistré.
- `TOEIC-P6-CHARGE` : changement en cours, bouton désactivé.
- `TOEIC-P6-ERR` : changement impossible. Le profil n'a pas changé ; réessayer ou rester sur le profil actuel.
- `TOEIC-N2-2` (Moi TOEIC, suite) : **révisé**. La ligne « Certification » devient « Mon profil · TOEIC · changer de profil ».
- Textes à valider avec le cahier : la liste des concours dépend du pays (non écrite ici). Les états de P6 ne sont pas encore dessinés en sombre dans le détail des feuilles, mais le moteur les rend dans les deux thèmes.

## Changer de profil : une seule page (version 17, retour de Benny du 16 octobre)

Retour de Benny : le changement de profil ne se fait pas par des écrans séparés. C'est la page de choix de classe ou de concours de l'app (`ChoixClasse`, `src/components/ParcoursArrivee.tsx`, mode modification depuis Moi). Écart relevé : la version 16 avait découpé ce choix en étapes qui n'existent pas dans l'app. Cause : la maquette, pas le code.

- `TOEIC-P1` : Moi secondaire ou concours. Ligne « Mon profil » (remplace « Classe ») qui ouvre P2.
- `TOEIC-P2-ELEVE` : statut « Je suis élève ». Étape 1 « Ta classe » (6e à Tle), étape 2 « Ton pays », « Enregistrer ».
- `TOEIC-P2-CONC` : statut « Je prépare un concours ». Étape 1 « Ton concours » (carte « Mon concours », « Changer » vers la liste ENS, Médecine, Écoles d'ingénieurs), étape 2 « Ton pays », « Enregistrer ».
- `TOEIC-P2-CERT` : statut « Je prépare une certification ». Étape 1 « Ton examen » (TOEIC, seul disponible ; d'autres à venir), étape 2 « Ton pays », « Enregistrer ». Le choix mène au layout TOEIC.
- `TOEIC-P4` : confirmation « Passer au profil TOEIC ? », après « Enregistrer » depuis P2-CERT. Le secondaire reste enregistré.
- `TOEIC-P5` : confirmation « Revenir au secondaire ? », après « Enregistrer » depuis le TOEIC. Le profil TOEIC reste enregistré.
- `TOEIC-P6-CHARGE` et `TOEIC-P6-ERR` : inchangés (changement en cours, changement impossible).
- Les anciens identifiants `TOEIC-P3-SEC` et `TOEIC-P3-CONC` sont retirés : leur contenu est dans P2-ELEVE et P2-CONC.
- Pas de barre d'onglets sur P2 : la page est plein écran, comme dans l'app.


## Moi TOEIC : copie de la page Moi de l'app (version 19, 16 octobre 2026)

Demande de Benny (16/10) : la page Moi TOEIC doit être la page Moi du secondaire ou du concours (`src/components/EcranMoi.tsx`), avec les mêmes composants, invité compris. Seuls écarts : la carte XP est remplacée par « Progression vers ton objectif » (capture de Benny), et les lignes propres au TOEIC sont ajoutées.

- `TOEIC-N2` (connecté, haut) : en-tête, bloc progression à la place de la carte XP, carte « Crédits et Pass », « Ma progression », « Mes documents ».
- `TOEIC-N2-2` (connecté, milieu) : « Parrainage et récompenses », « Mes paiements », « Mon profil · TOEIC · changer de profil », « Parent ou tuteur ».
- `TOEIC-N2-3` (connecté, bas) : « Mon identifiant », « Aide et contact », ajouts « Mon objectif » et « Temps par jour », « Se déconnecter » (ligne en tiretés).
- `TOEIC-N2-INV` (invité, haut) : en-tête « Invité », carte de bienvenue à la place de la carte de crédits (comme Moi invité), puis le bloc progression.
- `TOEIC-N2-INV-2` (invité, bas) : « Ma progression », « Mes documents », « Parrainage et récompenses », « Mon profil », « Aide et contact ».
- `TOEIC-N2-DECO` : confirmation « Se déconnecter ? » sur la page bas.
- `TOEIC-P1` et `TOEIC-P1-2` : la page Moi secondaire ou concours, pour comparaison (haut et bas).

Écarts par rapport à Moi du secondaire :
- **Remplacée** : la carte XP (« Carte XP et niveau ») par le bloc « Progression vers ton objectif ».
- **Ajoutées** : « Mon objectif » (score 800, date du test) et « Temps par jour » (groupe TOEIC, en bas) ; « Se déconnecter » (la déconnexion du secondaire se trouve dans Réglages).
- **Retirées** : « Ma semaine » (écran du secondaire, qui ne décrit pas les séances TOEIC) et « Gagner des crédits » (déjà présent dans la carte de crédits).
- **Invité** : le bloc progression s'affiche aussi sans compte, parce que le diagnostic est gratuit ; c'est un écart à faire valider.
- Une ligne du bas n'est jamais dessinée sous la barre d'onglets : la page est découpée en cadres haut, milieu et bas.

## Groupes de questions et consignes de partie (version 20, 16 octobre 2026)

Demande de Benny (16/10, 21:32) : un audio est écouté une seule fois, puis ses questions se répondent sur le même écran (parties 3, 4, 6 et 7 concernées). Avant chaque partie, des consignes expliquent le déroulé, comme au vrai TOEIC, avec une transition entre les parties.

- `TOEIC-G1-Q1` : groupe de la partie 3, audio en cours, onglets « Question 32 · 33 · 34 », une seule écoute.
- `TOEIC-G1-Q2` : même groupe, question 32 répondue (coche, pas seulement la couleur), question 33 affichée. Pas de bouton de réécoute.
- `TOEIC-G1-Q3` : dernière question du groupe. « Groupe suivant » est désactivé tant qu'une question du groupe n'a pas de réponse ; le texte indique laquelle manque.
- `TOEIC-D-P1` : consignes avant la partie 1 (ce qu'on voit, ce qu'on fait, pas de retour, nombre de questions du diagnostic, écoute optionnelle des consignes), bouton « Commencer la partie 1 ».
- `TOEIC-D-P3` : consignes avant la partie 3 (groupes, onglets, pas de réécoute).
- `TOEIC-T-P2` : transition entre la partie 1 et la partie 2, bouton « Commencer la partie 2 ».

Règles à reprendre par le dev :
- Audio d'un groupe : lecture unique, sans bouton de relance. Le fait d'être sur un autre onglet ne relance pas l'audio.
- Onglets : libres dans le groupe, jamais vers un autre audio. Chaque onglet indique « répondu » par une coche.
- « Groupe suivant » : actif seulement quand toutes les questions du groupe ont une réponse.
- Écoute en Listening : pas de retour aux parties précédentes. Reading reste libre (cahier, section 5 et E1).
- Nombre de questions par partie dans les consignes : repris du diagnostic (blueprint P1 1, P2 2, P3 4, P4 3, P5 3, P6 2, P7 5).

Textes des consignes à valider (rédaction originale, pas de copie des consignes officielles) :
- Partie 1 : « Tu vois une photo. Tu entends quatre phrases, lues une seule fois. Choisis la phrase qui décrit le mieux la photo. » (EN de travail : "You will see a photo and hear four statements. Choose the statement that best describes the photo.")
- Partie 3 : « Tu entends une conversation, écoutée une seule fois. Plusieurs questions portent sur cette conversation : réponds à chacune avant de passer au groupe suivant. » (EN : "You will hear a conversation once. Several questions follow it. Answer every question in the group before moving on.")
- Transition : « Fin de la partie 1 · Partie 2 commence. » Les textes des autres parties (2, 4, 5, 6, 7) restent à rédiger.

## Trous numérotés, parties 5 et 6 (version 21, 16 octobre 2026)

Retour de Benny (16/10, 21:36) : le texte à trous affichait « {1} », « {2} » et la question « Blank (140) ». Attendu : de petits rectangles numérotés dans le texte, bien visibles, et une question qui renvoie au numéro du trou.

- `TOEIC-B6-1` : partie 6, trou 131 actif (rectangle jaune, bordure forte), rien de répondu. Libellé « Trou 131 · choisis le mot qui complète le texte ». « Valider » désactivé tant qu'aucun choix n'est fait.
- `TOEIC-B6-2` : trou 131 répondu (rectangle vert, pas seulement la couleur : le numéro reste visible), trou 132 actif. Libellé « Trou 132 · ... ». Le choix sélectionné reprend le style de sélection existant.
- `TOEIC-B5-TROU` : partie 5, un seul trou numéroté (128) dans la phrase, même libellé « Trou 128 · ... ».
- Partie 7 : pas de trou, inchangée.
- Clair et sombre : les rectangles utilisent les tokens (`--surf`, `--soleil`, `--marque`), donc les deux thèmes suivent le moteur.
- Règle pour le dev : le numéro affiché dans le texte est le même que dans le libellé de la question et que dans le récapitulatif du diagnostic.

## Score estimé précis et évolution (version 22, 16 octobre 2026, à valider)

Demande de Benny (16/10, 21:39) : donner un chiffre précis à l'élève (par exemple « 745 »), pas une fourchette, puis suivre son évolution au fil des tests. Méthode et réserves : cahier, section 5.R. Benny doit valider la méthode avant tout code.

- `TOEIC-A7-SCORE` : « Ton résultat » au diagnostic. Score estimé « 745 », avec « Environ 745, à ± 30 points près ». Listening (375) et Reading (370), chacun sur 495, avec une barre. Maîtrise par partie conservée (P6 fragile, P5 acquise).
- `TOEIC-A7-EVOL` : après un mini-test, estimation « 760 » et mention « Tu étais à 745 au diagnostic ». Ligne « Évolution : +15 points depuis le diagnostic ». La marge est dite en clair : elle se réduit avec les tests terminés.
- Les chiffres (745, 760, 375, 370, 380) sont des exemples, jamais des valeurs figées. Ils viennent du calcul serveur.
- Pas de promesse de « 98 % de fidélité » dans l'écran : la recherche n'a pas trouvé de table officielle publique (voir cahier 5.R).

## Score estimé : un chiffre net (version 22, révisée le 16 octobre 2026, à valider)

Retour de Benny (16/10, 21:55) : « Chiffre exact ... ». L'élève veut un seul chiffre, pas une fourchette ni une marge affichée en gros.

- `TOEIC-A7-SCORE` : le titre de la carte est un chiffre net, « 745 » ; la mention « Estimation, pas un score officiel. » est discrète, en petit. Pas de « ± 30 » ni de fourchette. Listening (375) et Reading (370), chacun sur un chiffre exact et sur 495.
- `TOEIC-A7-EVOL` : après un mini-test, « 760 », « +15 depuis le diagnostic (745) ». Même mention discrète.
- Les chiffres sont des exemples ; ils viennent du calcul serveur.
- Pas de marge affichée. La marge reste un outil interne de calibration (cahier, section 5.R).

## Séries sans correction immédiate, revue en fin de série (version 24, 16 octobre 2026, à valider)

Retour de Benny (16/10, 22:01) : la correction ne s'affiche pas après chaque question, même en entraînement. On enchaîne, la série se termine, puis la revue question par question.

- `TOEIC-S-Q4` : mini-test, question 4 sur 10. La réponse est enregistrée, sans correction. Bouton « Question suivante ».
- `TOEIC-S-FIN` : série terminée. Score de la série, grille des 10 questions (juste en vert, faux en corail, avec le numéro et la couleur). Aucune correction ici. « Revoir mes réponses ».
- `TOEIC-S-REV` : revue question par question. Grille cliquable, question, « Faux » ou « Juste » avec le texte, réponse donnée, bonne réponse, « Revoir la notion » (gratuit), « Explication détaillée · 1 crédit » (0 avec le Pass), « Question suivante ».
- `TOEIC-S-REV-DIAG` : même revue au diagnostic. L'explication y reste gratuite (D-09).

Recommandation sur le mode immédiat : ne pas le construire. Il réintroduirait la correction après chaque question, que Benny refuse. Si un entraînement guidé est voulu un jour, ce serait un réglage dans Réglages, désactivé par défaut, jamais dans une série, un test ou le diagnostic.

Cohérence :
- Diagnostic : même revue, explication gratuite (D-09).
- Groupes de questions (G1) : en revue, les questions d'un même audio ou passage restent groupées ; pas de réécoute audio dans la revue.
- Crédits : explication détaillée 1 crédit en série, 0 avec le Pass, gratuite au diagnostic. Le tarif du corrigé complet d'un test ne change pas (cahier, section 12.6).

## Confirmations de bascule P4 et P5 : texte retiré, espacement (version 25, 16 octobre 2026)

Retour de Benny (16/10, 22:05) : la feuille « Passer au profil TOEIC ? » était serrée (titre, texte, carte, bouton et « Annuler » collés) et expliquait que l'interface change. Il n'a pas besoin de le savoir : on change, et c'est tout.

- `TOEIC-P4` : titre « Passer au profil TOEIC ? », carte TOEIC, « Passer au TOEIC », « Annuler ». Le paragraphe explicatif est retiré.
- `TOEIC-P5` : titre « Revenir au secondaire ? », « Revenir au secondaire », « Annuler ». Le paragraphe est retiré aussi, pour rester cohérent.
- Espacement : la feuille a 22 px en haut et 24 px en bas, et 16 px entre chaque élément, comme la page secondaire. Avant, la maquette n'avait que 10 px, ce qui collait les éléments. C'était un écart de ma maquette, pas du code.
- Clair et sombre : mêmes tokens que le reste de la feuille.

## Chiffre net partout pour le score estimé (version 25)

Retour de l'équipe (16/10, 22:06) : l'accueil affichait encore « 650 à 730 » alors que le résultat affiche « 745 ». Tout passe à un chiffre net :
- Accueil TOEIC (N1, D1), tuiles « Score estimé » : « 745 sur 990 ».
- Statistiques (ST1), historique (T4), tests : « 745 sur 990 ».
- Moi TOEIC : « Estimé 745 », « Écart 55 pts » (Visé 800 moins 745).
- Résultat du diagnostic (A7) : « 745 », avec la mention « Estimation, pas un score officiel. ».
- Bilan du test blanc (E6) : « 720 », sur la même règle.
- Les chiffres sont des exemples ; ils viennent du calcul serveur.
