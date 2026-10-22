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

## Correction intégrée et modes Entraînement / Examen (version 26, 20 octobre 2026, à valider)

Demande de Benny (20/10, 21:39) : la correction ne s'ouvre plus sur une autre page. Elle s'affiche sur le même écran que la question, sous les options, et l'élève garde le contexte (photo, audio, passage, onglet de groupe). Deux modes : Entraînement (correction après chaque question) et Examen (revue à la fin). Brief : `brief-design-correction-integree.md` ; règles : cahier 5.M.

- `TOEIC-M-B1` : photo. Option juste (coche et mot « Juste »), carte « Corrigé » sous les options, « Question suivante ». L'explication détaillée affiche son coût (1 crédit).
- `TOEIC-M-B2` : question-réponse audio. Une option fausse (croix et mot « Faux »), une juste ; « Réécouter » disponible dans le lecteur ; piège de la question dans la carte.
- `TOEIC-M-B3` : groupe de trois. Onglet 32 validé (coche), correction dans l'onglet de la question.
- `TOEIC-M-B5` : phrase à trou, trou 128 en vert avec la bonne réponse.
- `TOEIC-M-EXP` : explication détaillée dépliée dans la carte, sans changer d'écran. Le texte s'insère sous le piège.
- `TOEIC-M-T2` : mini-test avec le sélecteur « Examen · Entraînement ». Examen par défaut, coût 1 crédit hors Pass.
- `TOEIC-M-T2-ENT` : même écran, mode Entraînement. Gratuit, ne compte pas pour le score.
- `TOEIC-M-REV` : revue d'Examen. Filtre « Toutes · Mes erreurs », grille, question avec son contexte et sa correction ; la carte se lit en défilant.
- `TOEIC-M-REV-HORS` : revue hors ligne. « La correction sera disponible au retour du réseau. », réponses gardées.
- `TOEIC-M-FIN` : fin d'Entraînement, bilan sans score estimé.

Points à reprendre par le dev :
- Une seule action verte par écran ; en revue, « Question suivante » est la seule action verte.
- Une option juste ou fausse porte toujours son mot (« Juste », « Faux »), pas seulement sa couleur.
- Le bouton « Explication détaillée » n'apparaît qu'avec son coût ; avec le Pass, la mention disparaît.

## Écrans restants de la correction intégrée (version 27, 20 octobre 2026)

- `TOEIC-M-B7` : documents. Onglets Doc. 1 à 3, passage avec la phrase de la réponse surlignée, correction sous les options.
- `TOEIC-M-X5` : feuille « Il te faut 1 crédit » par-dessus la question, avec le solde et « Débloquer · 1 crédit ». Le texte de la feuille est celui de X5.
- `TOEIC-M-REV-GRP` : revue d'Examen d'un groupe (onglet 33), « Réécouter » disponible, correction dans l'onglet.
- `TOEIC-M-ECOUTE-EPUISEE` : épreuve, audio déjà écouté. Le bouton de relance n'existe pas ; la mention « Écoute unique : pas de réécoute pendant l'épreuve. » est affichée.

Règle d'écoute : en Examen pendant l'épreuve, lecture unique. En revue d'Examen et en Entraînement, « Réécouter » est disponible. Clair et sombre : chaque écran est rendu dans les deux thèmes dans l'aperçu.

## Version 28 (21 octobre 2026, à valider)

Décisions de Benny du 21 octobre (cahier 1.24, section 5.M.10, D-32 à D-35), rendues en 360 px et 390 px, clair et sombre.

- `TOEIC-V28-G1` : groupe de questions à 360 px, onglets libres, audio continu, un seul bouton « Valider (2/3) ».
- `TOEIC-V28-G1-390` : même groupe à 390 px.
- `TOEIC-V28-G2` : groupe incomplet, pastille « Tu n'as pas tout répondu. », bouton « Valider quand même (2/3) ».
- `TOEIC-V28-G3` : Entraînement, après « Valider » : correction par onglet, carte de correction en grille (juste, faux).
- `TOEIC-V28-B1` : Photo, Entraînement, correction en grille sous les options (juste).
- `TOEIC-V28-B4` : Exposé, Entraînement, correction en grille (faux, réécoute).
- `TOEIC-V28-B6` : Texte à trous, Entraînement, trou 131 juste, correction en grille.
- `TOEIC-V28-EX` : Examen, question sans aucune correction (« Question suivante » seul).
- `TOEIC-V28-FIN` et `TOEIC-V28-FIN-390` : fin d'Examen, score estimé, grille, questions sans réponse comptées fausses.
- `TOEIC-V28-REV-PHOTO` : revue de fin, photo, bonne réponse et justification.
- `TOEIC-V28-REV-GRP` : revue de groupe, réécoute disponible, « Sans réponse ».

Non dessiné dans cette version : B3 (groupe en Entraînement, écran complet), B5 (phrase), B7 (documents) en version 28. Ces trois écrans restent couverts par la version 27 (`TOEIC-M-B3`, `TOEIC-M-B7`) en attendant le lot suivant.

## Version 29 : identité des pages Réviser, Examen et courbe de score (21 octobre 2026, à valider)

Retour de Benny (capture de Réviser, Cours, Méthode) : les pages se ressemblent toutes, mêmes cartes et même icône livre. Chaque page reçoit une identité propre (bandeau de couleur, icône propre, mise en page propre). Couleurs prises dans les tokens existants, aucun couple inventé.

- `TOEIC-V29-PARCOURS` : frise numérotée (aujourd'hui, série, prochain palier, objectif), une icône par étape.
- `TOEIC-V29-PARTIES` : tuiles P1 à P6 en deux colonnes, maîtrise par partie, icône propre à chaque partie.
- `TOEIC-V29-COURS-GRAM` : bandeau jaune, icône couches. Lignes à icône jaune.
- `TOEIC-V29-COURS-VOC` : bandeau vert, icône notes.
- `TOEIC-V29-COURS-PIEGES` : bandeau corail, icône alerte.
- `TOEIC-V29-COURS-METHODE` : bandeau crème, icône ampoule.
- `TOEIC-V29-EXAMEN` : épreuve, bandeau sombre avec chrono, pas de correction pendant la question.
- `TOEIC-V29-STATS` : courbe du score (échelle 600 à 1000, cible 800 en pointillé corail, points par séance), vue « Tout ».

Non dessiné en v29 : Carnet, les vues Semaine et Mois de Statistiques, la liste des tests (Tests) et la fin d'Examen dans la nouvelle identité. Ils restent en version 28 ou 27.

## Version 30 : cartes de liste propres à chaque catégorie et partie, accueil TOEIC (21 octobre 2026, à valider)

Retour de Benny : les cartes de liste ont toutes la même icône de livre et la même couleur, y compris dans Cours. Une carte de liste porte désormais la couleur et l'icône de sa catégorie, avec une bande de couleur à gauche. Les bandeaux de v29 ne suffisaient pas.

- `TOEIC-V30-GRAMMAIRE` : Cours, Grammaire. Cartes jaunes, icône propre à chaque fiche (couches, tracé, notes, cible), étiquette « Nouveau » sur les fiches récentes. Plus aucune icône livre.
- `TOEIC-V30-PARTIES` : Réviser, Parties. Une couleur et une icône par partie (P1 Photos vert et image, P2 Question-réponse jaune et notes, P3 Conversation crème et casque, P4 Exposé corail et lecture, P5 Grammaire jaune et couches, P6 Texte à trous vert et tracé, P7 Passages crème et livre). Les couleurs se répètent entre parties, l'icône et le libellé les distinguent.
- `TOEIC-V30-ACCUEIL` : carte « J-N » sur l'accueil TOEIC, vert, avec la date d'examen, le pourcentage de préparation et une barre.
- `TOEIC-V30-ACCUEIL-SANS-DATE` : même emplacement, sans date. Une carte en pointillés invite à ajouter la date.

Règles de la carte « J-N » (décision de la maquette, à confirmer par Benny) :
- Elle s'affiche sur l'accueil TOEIC uniquement, sous la carte du profil, au-dessus de la mission du jour.
- La date se règle à l'inscription au profil TOEIC (étape « Quand passes-tu le TOEIC ? », passable), puis dans Moi, Mon profil, Date d'examen. Sans date, la carte d'invitation remplace la carte J-N.
- Pourcentage : jours écoulés depuis le début de la préparation divisés par les jours entre ce début et la date d'examen. Il ne baisse jamais.
- Après la date, la carte passe à « Examen passé : ajoute ton résultat ».
- Aucun compte à rebours fictif : sans date, aucun J-N n'est affiché.

## Version 31 : correction Entraînement allégée, groupes à onglets (21 octobre 2026, à valider)

Retour de Benny sur la correction d'une question en Entraînement : le cadre jaune « Réponse juste / fausse » et la notion prennent trop de place. L'option choisie est déjà verte ou rouge. Retour aussi sur les groupes à onglets.

- `TOEIC-V31-REPLIEE` : la correction tient en une ligne. Le choix reste vert (juste) ou rouge (faux), et un lien discret « Voir la justification » est en bas. Pas de cadre jaune.
- `TOEIC-V31-REPLIEE-390` : même écran à 390 px.
- `TOEIC-V31-OUVERTE` : au toucher, la justification s'ouvre. Elle propose « Revoir la notion » et « Explication détaillée ».
- `TOEIC-V31-GROUPE` : groupe audio à onglets après validation. L'onglet actif reste noir ; chaque onglet passe en vert (juste) ou rouge (faux) avec son icône, pour un repère visuel.
- `TOEIC-V31-ONGLET` : groupe, premier onglet. Le bouton du bas est « Onglet suivant ».
- `TOEIC-V31-DERNIER` : groupe, dernier onglet. Le bouton du bas est « Valider (3/3) ».
- `TOEIC-V31-EXAMEN-ONGLET` : Examen, groupe. « Onglet suivant », aucune correction.

Règle : pour un groupe à onglets, la navigation reste libre entre onglets. Le bouton du bas est « Onglet suivant » sauf sur le dernier onglet, où il devient « Valider (k/N) ». En Examen, aucune correction n'apparaît avant la revue de fin.

## Version 32 : grilles, onglets en numéros, séance de mots en QCM, plan de formation (21 octobre 2026, à valider)

Retours de Benny (21 octobre, soir) :
- Grammaire et Parties reprennent la grille de tuiles, pas la liste (la liste de v30 est retirée pour ces deux pages).
- Les onglets de groupe n'écrivent plus « Question » : seul le numéro reste (« 65 », « 66 »), pour gagner de la place.
- Mini-test : la page doit suivre le thème choisi. Seule l'épreuve chronométrée de l'Examen reste sombre dans les deux thèmes.
- Séance de mots en QCM : l'élève choisit le sens avant de voir la réponse, pour mémoriser.
- Plan de formation : un parcours jusqu'à la date d'examen, alimenté par les mots, notions et temps verbaux ratés.

Frames :
- `TOEIC-V32-GRAMMAIRE` : Cours, Grammaire, grille de fiches 2 colonnes, icône propre à chaque fiche.
- `TOEIC-V32-PARTIES` : Réviser, Parties, grille P1 à P7 avec maîtrise, couleur et icône par partie.
- `TOEIC-V32-MOTS-QCM` : séance de mots, question « Quel est le sens de deadline ? », quatre propositions, aucune réponse affichée avant le choix.
- `TOEIC-V32-MOTS-FAUX` : après le choix, la mauvaise réponse passe en rouge « TA RÉPONSE », la bonne en vert « BONNE RÉPONSE ». La ligne « Mot à revoir : rappel dans 1 jour » reste en bas.
- `TOEIC-V32-PARCOURS` : « Mon plan », jusqu'à la date d'examen. Bloc « À reprendre cette semaine » (mots ratés, temps verbaux), puis « Cette semaine » (cours, notions, mini-test, test complet).

Règles (décisions de la maquette, à confirmer par Benny) :
- Séance de mots : QCM à quatre propositions. Mot raté : rappel dans 1 jour. Mot juste : rappel plus tard.
- Plan : généré à partir de la date d'examen. Les mots, notions et temps verbaux ratés y reviennent. Jamais de compte à rebours fictif.
- Thème : mini-test, séance de mots et plan suivent le thème clair ou sombre. Seule l'épreuve chronométrée de l'Examen reste sombre.

## Version 33 : suivi des tests faits, courbe des scores (22 octobre 2026, à valider)

Demande de Benny (22 octobre) : chaque test montre s'il est fait, quand, avec quel score, et ouvre la liste des tentatives puis la revue. Score demi-test sur 495, test complet sur 990, mini-test « 8 sur 10 », un chiffre exact.

- `TOEIC-V33-TESTS-SUIVI` : onglet Tests, statut sur chaque carte (Pas encore fait, En cours avec Reprendre, Fait avec dernier et meilleur score, Interrompu).
- `TOEIC-V33-DEMI-SUIVI` : choix du demi-test, cartes Écoute (sur 495, pas encore de score) et Lecture (385 sur 495, dernier, 18 oct., meilleur 705, 3 tentatives).
- `TOEIC-V33-TENTATIVES` : liste des tentatives d'un test, chacune avec date, score, temps, statut et « Revoir la tentative ». Une tentative interrompue n'écrase pas le meilleur score.
- `TOEIC-V33-REVISER-SUIVI` : statuts dans Réviser (leçons et mini-tests).
- `TOEIC-V33-PARCOURS-STATUT` : statut sur chaque étape de « Mon plan ».
- `TOEIC-V33-STATS` : tests faits, meilleur score, courbe du demi-test lecture.
- `TOEIC-V33-STATS-COURBE` (trois états) : sans diagnostic (point « Départ » à 0), diagnostic seul (Départ puis 745), plusieurs tests (un point par demi-test ou test complet terminé, les mini-tests ne sont pas comptés). Axe de 0 à 990, cible 800 en pointillé, ligne continue, un score exact par point.

Règles : statut en mots, jamais seulement une couleur. Interrompu n'écrase ni le dernier ni le meilleur score. Les tentatives d'Entraînement ne comptent pas dans le meilleur score.

## Version 35 : grilles pour toute la catégorie Cours, états de maîtrise, timeline « Mon parcours » (22 octobre 2026, à valider)

Demande de Benny (22 octobre) : Vocabulaire, Pièges et Méthode en grille comme Grammaire ; l'onglet Parcours devient une vraie timeline (aujourd'hui, demain, jours suivants) ; chaque notion et piège porte un état de maîtrise lié aux quiz.

- `TOEIC-V35-COURS-GRAMMAIRE` : grille de cartes, jauge de maîtrise en pourcentage, états sur chaque carte (Non vu, Vu, Validé, Maîtrisé) et « Quiz liés : 2/2 ».
- `TOEIC-V35-COURS-VOCABULAIRE` : même grille, cartes vertes.
- `TOEIC-V35-COURS-PIEGES` : même grille, cartes corail.
- `TOEIC-V35-COURS-METHODE` : même grille, cartes crème.
- `TOEIC-V35-PIEGE-MAITRISE` : détail d'un piège, états de maîtrise.
- `TOEIC-V35-PARCOURS` : timeline « Mon parcours », jusqu'au 16 janvier. Aujourd'hui (9 h, notion ratée à revoir ; 9 h 10, mini-test en cours), demain, jours suivants (test complet). Chaque étape porte son état : À faire, En cours, Fait, Ratée à revoir.

Règles : l'état d'une notion passe à « Validé » quand le quiz lié est réussi, à « Maîtrisé » quand il est réussi plusieurs fois. Une notion ratée revient dans la timeline. Les états sont écrits en mots, jamais seulement en couleur.

## Version 35 (suite) : cahier v1.32, ids TOEIC-V34-* (22 octobre 2026, à valider)

Révision v35 avec les ids du cahier v1.32 (D-41 à D-44).

- `TOEIC-V34-COURS-GRILLE` : Vocabulaire, Pièges et Méthode en grille comme Grammaire (captures séparées par catégorie).
- `TOEIC-V34-TUILE-ETATS` : cinq états en mots : Non vu, Vu, Validé, Maîtrisé, À revoir.
- `TOEIC-V34-PARCOURS-TIMELINE` : frise verticale. Aujourd'hui ouvert, Demain, Samedi (jour de test) et les jours suivants repliés. Couverture en en-tête (notions vues 12 sur 40, validées 6, maîtrisées 2). États des étapes : À faire, En cours, Fait, Reportée.
- `TOEIC-V34-PARCOURS-JOUR` : détail d'un jour, avec les étapes du jour.
- `TOEIC-V34-PARCOURS-SANS-DATE` : sans date d'examen, pas de timeline ; invitation à choisir la date.
- `TOEIC-V34-PARCOURS-TROP-DE-CONTENU` : semaine chargée, étapes repliées avec « Voir les étapes restantes ».
- `TOEIC-V34-NOTION-MAITRISE` : notion avec son état et ses quiz liés (réussi, à faire).
- `TOEIC-V34-STATS` : décompte Vu, Validé, Maîtrisé, À revoir, et maîtrise par catégorie.

## Version 36 : gabarit de carte de test (22 octobre 2026, à valider)

Retour de Benny (22 octobre, soir) : la carte Demi-test écrit « Fait : dernier 410 sur 495, meilleur 410, 1 tentative(s) », phrase lourde et redondante quand dernier et meilleur sont égaux. La tuile « 90 à 400 sur 990 » donne une fourchette, contraire à la règle d'un chiffre exact.

- Gabarit unique pour mini-tests, demi-test et test complet : pastille de statut (Pas encore fait, En cours, Fait, Interrompu), score principal en gros, détail discret en petit. Pas de « (s) », pas de doublon.
- `TOEIC-V34-TESTS-LISTE` : onglet Tests complet. Score estimé en un chiffre (745 sur 990), tests faits (2).
- `TOEIC-V34-CARTE-DEMI` : demi-test écoute (410 sur 495, meilleur score, 1 tentative, dernière le 18 oct.) et lecture (385 sur 495, 3 tentatives, dernier 360 le 19 oct. distinct du meilleur). Test complet en cours.
- `TOEIC-V34-CARTE-MINI` : mini-test fait (8 / 10, 2 tentatives) et mini-test interrompu (le meilleur précédent est conservé).

Règles : le score principal est le meilleur score. Le « dernier » n'apparaît que s'il est différent du meilleur. Le nombre de tentatives et la date restent en détail discret.

## Version 37 : une icône et une couleur par type de test (22 octobre 2026, à valider)

Retour de Benny (22 octobre, soir) : les cartes de l'onglet Tests sont monochromes. Chaque type de test a son icône et sa couleur, comme les cours.

- `TOEIC-V34-TESTS-TYPES` :
  - Mini-test par partie : vert, cible.
  - Mini-test mixte : jaune, couches.
  - Demi-test écoute : crème, casque.
  - Demi-test lecture : corail, livre.
  - Test complet : vert foncé, trophée.
  - Corrigé complet : blanc, notes.
- Couleurs reprises des parties de Réviser : vert, jaune, crème, corail. Le vert foncé et le blanc ne sont pas utilisés pour une partie.
- Chaque carte garde son statut en mots (Pas encore fait, En cours, Fait, Interrompu) et son score en gros.

## Version 38 : listes des demi-tests d'écoute et de lecture (cahier v1.33, D-45 à D-48, 22 octobre 2026, à valider)

- `TOEIC-V34-DEMI-LISTE-ECOUTE` : « Demi-tests d'écoute ». En-tête avec « Fait : 2 sur 6 · Meilleur de la section : 410 sur 495 ». Lignes numérotées (Écoute n° 1 à n° 4) avec statut, meilleur score, dernier score quand il est différent, tentatives, date et « n questions nouvelles pour toi ». « Conseillé » sur la ligne en cours, contour jaune.
- `TOEIC-V34-DEMI-LISTE-LECTURE` : même liste pour la lecture. Lecture n° 4 interrompue, sans effet sur le meilleur score.
- Couleurs et icônes de la v37 : crème et casque pour l'écoute, corail et livre pour la lecture.
- Quand le dernier score égale le meilleur, un seul chiffre s'affiche (pas de doublon).
- Pas encore de score : mention « Pas encore de score », jamais un tiret seul.

## Version 39 : une liste par type, choix de partie, détail, bilan de fin (cahier v1.35, D-50 à D-53, 22 octobre 2026, à valider)

- `TOEIC-V34-LISTE-MINI` : « Mini-tests Partie 5 ». Lignes numérotées (Partie 5 n° 1 à n° 4), même gabarit que la v38, vert et cible.
- `TOEIC-V34-CHOIX-PARTIE` : choix de la partie (P1 à P7) avant la liste. Chaque partie porte son statut ; « Conseillé » sur la partie qui a le plus de nouvelles questions.
- `TOEIC-V34-LISTE-COMPLET` : « Tests complets », vert foncé et trophée, même gabarit.
- `TOEIC-V34-DETAIL` : détail d'un test fait. Score en gros, tentatives, date. Trois actions : « Voir ma note et mes tentatives », « Refaire pour améliorer ma note », « Passer un autre test ». Le meilleur score est conservé.
- `TOEIC-V34-BILAN` : bilan de fin. « Nouveau meilleur score » (9 sur 10, ancien meilleur 8), mêmes trois actions, puis « Retour aux tests ».

Règles : une liste par type ; mini-tests et mixte demandent d'abord la partie quand il y en a une. « Refaire » crée une tentative du même test, nouveau débit. « Passer un autre test » ouvre le test Conseillé du même type.
