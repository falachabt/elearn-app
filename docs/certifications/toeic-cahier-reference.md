# Cahier des charges de référence : profil TOEIC (Elearn Prepa)

**Version 1.0 du 15 octobre 2026.** Document de référence unique entre le cahier, le design et le code. Il remplace la version 0.3 (archivée dans `cahier-des-charges-v0.3-archive.md`) et complète, sans la remplacer, la section « certifications » de la PR elearn-app #43 (`docs/certifications/`, exigences CERT-n).
Maquettes de référence (branche `claude/project-thread-kw792g` d'`elearn-app`) : `docs/maquettes/toeic-revue-complete.html` (43 écrans, clair et sombre) et `.md`, `docs/maquettes/toeic-parcours-arrivee.html` et `.md`. Dernier commit lu : `d39d78b`.
Quota ElevenLabs à retenir : 131 000 crédits par mois (Benny, 15 octobre). Démo : 16 000 crédits.

## 0. Comment lire et utiliser ce document

### 0.1 Règle anti-dérive (obligatoire)
Il existe trois sources qui ne doivent jamais diverger : ce cahier, la maquette, le code. Une seule voie de modification :
1. **Le changement est écrit dans ce cahier** (une ligne dans le journal des changements, section 11, avec date, auteur, identifiants d'écran touchés, raison).
2. **La maquette est mise à jour** (agent design) et son identifiant d'écran est repris ici.
3. **Le code est modifié**, avec le test qui prouve la règle, et l'identifiant de l'exigence dans le nom du test ou son commentaire.
Interdit : coder un écart « parce que c'est plus simple », corriger la maquette sans toucher au cahier, ou modifier le cahier sans maquette. Si le code découvre un cas non prévu, le développeur écrit la question dans la section 10 et attend la réponse ; il n'invente pas.
Toute exigence porte un identifiant stable. Une exigence supprimée est marquée « retirée » dans le journal, jamais réutilisée.
Chaque pull request ou commit qui touche le profil TOEIC cite les identifiants d'écran et d'exigence. (Pas de PR pour l'app : commit direct sur la branche de travail, selon la règle de Benny.)

### 0.2 Identifiants d'écran
Les identifiants sont ceux de la maquette version 2 (`docs/maquettes/toeic-revue-complete.md`, commit `ced993c`, états du moteur d'exercice au commit `9148a7b`) : `TOEIC-<section><n>`, stables, jamais renommés. Dans ce cahier, le préfixe `TOEIC-` est omis (A1 = TOEIC-A1). Sections : **A** arrivée, objectif, diagnostic ; **B** moteur d'exercice ; **C** réviser ; **D** parcours du jour ; **E** test blanc ; **S** états transverses ; **X** écrans ajoutés ; **B*-CHARGE / -AUDIO-KO / -ERR-AUDIO** états du moteur.
Correspondance avec les premiers noms : O1 = A1, O2 = A2, O3 = A3, ancien A3 « temps par jour » = A4, O4 = A5.

### 0.3 Lots de livraison (voir `planning.md`)
Chaque écran porte un lot : **S1** (semaine 1, version réduite), **S2** (semaine suivante), **V2** (tests blancs, hors ligne des packs). Un écran absent du lot en cours n'est pas codé, et le bouton qui y mène est absent (jamais désactivé en silence) : voir D-01 à D-04 du journal.

### 0.4 Statut « maquette à venir »
Tout ce qui n'est pas dessiné est marqué **[maquette à venir]**. Le développeur ne le code pas tant que la maquette n'est pas livrée et reportée ici, sauf comportement purement technique (aucune interface nouvelle). Les états de chaque écran (vide, erreur, hors ligne, squelette, crédits épuisés) sont presque tous dans ce cas : voir 3.2.

## 1. Glossaire

| Terme | Définition |
| --- | --- |
| Certification | Profil d'arrivée « Je prépare une certification », à côté d'Élève et Concours. `Profil.type = 'certification'`. |
| TOEIC L&R | TOEIC Listening and Reading : 200 questions, 7 parties, 2 h. Marque d'ETS ; Elearn Prépa n'est pas affilié. |
| Partie | Une des 7 parties du test (P1 photos, P2 question-réponse, P3 conversations, P4 exposés, P5 phrases à compléter, P6 textes à trous, P7 passages). Section Listening = P1 à P4, Reading = P5 à P7. |
| Notion | Unité de savoir étiquetée sur une question et enseignée par une fiche de cours (ex. « Forme du mot », « Prépositions de temps »). Famille : grammaire, vocabulaire, piège, méthode. |
| Notion principale / secondaire | Chaque question a une notion principale (poids 1) et au plus deux secondaires (poids 0,5). |
| Piège | Raison typique de l'erreur, affichée avec le corrigé. |
| Mot | Entrée du lexique (`cert_mots`) : mot, définition, exemple, audio. |
| Carnet | Ensemble des mots suivis par l'élève (`cert_user_mot`). |
| Boîte | Case de rappel espacé de 1 à 4 (méthode de Leitner). |
| À revoir / En cours / Connu | États d'un mot : boîte 1 / boîtes 2 et 3 / boîte 4. |
| Maîtrise | Taux de réussite pondéré par la récence, par notion ou par partie. États : Pas commencée, Fragile, En progrès, Acquise. |
| Carte de maîtrise | Écran C2 : maîtrise par partie, puis par notion. |
| Série | Suite de 10 questions d'une partie ou d'une notion. |
| Rejeu | Question déjà ratée, proposée de nouveau à J+1, J+3, J+7. |
| Séance du jour | Composition quotidienne : un point de cours, des mots, des rejeux, une série. Durée choisie par l'élève (10, 20 ou 30 minutes). |
| Parcours | Ensemble objectif + date + temps par jour + séances. |
| Diagnostic | 20 questions gratuites qui donnent la première estimation et la première carte de maîtrise. |
| Estimation | Score sur 990 donné sous forme de fourchette. Jamais « officiel ». |
| Épreuve | Écrans sombres dans les deux thèmes (test blanc). |
| Source de vérité serveur | Valeur lue dans `credit_settings`, `credit_actions`, `cert_settings` ou une table `cert_*`, jamais écrite dans le code, les textes ou les tests. |
| Idempotent | Rejouer la même écriture avec le même `client_uuid` ne change rien. |

## 2. Règles transverses (s'appliquent à chaque écran, sauf mention contraire)

- **R-01 Interface** : aucun emoji ; icônes Lucide carrées, trait 2 ; tokens `theme.color.*` uniquement ; une seule action verte par écran ; texte noir sur surface colorée ; cibles de 48 px minimum espacées de 8 px ; tutoiement ; espace insécable avant `?` `!` `:` ; texte qui suit la taille système jusqu'à 130 %.
- **R-02 Thèmes** : chaque écran existe en clair et en sombre. Exception : l'**épreuve** (E1 à E5) reste sombre dans les deux thèmes.
- **R-03 États sans couleur seule** : chaque état porte un texte et une icône (Fragile, En progrès, Acquise, Pas commencée, Juste, Faux, Choisi).
- **R-04 Montants** : aucun montant (crédits, coûts, seuils, paliers, délais) dans le code, les textes ou les tests. Les valeurs de la maquette sont des exemples. Lus dans `credit_settings`, `credit_actions` et `cert_settings`.
- **R-05 Score** : jamais présenté comme officiel ; toujours une fourchette ; mention « Une estimation, pas un score officiel. » partout où un score apparaît.
- **R-06 Marque** : mention « TOEIC est une marque d'ETS. Elearn Prépa n'est pas affilié à ETS. » sur A2 et dans « À propos » ; jamais de logo ETS ; logo fourni par Benny, sinon emplacement (voir écart E-05).
- **R-07 Hors ligne** : le contenu préparé est valable `{offline_validity_days}` jours (initial 7) sans contact serveur, puis S9 (contenu expiré).  toute lecture d'une clé locale de contenu passe par `lireLocalHorsLigne()` (AGENTS.md §16 bis) ; toute nouvelle clé locale est ajoutée à la liste de ce paragraphe et à `reviser.test.ts`. Toute action qui exige le serveur passe par `useGardeReseau`. Les écritures de réponses, de mots et de séances sont mises en file locale et rejouées de façon idempotente (`client_uuid`).
- **R-08 Sécurité des données** : tables `cert_user_*` avec RLS dès la création (accès limité à `auth.uid()`), écritures uniquement par RPC, tests pgTAP d'isolation entre deux comptes. Le corrigé payant est servi par le serveur après vérification du droit (option A).
- **R-09 Mesure** : tout évènement est typé dans `src/services/evenements.ts` ; les propriétés sont celles de la section 7. Drapeau PostHog `cert_profile_enabled` : s'il est faux, la carte « Je prépare une certification » (A1) n'est pas affichée.
- **R-10 Retours** : sons et vibrations passent par `useFeedback`, réglables ; jamais de son en direct dans un écran. L'épreuve n'en joue aucun pendant l'écoute.
- **R-11 Contenu** : question, notion, mot : statut `reviewed` obligatoire pour être servi à un élève. Un contenu en `draft` n'est jamais renvoyé par les RPC de lecture.
- **R-12 Conteneur** : tout écran avec saisie passe par `Ecran` (AGENTS.md §12). Barre d'état et barre de navigation selon le thème.
- **R-13 Tests** : chaque exigence a au moins un test nommé avec son identifiant. Jest pour l'app, pgTAP pour la base, Deno pour les Edge Functions (`npx supabase@2.118.0 test db` avant toute migration poussée). Jamais de valeur de crédit figée dans un test.

## 3. États communs

### 3.1 Définition
| Code | État | Comportement attendu |
| --- | --- | --- |
| ES-1 | Chargement | Squelette de la forme finale, pas de roue seule. |
| ES-2 | Vide | Texte + icône, jamais un écran blanc. Aucune fausse valeur (pas de faux score, pas de fausse progression). |
| ES-3 | Erreur | Message en français, sans code technique, bouton « Réessayer ». L'erreur est journalisée (suivi des erreurs). |
| ES-4 | Hors ligne | Indicateur existant (`EtatReseau`) ; contenu déjà préparé reste lisible (R-07) ; les actions qui exigent le serveur sont bloquées avec un message clair (`useGardeReseau`). |
| ES-5 | Crédits | Si l'action coûte des crédits : coût sur le bouton (`PuceCout`), feuille de coût (`FeuilleCout`), feuille crédits épuisés (`FeuilleEpuise`) ; pass actif : action illimitée, sans puce. |
| ES-6 | Thème | Clair, sombre ; épreuve sombre. |
| ES-7 | Accessibilité | 130 %, lecteur d'écran, cibles 48 px, ordre de focus logique, états annoncés (« Juste », « Faux », « Choisi »). |

### 3.2 Couverture des états par la maquette (version 2.1)
**Dessinés** : S1 (squelette d'une question de série), S2 (erreur de chargement d'une série), S3 (série hors ligne, réponse gardée), S4 (réponse non envoyée), S5 (carnet vide), S6 (recherche du carnet sans résultat), S7 (Mon TOEIC avant diagnostic), S8 (estimation pas encore disponible), S9 (contenu expiré après 7 jours), X4 (pack audio manquant), B1-CHARGE à B7-CHARGE, B1-AUDIO-KO à B4-AUDIO-KO, B3-ERR-AUDIO, B8-ERR-AUDIO, A8 (fin de diagnostic), B11 (fin de série), C9 (fin de séance de mots), E5 (pause).
**Non dessinés [maquette à venir]** : squelette des écrans autres qu'une question de série (A2, A7, C1 à C8, D1 à D4, E6) ; erreur et hors ligne des écrans autres qu'une série (A2 liste des examens, A7, C1 à C8, D1 à D4) ; accueil D1 quand la date du test est passée ; séance D2 sans aucun bloc ; porte payante dans B9 (X1 existe mais son point d'entrée n'est pas dessiné, écart E-08) ; logos réels (A2) ; état « pas commencée / trop peu de réponses » d'une notion au-delà de 0 réponse (écart E-02).
Tant qu'un état n'est pas dessiné, le code applique le comportement du tableau 3.1 avec les composants existants (squelette, bannière d'erreur, `EtatReseau`) et **sans texte nouveau** : il réutilise les textes génériques déjà présents dans `fr.ts`. Tout texte nouveau attend la maquette.

## 4. Formules et règles métier

Tous les paramètres entre accolades sont dans `cert_settings` (clé/valeur JSON, lue par RPC, modifiable au back-office sans déploiement). Les valeurs données sont des **valeurs initiales de seed**, pas des constantes de code.

### F1 Estimation du score sur 990
- Sections : Listening = P1 à P4, Reading = P5 à P7.
- Pour une section : `p = bonnes / répondues` (hors questions passées, comptées fausses).
- `Score_section = clamp(5, 495, 5 + 490 × p)`, arrondi au multiple de 5 le plus proche. Total = Listening + Reading.
- Cette règle reprend la démo (5 + 4,9 par bonne réponse sur 100) : elle est **approximative**. Si ETS publie une table de conversion utilisable, elle remplace F1 via `{score_table}` sans changer l'écran.

### F2 Fourchette
- Pour chaque section avec `n` questions répondues, intervalle de Wilson à `{score_z}` (valeur initiale 1,28, soit 80 %) sur `p` ; bornes converties par F1 ; fourchette totale = somme des bornes basses et hautes, arrondie à 10 (basse vers le bas, haute vers le haut), bornée à [10, 990].
- L'estimation n'est disponible qu'à partir de `{score_min_answers}` réponses au total (initial 20, toutes sections confondues, diagnostic compris) ; en dessous, S8 (« Il faut au moins 20 réponses pour estimer ton score. Tu en es à {k}. », barre `k / 20`) ou la mention A5 / S7 si aucune réponse. Si une section a 0 réponse, l'intervalle de Wilson de cette section est [0 ; 1] (fourchette maximale).
- **Conséquence à connaître** : avec 20 questions (10 par section) la fourchette est large (de l'ordre de 150 points de chaque côté). La maquette affiche « 650 à 730 » (80 points) : voir écart E-03.

### F3 Maîtrise d'une notion
- Réponses de l'élève sur les questions étiquetées par la notion (rôle principal poids 1, secondaire poids 0,5). Les réponses au diagnostic comptent comme les autres.
- Poids de récence : `w = 0,5 ^ (âge_en_jours / {mastery_halflife_days})` (initial 14).
- `M = Σ(poids_rôle × w × juste) / Σ(poids_rôle × w)`.
- États : 0 réponse → **Pas commencée** ; sinon `M < {mastery_fragile_below}` (initial 0,40) → **Fragile** ; `M ≥ {mastery_acquired_from}` (initial 0,70) → **Acquise** ; sinon **En progrès**.
- Décompte affiché : « {n} questions · {r} réussies » avec `n` et `r` bruts (non pondérés).

### F4 Maîtrise d'une partie (carte de maîtrise)
- `M_partie` = même formule que F3 sur toutes les réponses de la partie (pas la moyenne des notions). Barre = `M_partie × 100`, mêmes états et seuils que F3.
- Regroupement du résumé du diagnostic (A7) : « P1 à P2 », « P3 à P4 », P5, P6, P7 (cinq lignes).
- Sur C2 : sept lignes, une par partie. Les deux totaux (« Acquise {a} », « En progrès {p} », « Fragile {f} », « Pas commencée {c} ») comptent des **notions**, pas des parties.

### F5 Carnet de mots (boîtes de Leitner)
- Un mot entre au carnet en **boîte 1** : par ajout manuel (C6), par « mot clé à ajouter » (B9), par échec sur une question qui référence ce mot, ou par la raison « Je ne connaissais pas le mot » (B10).
- Réussite (séance de mots « Je savais », ou question juste référençant le mot) : `boîte = min(4, boîte + 1)`. Échec (« Je ne savais pas », ou question fausse) : `boîte = 1`.
- Échéance : `prochaine_revue = aujourd'hui + {box_delays_days}[boîte]` (initial 1, 3, 7, 14 jours pour les boîtes 1 à 4).
- États : boîte 1 = **À revoir**, boîtes 2 et 3 = **En cours**, boîte 4 = **Connu**.
- Un mot « échu » est un mot dont `prochaine_revue ≤ aujourd'hui`. Les mots échus alimentent la séance du jour (F7) et la séance de mots.
- Séance de mots : `{words_session_size}` mots (initial 10), choisis parmi les échus, dans l'ordre boîte croissante puis échéance la plus ancienne ; si moins que la taille, la séance est plus courte ; s'il n'y a aucun mot échu, la séance n'est pas proposée (ES-2 de C6).

### F6 Rejeu des questions ratées
- Une question ratée est planifiée à J+1 ; revue juste, elle passe à J+3, puis J+7 ; deux réussites de suite la retirent du rejeu ; une erreur la ramène à J+1. Délais : `{replay_delays_days}` (initial 1, 3, 7).
- Source de la question « à rejouer » : `cert_user_question.prochaine_revue ≤ aujourd'hui`.

### F7 Composition de la séance du jour
- Durée choisie : 10, 20 ou 30 minutes (A3, modifiable dans D4). Le temps est **au choix de l'élève** (décision de Benny, 15 octobre).
- Quatre blocs dans cet ordre fixe : **Cours**, **Mots**, **Rejeu**, **Série**. Un bloc sans contenu disponible est omis (jamais affiché vide).
- Budget par durée (`{session_budget}`, valeurs initiales) :

| Durée | Cours | Mots | Rejeu | Série |
| --- | --- | --- | --- | --- |
| 10 min | 1 notion (3 min) | jusqu'à 4 mots | jusqu'à 3 questions | 5 questions |
| 20 min | 1 notion (3 min) | jusqu'à 6 mots | jusqu'à 4 questions | 10 questions |
| 30 min | 1 notion (5 min) | jusqu'à 10 mots | jusqu'à 8 questions | 15 questions |

- **Choix de la notion de cours** : la notion de maîtrise la plus basse (F3) parmi celles de l'élève ayant au moins une réponse fausse dans les `{recent_days}` derniers jours (initial 14) et dont la fiche n'a pas été ouverte depuis `{notion_cooldown_days}` jours (initial 3) ; à égalité, la plus grande somme d'erreurs récentes. Sans réponse récente : la première notion « Pas commencée » dans l'ordre du référentiel.
- **Choix de la série** : la partie de plus faible maîtrise (F4), différente de celle de la veille si possible ; la série porte sur les questions de la partie non encore vues d'abord.
- **« Pourquoi cette séance ? »** : phrase construite par gabarit à partir de la première condition vraie : « Parce que tu as raté {n} questions sur {notion} » (`n` = erreurs récentes sur la notion de cours) ; puis, si des mots sont échus : « , et que {m} mots du carnet arrivent à échéance » ; sinon fin de phrase par un point. Sans erreur récente ni mot échu : « Pour continuer ton plan. » (texte à confirmer, écart E-10).
- Avancement : « {k} sur {b} terminés » où `b` = nombre de blocs présents et `k` = blocs terminés.
- Une séance est enregistrée avec sa composition (`cert_sessions.composition`) et un `client_uuid`.

### F8 Jours avant le test
`jours = date_test − aujourd'hui` en jours calendaires locaux de l'appareil. Si `date_test` absente : la ligne « Test dans » n'est pas affichée. Si `jours < 0` : état « date passée » (écart E-09).

### F9 Objectif
- Paliers rapides servis par `cert_exams.goal_steps` (initial 600, 700, 800, 900) ; un seul actif ; défaut 800.
- Valeur libre : entier entre 10 et 990 (bornes de la maquette) ; la saisie libre et le curseur partagent la même valeur ; un palier est mis en évidence s'il est égal à la valeur.
- La date du test est facultative, strictement postérieure à aujourd'hui.

### F10 Crédits (R-04)
| Action | Clé `credit_actions` | Gratuit ? |
| --- | --- | --- |
| Diagnostic | aucune | oui, sans compte |
| Réponse juste/faux, bonne réponse, notion nommée | aucune | oui |
| Cours, carnet, séance de mots, rejeu | aucune | oui |
| Explication détaillée d'une question | `cert_explanation` | incluse dans le pass |
| Demi-test blanc | `cert_mock_half` | incluse dans le pass |
| Test blanc complet | `cert_mock_full` | incluse dans le pass |
Le serveur vérifie le droit avant de servir l'explication et débite de façon idempotente (opération identifiée), comme `depenser_credits` aujourd'hui.

## 5. Spécification écran par écran

Convention de chaque fiche : **But** · **Entrée / Sortie** · **Données** (source) · **Éléments interactifs** (élément → action → résultat) · **États** (spécifiques ; les états communs ES-1 à ES-7 s'appliquent) · **Textes exacts** (de la maquette ; ce qui n'y figure pas n'est pas codé) · **Règles** · **Évènements** · **Acceptation** (critères testables, préfixe `AC-<écran>-n`) · **Tests**. Lot : S1 = semaine 1, S2 = semaine suivante, V2 = tests blancs et packs.
Noms de composants : ceux qui existent sont notés ainsi (existant) ; les autres sont des **noms proposés, à créer** sous `src/components/certification/`. Noms de RPC et de tables : proposés, à valider avec la migration (PR sur `elearn-supabase`).

### 5.A Arrivée, objectif, diagnostic

#### A1 · Bienvenue (existant, une carte ajoutée) · lot S1
- **But** : l'élève choisit son profil. Une troisième carte s'ajoute.
- **Entrée** : premier lancement, ou retour depuis A2. **Sortie** : A2 (carte certification) ; flux existant pour Élève et Concours ; connexion pour « J'ai déjà un compte ».
- **Données** : aucune donnée serveur. Drapeau PostHog `cert_profile_enabled` (R-09).
- **Interactif** : carte « Élève » → flux élève existant (inchangé) ; carte « Candidat à un concours » → flux concours (inchangé) ; carte « Je prépare une certification » (icône Lucide `Award`) → A2 ; lien « J'ai déjà un compte » → flux existant.
- **États** : drapeau faux → la troisième carte n'est pas rendue ; le reste de l'écran est identique à aujourd'hui.
- **Textes exacts de la maquette** : titre « Bienvenue » ; question « Tu es… » ; « Élève » / « Ton programme du collège ou du lycée » ; « Candidat à un concours » / « Filière, concours, annales » ; **« Je prépare une certification » / « TOEIC, puis d'autres examens »** ; lien « J'ai déjà un compte ».
- **Règle sur les textes existants** : les textes Élève et Concours de la maquette sont des repères ; le code garde les textes actuels (`bienvenue.titre`, `bienvenue.tuEs` « Choisis ton profil », `bienvenue.eleve` « Je suis élève », `bienvenue.eleveAide` « De la 6e à la Terminale », `bienvenue.concours` « Je prépare un concours », `bienvenue.concoursAide`, `bienvenue.dejaCompte`). Seuls deux textes sont nouveaux : « Je prépare une certification » et « TOEIC, puis d'autres examens ». Voir écart E-01.
- **Évènements** : `onboarding_choice_made { profil: 'certification' }` (nouvelle valeur, voir section 7).
- **Acceptation** : AC-A1-1 trois cartes visibles, ordre Élève, Concours, Certification ; AC-A1-2 les textes Élève et Concours sont inchangés par rapport à `fr.ts` ; AC-A1-3 drapeau faux : deux cartes seulement ; AC-A1-4 le tap sur la carte certification ouvre A2 sans enregistrer de profil définitif ; AC-A1-5 cible tactile ≥ 48 px, lecteur d'écran annonce « Je prépare une certification ».
- **Tests** : Jest `ParcoursArrivee` (rendu des trois cartes, drapeau, navigation), snapshot clair et sombre.

#### A2 · Choix de la certification (nouveau, gabarit `ChoixConcours`) · lot S1
- **But** : choisir l'examen et le pays. **Entrée** : A1. **Sortie** : A3 (« Continuer »).
- **Données** : liste `cert_exams` via RPC `cert_list_exams()` (examens actifs, ordre servi ; TOEIC en dernier). Pays : liste `PAYS` / `paysParDefaut` existants (même composant que l'écran de classe) ; sert au prix et au Mobile Money. Cache local de la liste pour l'ouverture hors ligne.
- **Interactif** : ligne d'examen (radio) → sélection unique ; sélecteur « Ton pays » → liste des pays (composant existant) ; « Continuer » → enregistre `Profil { type: 'certification', exam, pays }` localement et ouvre A3 ; retour → A1 en gardant les choix.
- **États** : rien de choisi → « Continuer » désactivé ; la maquette montre TOEIC présélectionné pour illustrer l'état choisi ; liste vide (aucun examen actif) → ES-2, texte à fournir [maquette à venir] ; chargement et erreur [maquette à venir] ; hors ligne → liste du cache, sinon ES-4.
- **Textes exacts** : en-tête « Certification » ; titre « Quelle certification prépares-tu ? » ; ligne « TOEIC Listening and Reading » / « Anglais des affaires · 2 h · 200 questions » ; pastille de logo « LOGO À FOURNIR » (emplacement, pas de faux logo) ; encadré en pointillés « D'autres certifications s'ajouteront au-dessus du TOEIC. » (**texte de maquette, non affiché à l'élève en production** : voir écart E-05) ; libellé « Ton pays » ; valeur d'exemple « Cameroun » ; bouton « Continuer » ; mention « TOEIC est une marque d'ETS. Elearn Prépa n'est pas affilié à ETS. »
- **Règles** : les libellés de la ligne (nom, sous-titre, durée, nombre de questions) viennent de `cert_exams`, pas du code. Un seul choix. Icône Lucide `Languages` dans une pastille carrée.
- **Évènements** : `cert_exam_chosen { examen }`.
- **Acceptation** : AC-A2-1 TOEIC est la dernière ligne ; AC-A2-2 « Continuer » inactif tant que rien n'est choisi ; AC-A2-3 pays par défaut = `paysParDefaut` ; AC-A2-4 la mention de non-affiliation est visible sans défilement avec le bouton ; AC-A2-5 retour conserve la sélection ; AC-A2-6 l'encadré pointillé n'est jamais affiché en production.
- **Tests** : Jest (liste servie, ordre, désactivation, retour) ; pgTAP `cert_list_exams` (n'expose que les examens actifs).

#### A3 · Objectif (score visé et date) · lot S1
- **But** : fixer le score visé et la date du test. **Entrée** : A2 ou D4 (modification). **Sortie** : A4 (« Continuer » ou « Passer pour l'instant »).
- **Données** : `cert_exams.goal_steps` (paliers), bornes 10 et 990 (F9). Écrit `cert_user_plan.objectif` et `date_test` (local d'abord, serveur au compte).
- **Interactif** : pastilles 600/700/800/900 → fixent la valeur ; champ « valeur » (entier) → valide 10 à 990 ; curseur → fixe la valeur (même état que le champ) ; champ « Date du test » → sélecteur de date (facultatif, « Pas encore » par défaut) ; « Continuer » → enregistre, A4 ; « Passer pour l'instant » → aucune valeur enregistrée (l'objectif se règle plus tard dans D4), A4.
- **États** : valeur hors bornes → bouton désactivé et message d'erreur [maquette à venir] ; date passée → refusée [maquette à venir].
- **Textes exacts** : en-tête « Ton objectif » ; étiquette « TOEIC · étape 3 sur 3 » (**écart E-04** : le parcours compte maintenant 4 étapes avec A4) ; titre « Quel score vises-tu ? » ; pastilles « 600 », « 700 », « 800 », « 900 » ; étiquette « Ou une valeur entre 10 et 990 » ; valeur d'exemple « 820 » + « sur 990 » ; « Date du test » + « Pas encore » ; aide « Ton plan se construit à partir de ce score. Il ne garantit rien. La date est facultative. » ; boutons « Continuer » et lien « Passer pour l'instant ».
- **Règles** : défaut 800 ; la pastille active est celle égale à la valeur, aucune sinon ; le score n'est jamais présenté comme officiel (R-05).
- **Évènements** : `cert_goal_set { score, date_renseignee }` ou `cert_goal_skipped`.
- **Acceptation** : AC-A3-1 défaut 800 ; AC-A3-2 la saisie 820 désactive les pastilles et met le curseur à 82 % ; AC-A3-3 valeur 9 ou 991 refusée ; AC-A3-4 « Passer » ne crée pas d'objectif et n'empêche pas le paiement ; AC-A3-5 la date est facultative.
- **Tests** : Jest (bornes, synchronisation champ/curseur/pastilles, passer) ; évènements.

#### A4 · Temps par jour · lot S1
- **But** : l'élève choisit lui-même sa durée quotidienne. **Entrée** : A3. **Sortie** : A5 (« Commencer mon plan »).
- **Données** : valeurs 10, 20, 30 (`cert_settings.session_minutes`) ; écrit `cert_user_plan.minutes_par_jour`.
- **Interactif** : trois lignes radio → sélection unique ; « Commencer mon plan » → enregistre, A5.
- **États** : défaut 20 minutes présélectionné ; la ligne 20 minutes porte « Recommandé pour ton objectif ».
- **Textes exacts** : en-tête « Temps par jour » ; « Étape 4 sur 4 » ; titre « Combien de temps par jour ? » ; « 10 minutes » / « Une séance courte, une notion ou quelques mots » ; « 20 minutes » / « Recommandé pour ton objectif » ; « 30 minutes » / « Une séance complète avec une série de questions » ; aide « Tu peux changer ce réglage dans Moi. » ; bouton « Commencer mon plan ».
- **Règles** : le temps est au choix de l'élève (décision du 15 octobre). Le libellé « Recommandé pour ton objectif » est affiché sur 20 minutes dans tous les cas tant qu'aucune règle de recommandation n'est définie (écart E-06).
- **Évènements** : `cert_daily_time_set { minutes }` (à ajouter, section 7).
- **Acceptation** : AC-A4-1 20 min présélectionné ; AC-A4-2 le choix est repris par F7 ; AC-A4-3 modifiable dans D4.
- **Tests** : Jest (sélection, enregistrement, relecture dans D4).

#### A5 · Arrivée sur le profil TOEIC (avant diagnostic) · lot S1
- **But** : proposer le diagnostic en premier. **Entrée** : A4. **Sortie** : A6.
- **Données** : aucune donnée de performance (profil neuf).
- **Interactif** : bouton « Commencer le diagnostic » → A6 ; rangées Cours / Carnet de mots / Séance du jour : non cliquables tant qu'elles sont vides.
- **Textes exacts** : en-tête « Mon TOEIC » ; badge « PREMIER PAS » ; « Commence par un diagnostic » ; « 20 questions, environ 15 minutes. Gratuit, sans crédit. » ; encadré « Pas encore de score estimé. Le diagnostic le calcule. » ; rangées « Cours » / « Une notion à la fois », « Carnet de mots » / « Vide pour l'instant », « Séance du jour » / « Après le diagnostic » ; bouton « Commencer le diagnostic ».
- **Règles** : pas de faux chiffre. Le diagnostic est gratuit, sans compte (R-04, F10). **Doublon à lever** : S7 est un autre écran « Mon TOEIC » avant diagnostic (écart E-07).
- **Évènements** : `cert_diagnostic_started` au tap.
- **Acceptation** : AC-A5-1 aucune valeur chiffrée affichée ; AC-A5-2 une seule action verte ; AC-A5-3 les trois rangées ne réagissent pas au tap.
- **Tests** : Jest (rendu, absence de nombre, évènement).

#### A6 · Question du diagnostic · lot S1
- **But** : répondre aux 20 questions. **Entrée** : A5 ou reprise. **Sortie** : A8 après la 20e question.
- **Données** : tirage par RPC `cert_diagnostic_draw()` : 20 questions `reviewed`, plan `{diag_blueprint}` (valeur initiale par partie : P1 1, P2 2, P3 4, P4 3, P5 3, P6 2, P7 5, soit 10 Listening et 10 Reading) ; ordre : Listening puis Reading, mélangé à l'intérieur de chaque section (la maquette montre « Question 6 » en partie 2, ce qui n'est possible que dans cet ordre mélangé : écart E-11). Tirage mis en cache local pour la reprise.
- **Interactif** : option (A, B, C, D) → sélection (état « Choisi ») ; « Valider » → enregistre la réponse localement (file idempotente) et passe à la question suivante ; « Passer cette question » → compte comme fausse (F1), passe ; lecteur audio B8 pour les parties 1 à 4 ; retour (en-tête) → X3.
- **États** : chargement S1 ; audio indisponible B*-AUDIO-KO ; hors ligne S3 ; non envoyée S4 ; erreur S2.
- **Textes exacts** : en-tête « Diagnostic · 6 / 20 » ; pastille « Partie 2 » ; audio « Question 6 » ; consigne « Question-réponse : choisis la réponse la plus appropriée. » ; options « Yes, I will call you back. », « At the office on Monday. » (choisie), « It was a good idea. » ; boutons « Valider » et lien « Passer cette question ».
- **Règles** : pas de correction pendant le diagnostic (la correction vient avec le résultat) ; chaque réponse alimente F3 ; l'audio du diagnostic est joué une seule fois.
- **Évènements** : `cert_exercise_answered { type, partie, juste }` à chaque validation.
- **Acceptation** : AC-A6-1 la 20e validation mène à A8 ; AC-A6-2 « Valider » désactivé sans option choisie (S1 montre l'état désactivé) ; AC-A6-3 une réponse validée hors ligne est retrouvée au retour du réseau ; AC-A6-4 « Passer » incrémente la progression et compte fausse ; AC-A6-5 le diagnostic est rejouable sans compte.
- **Tests** : Jest (progression, passer, file hors ligne, idempotence) ; pgTAP `cert_diagnostic_draw` (20 questions, répartition, uniquement `reviewed`).

#### A7 · Résultat du diagnostic · lot S1
- **But** : estimation, carte de maîtrise résumée, trois points faibles. **Entrée** : A8. **Sortie** : D1 (« Voir mon plan »).
- **Données** : F1/F2 pour le score ; F4 regroupée pour les cinq lignes ; trois points faibles = trois notions de plus faible maîtrise F3 parmi celles ayant au moins une erreur, avec le nombre de questions ratées et la partie ; un point faible « Vocabulaire » = mots du carnet nouvellement ajoutés (compte de mots en boîte 1).
- **Interactif** : « Voir mon plan » → D1 et déclenche la composition de la première séance ; chaque rangée de point faible n'est pas cliquable dans la maquette (chevron absent).
- **Textes exacts** : en-tête « Ton résultat » ; « Score estimé » ; « 650 à 730 » (exemple) ; « Une estimation, pas un score officiel. » ; « Ta maîtrise par partie » avec lignes « P1 à P2 », « P3 à P4 », « P5 », « P6 », « P7 » ; « 3 points à travailler » ; « Prépositions de temps » / « Partie 5 · 4 questions ratées » ; « Connecteurs » / « Partie 6 · 3 questions ratées » ; « Mots du bureau » / « Vocabulaire · 5 mots à revoir » ; bouton « Voir mon plan ».
- **Règles** : fourchette F2 (voir écart E-03 sur la largeur) ; états Fragile/En progrès/Acquise avec texte et icône ; les mots rattachés aux questions ratées sont ajoutés au carnet en boîte 1 à ce moment.
- **Évènements** : `cert_diagnostic_completed { score_min, score_max }`, `cert_mastery_viewed { ecran: 'resultat' }`.
- **Acceptation** : AC-A7-1 le score s'affiche en fourchette ; AC-A7-2 la mention « Une estimation… » est présente ; AC-A7-3 exactement trois points faibles (moins s'il y a moins de trois notions ratées) ; AC-A7-4 aucune barre ne dépend de la couleur seule ; AC-A7-5 les mots ratés sont dans le carnet après l'écran.
- **Tests** : Jest (F1, F2, F4 sur jeux de réponses connus : 0 %, 50 %, 100 % ; sélection des points faibles) ; pgTAP si le calcul est serveur.

#### A8 · Fin du diagnostic (avant le résultat) · lot S1
- **But** : écran de transition. **Entrée** : A6. **Sortie** : A7.
- **Textes exacts** : en-tête « Diagnostic · terminé » ; « Diagnostic fait » ; « Ton plan se prépare. Tu verras ta maîtrise par partie. » ; bouton « Voir mon résultat ».
- **Interactif** : « Voir mon résultat » → A7.
- **Règles** : écrit la fin de diagnostic localement (`cert.diagnostic.termine`), envoi serveur idempotent si compte.
- **Acceptation** : AC-A8-1 le bouton mène à A7 ; AC-A8-2 relancer l'app ici rouvre A8, pas A6.
- **Tests** : Jest.

### 5.B Moteur d'exercice

**Principes communs aux sept types (B1 à B7)** · lot S1, sauf mention.
- **Entrée** : série d'entraînement (depuis C3, C5, D2), diagnostic (A6), rejeu (D2), test blanc (E2, E4 en V2). **Sortie** : question suivante ; après la dernière, B11 (série) ou A8 (diagnostic) ; quitter → X3.
- **Données** : une question `cert_questions` (type, partie, énoncé, options, bonne réponse, notion principale et secondaires, mots clés, explication, piège), audio/image si besoin, via RPC de série `cert_series_get(...)`. La bonne réponse et l'explication ne sont **pas** envoyées avant la réponse hors diagnostic (option A, R-08) ; hors ligne, le corrigé local est celui du contenu préparé (R-07).
- **Éléments communs** : barre de progression (`bar`), pastille de partie ou de notion, énoncé, 3 ou 4 options (composant existant `OptionReponse`), bouton « Valider » (désactivé tant qu'aucune option n'est choisie), après validation bouton « Suivant » / « Question suivante », retour → X3.
- **Choix d'une option** : état « Choisi » (coche + texte) ; un seul choix ; après validation, en entraînement : « Juste » (coche) sur la bonne option, « Faux » (croix) sur l'option choisie si erreur, B9 s'ouvre ; en diagnostic : pas de correction (A6).
- **États communs** : chargement `B<n>-CHARGE` ; son indisponible `B1..B4-AUDIO-KO` ; lecture interrompue `B3-ERR-AUDIO` ; réponse non envoyée S4 ; hors ligne S3 ; erreur de série S2.
- **Règles** : la réponse est écrite localement avant tout envoi (`cert.reponses.file`, `client_uuid` par réponse) ; une réponse ne peut être modifiée après validation ; un temps de réponse est mesuré (secondes) mais jamais montré ; le son se joue via `expo-audio` (déjà dans l'APK, AGENTS.md §17).
- **Évènements** : `cert_exercise_answered { type, partie, juste }` à chaque validation.
- **Tests communs** : Jest par type (rendu des états Choisi, Juste, Faux, désactivation, file locale), pgTAP `cert_series_get` (ne renvoie pas la bonne réponse avant la réponse).

| ID | Type | Partie | Textes exacts de la maquette | Particularités |
| --- | --- | --- | --- | --- |
| B1 | Photos | 1 | « Partie 1 · Photos » ; emplacement « PHOTO DE LA PARTIE 1 · ILLUSTRATION IA » ; audio « Écoute, puis choisis » ; options « Man reading a newspaper. », « Woman typing on a laptop. » (choisie), « Two men shaking hands. » | Image `cert_questions.image` avec texte alternatif obligatoire (`alt`) ; quatre options A à D officiellement, la maquette en montre trois : écart E-12 |
| B2 | Question-réponse audio | 2 | « Partie 2 · Question-réponse » ; audio « Question 14 » ; consigne « Écoute la question, puis choisis la meilleure réponse. » ; « Sure, I can do it on Friday. », « The meeting room is on the third floor. » (juste), « Yes, it is very expensive. » (faux) | Trois options A à C ; la question n'est pas écrite à l'écran ; la maquette montre l'état post-validation |
| B3 | Conversation | 3 | « Partie 3 · Conversation » ; onglets « Question 32 », « 33 », « 34 » ; pastille « Conversation 8 sur 10 » ; audio « Conversation, lecture unique » ; « Quel est le problème de la femme ? » ; options « Le train est en retard. », « Elle a perdu ses documents. », « Le bureau est fermé. » | Une écoute pour trois questions ; les onglets de questions sont libres ; l'énoncé de la question est en français dans la maquette : écart E-13 |
| B4 | Exposé | 4 | « Partie 4 · Exposé » ; audio « Exposé, lecture unique » ; « Écoute l'exposé. Les questions arrivent après. » ; « Pourquoi le locuteur contacte-t-il l'auditoire ? » ; « Pour annoncer un changement. », « Pour demander un avis. », « Pour présenter un produit. » | Questions affichées après la fin de l'audio |
| B5 | Phrase à compléter | 5 | « Partie 5 · Phrase » ; pastille de notion « Forme du mot » ; « The new software will be ______ next week. » ; « release », « released » (choisie), « releasing », « releases » | **Quatre** options ; la pastille de notion est affichée dès la question (écart E-14 : elle dévoile la notion avant la réponse) |
| B6 | Texte à trous | 6 | « Partie 6 · Texte à trous » ; « Dear client, thank you for your order. (131) the delivery is delayed, we will contact you. » ; « However » (choisie), « Meanwhile », « Therefore », « Despite » | Le trou courant est surligné et numéroté |
| B7 | Passage, un ou plusieurs documents | 7 | « Partie 7 · Documents » ; onglets « Doc. 1 », « Doc. 2 », « Doc. 3 » ; extrait « Memo — the Lisbon office will close on 14 March for renovation. Staff in Lisbon should… » ; « Pour qui ce message est-il écrit ? » ; « Les clients », « Le personnel de Lisbonne » (choisie), « Les fournisseurs » | Zone de lecture de hauteur fixe défilante ; onglets = documents ; le texte d'un document est le contenu d'un `cert_passages` |

Acceptation transverse : AC-B-1 aucune bonne réponse n'est présente dans la charge utile réseau avant validation (hors diagnostic terminé) ; AC-B-2 un tap sur une option change l'état « Choisi » sans valider ; AC-B-3 l'ordre des options est conservé après validation ; AC-B-4 chaque type s'affiche en clair, en sombre et à 130 % sans défilement latéral.

#### B8 · Lecteur audio · lot S1 (mode examen : V2)
- **But** : lire l'audio d'une question. **Entrée / Sortie** : composant intégré aux écrans B1 à B4, A6, E2.
- **Données** : fichier audio `cert_questions.audio_path` (stockage R2/CDN), durée.
- **Interactif** : lecture/pause (une pastille Lucide `Play`/`Pause`) ; barre de progression non déplaçable en mode examen ; « Continuer » (écran lecteur) → question suivante.
- **Textes exacts** : « Écoute en cours » ; carte « Mode examen » : « Une seule écoute. Pas de réécoute, vitesse fixe. Reprise possible après un appel ou une coupure. » ; encadré « Écoute déjà jouée. La réécoute se fait en entraînement. » ; pastilles « Écoute 1 / 1 » et « Vitesse 1× » ; bouton « Continuer ».
- **Règles** : en entraînement, réécoute libre ; en diagnostic, une écoute ; en mode examen, une écoute, vitesse fixe 1×, pas de retour arrière ; reprise à la position après appel ou coupure (état partagé avec `B8-ERR-AUDIO`) ; aucune vitesse variable dans cette version.
- **États** : `B8-ERR-AUDIO` (« Lecture interrompue à 0:18 » ; « Erreur de lecture » ; « Ta réponse est gardée. La lecture reprend à 0:18, sans recommencer. » ; boutons « Reprendre la lecture » et « Passer la question ») ; audio indisponible : `B1..B4-AUDIO-KO` (« Audio indisponible » ; « Le son de cette question ne se charge pas » ; « Le texte reste lisible. Réessaie, ou passe la question : elle sera rejouée plus tard. » ; « Réessayer le son » ; « Passer la question »).
- **Règles de reprise** : « Passer la question » enregistre la question comme non répondue, ne la compte pas fausse en entraînement, la place dans le rejeu (F6, J+1) ; en diagnostic elle compte fausse (F1).
- **Acceptation** : AC-B8-1 la lecture reprend à ±1 s de la position après un appel ; AC-B8-2 en mode examen le bouton de relecture est absent ; AC-B8-3 un son qui ne charge pas n'empêche pas de répondre ; AC-B8-4 « Passer la question » ne bloque jamais la série.
- **Tests** : Jest (machine d'état du lecteur : lecture, pause, erreur, reprise, expiré), simulateur d'erreur audio ; test de `garde-module-natif` inchangé.

#### B9 · Explication · lot S1
- **But** : après la réponse, montrer le corrigé, nommer la notion, proposer la révision. **Entrée** : B1 à B7 après « Valider » (entraînement, rejeu). **Sortie** : « Question suivante » ; C5 (« Revoir la notion ») ; B10 (« Pourquoi j'ai raté ? »).
- **Données** : bonne réponse, réponse de l'élève, notion principale (`cert_notions.titre`, famille), piège (`cert_questions.piege`), mots clés (`cert_question_mots`) servis après la réponse (option A).
- **Interactif** : « Revoir la notion » → C5 de la notion ; « Pourquoi j'ai raté ? » → B10 ; chips de mots clés → ajoutent le mot au carnet (F5, boîte 1) ; « Question suivante » → question suivante.
- **Textes exacts** : en-tête « Explication » ; badge « CORRIGÉ » ; « Bonne réponse : B · Elle a perdu ses documents. » ; « Ta réponse : C » ; « Notion : Vocabulaire du voyage · Question de compréhension » ; « Piège : le bureau est mentionné, mais il n'est pas la cause. » ; chips « + ticket », « + lost », « + documents » ; étiquette « Mots clés à ajouter au carnet » ; boutons « Revoir la notion », « Pourquoi j'ai raté ? », « Question suivante ».
- **Règles** : visible aussi quand la réponse est juste (sans « Ta réponse » ni « Pourquoi j'ai raté ? », variante à dessiner : écart E-15). Le corrigé suit le style existant (carte jaune doux `theme.corrige`). **Lot** : « Pourquoi j'ai raté ? » est reporté en S2 (D-01) : en S1 ce bouton est absent. **Porte payante** : une explication détaillée coûte `cert_explanation` (F10) ; la maquette montre X1 mais pas le point d'entrée dans B9 : écart E-08, question ouverte Q-01.
- **Évènements** : `cert_notion_opened { notion, source: 'explication' }` à « Revoir la notion ».
- **Acceptation** : AC-B9-1 la notion est nommée ; AC-B9-2 « Revoir la notion » ouvre la fiche de la notion principale ; AC-B9-3 un tap sur un mot clé l'ajoute en boîte 1 et le chip passe à « ajouté » (texte à dessiner) ; AC-B9-4 en S1 le bouton « Pourquoi j'ai raté ? » n'existe pas.
- **Tests** : Jest (rendu, ajout de mot, navigation) ; pgTAP (corrigé non servi sans droit).

#### B10 · « Pourquoi j'ai raté ? » · lot S2
- **But** : classer la faute en une touche. **Entrée** : B9. **Sortie** : retour à B9 ou question suivante.
- **Données** : quatre raisons fixes, écrites dans `cert_user_question.raison`.
- **Interactif** : « Je ne connaissais pas le mot » (sous-texte « Ajouter au carnet ») → ajoute les mots clés au carnet ; « La règle n'était pas claire » (« Revoir la notion ») → ouvre C5 ; « Je l'ai mal lu » (« Relire la question ») → raison enregistrée ; « Trop vite ou trop lentement » (« Rejouer plus tard ») → rejeu F6 ; lien « Passer ».
- **Textes exacts** : en-tête « Pourquoi j'ai raté ? » ; « Une touche. Ça aide ton plan, sans rien changer à ton score. » ; lignes ci-dessus ; lien « Passer ».
- **Règles** : facultatif ; n'affecte ni F1 ni F3 ; peut influencer F7 (notion de cours : une raison « La règle n'était pas claire » augmente la priorité de la notion).
- **Évènements** : `cert_why_missed { raison }`.
- **Acceptation** : AC-B10-1 chaque raison est enregistrée une fois par question et par tentative ; AC-B10-2 « Passer » n'enregistre rien ; AC-B10-3 aucun score ne change.
- **Tests** : Jest ; pgTAP (écriture idempotente).

#### B11 · Fin de série · lot S1
- **But** : résultat et suite. **Entrée** : dernière question d'une série. **Sortie** : D2 (« Séance du jour ») ; refaire la série.
- **Données** : score de la série ; questions ratées planifiées en rejeu (F6) ; notions touchées ; mots ajoutés pendant la série.
- **Textes exacts** : « Série terminée » ; « Ton résultat » ; « 7 / 10 » ; « Partie 5 · Forme du mot » ; « À rejouer demain » ; « 3 questions ratées » / « Rejeu dans 1 jour, puis 3 jours » ; « Notions touchées » (chips « Forme du mot », « Prépositions ») ; « Mots ajoutés au carnet » (chips « release », « postpone », « deadline ») ; boutons « Séance du jour » et « Refaire la série ».
- **Règles** : le total vient des réponses validées ; les questions passées ne comptent pas dans le « réussi » ; « Séance du jour » ramène à D2 (marque le bloc Série comme terminé quand la série vient de D2).
- **Évènements** : `cert_session_completed` si la série clôt une séance (F7).
- **Acceptation** : AC-B11-1 le nombre de questions à rejouer égale les erreurs de la série ; AC-B11-2 « Refaire la série » tire une nouvelle série de même périmètre.
- **Tests** : Jest (calculs, planification du rejeu F6).

#### États du moteur (dessinés)
`B1-CHARGE` … `B7-CHARGE` : squelette de la question (barre, étiquette, bloc image ou texte, trois lignes), bouton « Valider » désactivé, libellé accessible « Chargement de la question… » (`aria-live="polite"`). `B1-AUDIO-KO` … `B4-AUDIO-KO`, `B3-ERR-AUDIO`, `B8-ERR-AUDIO` : voir B8. Acceptation : AC-ETAT-1 chaque type de question affiche son squelette avant la réponse du serveur ; AC-ETAT-2 les textes ci-dessus sont ceux de `fr.ts`.
Il reste à compléter par l'agent design : états d'erreur de chargement par type (hors audio), image qui ne charge pas (B1), passage trop long (B7), logos (A2).

### 5.C Réviser le TOEIC

#### C1 · Réviser : onglets propres au TOEIC · lot S1
- **But** : point d'entrée du travail libre. **Entrée** : onglet Réviser de l'app pour un profil `certification`. **Sortie** : liste d'une partie (C3), carte de maîtrise (C2), cours (C4), carnet (C6).
- **Données** : nombre de notions publiées (`cert_notions`), mots du carnet et mots « à revoir » (F5), état des parties P1 à P7.
- **Interactif** : onglets segmentés « Parcours », « Parties », « Cours », « Carnet », « Tests » (onglet courant : « Parties ») ; tuiles P1 à P7 → C3 de la partie ; ligne « Carte de maîtrise » → C2 ; ligne « Cours par notion » → C4 ; ligne « Carnet de mots » → C6.
- **Textes exacts** : en-tête « Réviser » ; onglets ci-dessus ; étiquette « Partie 1 à 7 » ; lignes « Carte de maîtrise » / « Notions par partie », « Cours par notion » / « 58 notions », « Carnet de mots » / « 214 mots · 42 à revoir ».
- **Règles** : l'onglet « Tests » (blancs) n'existe qu'à partir du lot V2 (D-02) ; en S1 il est absent (jamais désactivé). L'onglet « Parcours » ouvre D1. Les nombres « 58 » et « 214 · 42 » sont des exemples calculés, jamais figés. Les tuiles P1 à P7 ont trois aspects dans la maquette (`on`, `ok`, `todo`) dont la signification n'est écrite nulle part : écart E-16, question ouverte Q-05. Le code ne les distingue pas tant que la règle n'est pas écrite (toutes les tuiles ont l'aspect neutre).
- **Acceptation** : AC-C1-1 le nombre de notions vient du serveur ; AC-C1-2 « 42 à revoir » égale le nombre de mots en boîte 1 ; AC-C1-3 en S1 l'onglet « Tests » est absent ; AC-C1-4 chaque tuile ouvre la bonne partie.
- **Tests** : Jest (onglets, navigation, comptes).

#### C2 · Carte de maîtrise · lot S1
- **But** : voir ses forces et faiblesses. **Entrée** : C1, A7, D1. **Sortie** : C3 (« Voir la partie 5 »).
- **Données** : F4 par partie ; décompte des notions par état (F3).
- **Textes exacts** : en-tête « Carte de maîtrise » ; « Tes notions, de fragile à acquise. Une notion se travaille avec quelques questions. » ; lignes « Partie 1 » à « Partie 7 » avec barre et état ; totaux « Acquise 12 », « En progrès 19 », « Fragile 9 », « Pas commencée 18 » ; bouton secondaire « Voir la partie 5 ».
- **Règles** : le bouton cible la partie de plus faible maîtrise (F7) ; aucune couleur rouge agressive ; chaque état a icône et texte (R-03) : icônes `AlertCircle` Fragile, `TrendingUp` En progrès, `Check` Acquise, `Circle` Pas commencée.
- **Évènements** : `cert_mastery_viewed { ecran: 'carte' }`.
- **Acceptation** : AC-C2-1 la somme des quatre totaux égale le nombre de notions publiées ; AC-C2-2 la barre d'une partie égale `M_partie × 100` arrondi ; AC-C2-3 sans réponse, S7 (pas de carte vide trompeuse).
- **Tests** : Jest (F3, F4 sur jeux connus, totaux).

#### C3 · Une partie : notions avec état · lot S1
- **But** : notions d'une partie. **Entrée** : C1, C2. **Sortie** : C5 (« Revoir la notion ») ; série sur la notion (« M'entraîner sur Forme du mot »).
- **Données** : notions dont `parts` contient la partie, avec F3 ; nombre de questions faites et réussies.
- **Textes exacts** : en-tête « Partie 5 · Notions » ; lignes « Forme du mot » / « 6 questions · 2 réussies » / Fragile ; « Prépositions de temps » / « 9 questions · 6 réussies » / En progrès ; « Temps du passé » / « 12 questions · 11 réussies » / Acquise ; « Connecteurs » / « 0 question faite » / Pas commencée ; bouton secondaire « Revoir la notion » ; bouton « M'entraîner sur Forme du mot ».
- **Règles** : le bouton vert cible la notion la plus fragile de la partie ; la notion active est celle de la ligne choisie (la maquette ne montre pas la sélection de ligne : écart E-17). Tri : état (Fragile, En progrès, Pas commencée, Acquise) puis ordre du référentiel.
- **Acceptation** : AC-C3-1 le décompte « {n} questions · {r} réussies » est brut ; AC-C3-2 « 0 question faite » pour une notion vierge ; AC-C3-3 le bouton vert lance une série de `{series_size}` (initial 10) questions de la notion.
- **Tests** : Jest ; pgTAP (étiquetage question-notion).

#### C4 · Cours groupés par famille · lot S1
- **But** : parcourir les fiches. **Entrée** : C1. **Sortie** : C5.
- **Données** : `cert_notions` publiées, groupées par famille (grammaire, vocabulaire, pièges, méthode) puis par partie.
- **Textes exacts** : en-tête « Cours » ; onglets « Grammaire », « Vocabulaire », « Pièges », « Méthode » ; étiquettes « Grammaire · Partie 5 » et « Pièges · Partie 6 » ; lignes « Forme du mot » / « Nature du mot, 3 minutes », « Prépositions de temps » / « in, on, at, by, until », « Temps du passé » / « Simple et continu », « Connecteurs » / « However, therefore, despite ».
- **Règles** : la durée « 3 minutes » vient de la fiche (`duree_min`). 30 fiches en S1, 60 ensuite (planning). Fiche expirée : S9.
- **Acceptation** : AC-C4-1 un onglet n'affiche que sa famille ; AC-C4-2 une notion sans fiche publiée n'apparaît pas ; AC-C4-3 la liste reste lisible hors ligne pour les fiches préchargées.
- **Tests** : Jest ; test des clés locales dans `reviser.test.ts` (R-07).

#### C5 · Fiche d'une notion · lot S1
- **But** : enseigner la notion en 3 minutes. **Entrée** : C3, C4, B9, D2. **Sortie** : série d'ancrage ; série sur la notion (« M'entraîner sur cette notion »).
- **Données** : `cert_notions.cours_md` (règle, exemples, piège, faux amis), trois questions d'ancrage (`cert_notion_ancrage`).
- **Textes exacts** : en-tête « Prépositions de temps » ; carte « Règle » : « « on » pour un jour ou une date, « at » pour une heure, « in » pour un mois ou une année. » ; étiquette « Exemples » : « We meet on Monday. / Nous nous voyons lundi. », « The report is due by noon. / Le rapport est dû avant midi. » ; carte « Piège TOEIC » : « « until » suit une action qui dure. « by » indique une limite. » ; chip « Faux ami : actually ≠ actuellement » ; étiquette « 3 questions d'ancrage » ; ligne « Question 1 · 3 minutes » / « Choisir la préposition » ; bouton « M'entraîner sur cette notion ».
- **Règles** : ouvrir la fiche enregistre `cert_notion_opened` et fixe la date de dernière ouverture (F7, anti-répétition) ; le texte est servi par `lireLocalHorsLigne` ; le faux ami est facultatif ; une seule action verte.
- **Évènements** : `cert_notion_opened { notion, source }` (source : liste, partie, explication, séance).
- **Acceptation** : AC-C5-1 règle, exemples, piège toujours présents ; AC-C5-2 les trois questions d'ancrage lancent une mini-série comptée dans F3 ; AC-C5-3 fiche expirée → S9.
- **Tests** : Jest (rendu markdown contrôlé, navigation) ; pgTAP (lecture publique des fiches `reviewed`).

#### C6 · Carnet de mots · lot S1
- **But** : gérer les mots. **Entrée** : C1, D1. **Sortie** : C7, C8, ajout de mot.
- **Données** : `cert_user_mot` + `cert_mots` ; comptes par état (F5).
- **Textes exacts** : champ « Rechercher un mot » ; onglets « À revoir 42 », « En cours 88 », « Connus 84 » ; lignes « postpone » / « reporter · boîte 1 » / À revoir, « deadline » / « date limite · boîte 2 » / En cours, « invoice » / « facture · boîte 4 » / Connu, « quarterly » / « trimestriel · boîte 1 » / À revoir ; bouton « Ajouter un mot ».
- **Interactif** : recherche → filtre en direct (mot ou définition) dans tous les états ; ligne → C7 ; « Ajouter un mot » → saisie d'un mot du lexique ou, s'il n'existe pas, mot libre [maquette à venir : formulaire d'ajout] ; onglet → liste de l'état ; la séance de mots se lance depuis C7 (bouton « Commencer la séance de mots »).
- **États** : vide S5 (« Ton carnet est vide » ; « Les mots que tu ajoutes, ou que tu rates en série, apparaissent ici. » ; bouton « Ajouter un mot » ; compteurs à 0) ; recherche vide S6 (« Aucun résultat » ; « Aucun mot ne correspond à « contrat ». Vérifie l'orthographe, ou ajoute-le à la main. » ; bouton « Ajouter « contrat » »).
- **Règles** : mot libre (hors lexique) : définition saisie par l'élève, sans audio ; F5 s'applique à tous les mots.
- **Acceptation** : AC-C6-1 les compteurs des onglets égalent les nombres de mots par état ; AC-C6-2 la somme égale le nombre de mots du carnet (214 = 42 + 88 + 84 dans l'exemple) ; AC-C6-3 la recherche est insensible à la casse et aux accents ; AC-C6-4 « Ajouter « contrat » » préremplit le mot cherché.
- **Tests** : Jest (filtre, onglets, états vides) ; pgTAP (RLS, isolation des carnets).

#### C7 · Fiche d'un mot · lot S1
- **But** : voir un mot et lancer la séance. **Entrée** : C6. **Sortie** : C8.
- **Textes exacts** : en-tête = le mot (« postpone ») ; « Verbe · définition » ; « reporter, remettre à plus tard » ; « They decided to postpone the meeting. » ; « Ils ont décidé de reporter la réunion. » ; lecteur « Prononciation » ; étiquette « Questions où il a été raté » ; lignes « Partie 5 · Question 112 » / « Mal classé, mot inconnu » ; « Partie 7 · Question 178 » / « Vu à la lecture » ; ligne « Boîte » + état « Boîte 1 · à revoir » ; bouton « Commencer la séance de mots ».
- **Règles** : l'audio du mot est facultatif (budget ElevenLabs : mot seul pour tous les mots, phrase d'exemple pour 200 mots) ; sans audio, le lecteur n'est pas affiché ; les libellés « Mal classé, mot inconnu » et « Vu à la lecture » correspondent à des motifs à définir (écart E-18).
- **Acceptation** : AC-C7-1 l'état correspond à la boîte (F5) ; AC-C7-2 le bouton lance une séance de `{words_session_size}` mots échus ; AC-C7-3 sans mot échu le bouton est remplacé par un texte d'information [maquette à venir].
- **Tests** : Jest.

#### C8 · Séance de mots · lot S1
- **But** : rappel espacé. **Entrée** : C7, D2. **Sortie** : C9.
- **Données** : mots échus (F5), taille de séance.
- **Interactif** : tap sur la carte → retourne (recto → verso) ; « Je savais » → boîte +1 ; « Je ne savais pas » → boîte 1 ; quitter → X3.
- **Textes exacts** : en-tête « Séance de mots · 3 / 10 » ; étiquette « Recto » ; mot « postpone » ; « Touche pour voir la réponse » ; aide « Mot à réviser : rappel dans 1 jour si tu ne le savais pas. » ; boutons « Je ne savais pas » (secondaire) et « Je savais » (vert). Le verso n'est pas dessiné [maquette à venir].
- **Règles** : un mot n'est noté qu'après retournement ; le résultat est écrit localement puis rejoué (idempotent, `client_uuid` par mot et par séance) ; le texte d'aide affiche le délai réel de F5.
- **Évènements** : `cert_word_state_changed { mot, boite_avant, boite_apres }`.
- **Acceptation** : AC-C8-1 « Je savais » passe la boîte de n à min(4, n+1) ; AC-C8-2 « Je ne savais pas » renvoie en boîte 1 ; AC-C8-3 la progression « k / N » avance après chaque note ; AC-C8-4 les boutons de notation sont inactifs avant le retournement.
- **Tests** : Jest (F5 exhaustif sur boîtes 1 à 4, idempotence), pgTAP (`cert_word_result`).

#### C9 · Fin de séance de mots · lot S1
- **Textes exacts** : en-tête « Séance terminée » ; « Ta séance » ; « 7 mots sur 10 » ; « 3 mots reviendront demain. » ; étiquette « Boîtes » ; tuiles « Boîte 1 · 4 mots », « Boîte 2 · 3 mots », « Boîte 3 · 2 mots », « Boîte 4 · 1 mot » ; bouton « Retour au carnet ».
- **Règles** : « k mots sur N » = mots notés « Je savais » ; « reviendront demain » = mots notés « Je ne savais pas » (boîte 1, échéance J+1). Les tuiles comptent **tous** les mots de la séance par boîte après la séance (la somme égale N). Si la séance vient de D2, le bouton devient « Séance du jour » (variante à dessiner : écart E-19).
- **Acceptation** : AC-C9-1 la somme des tuiles égale N ; AC-C9-2 « reviendront demain » égale le nombre d'échecs.
- **Tests** : Jest.

### 5.D Parcours du jour

#### D1 · Accueil TOEIC après le diagnostic · lot S1
- **But** : accueil du profil. **Entrée** : A7, onglet d'accueil. **Sortie** : D2, D3, C2.
- **Données** : séance du jour (F7), score estimé (F1, F2), jours avant le test (F8), maîtrise.
- **Interactif** : « Commencer la séance » → D2 ; tuile « Score estimé » → A7 ; ligne « Mon plan de la semaine » → D3 ; ligne « Carte de maîtrise » → C2.
- **États** : avant diagnostic S7 ; diagnostic en cours S8 ; date du test absente → la tuile « Test dans » est omise ; date passée [maquette à venir : écart E-09].
- **Textes exacts** : en-tête « Mon TOEIC » ; « Séance du jour · 20 minutes » ; « Séance du jour » ; « Parce que tu as raté 4 questions sur les prépositions. » ; tuiles « Score estimé » / « 650 à 730 sur 990 » et « Test dans » / « 42 jours » ; lignes « Mon plan de la semaine » / « Séances et rejeux », « Carte de maîtrise » / « 3 notions fragiles » ; bouton « Commencer la séance ».
- **Règles** : « 3 notions fragiles » = nombre de notions Fragile ; la durée affichée est celle de A4 / D4.
- **Évènements** : `cert_session_started { composition }` au tap sur « Commencer la séance ».
- **Acceptation** : AC-D1-1 la phrase « Parce que… » est celle de F7 ; AC-D1-2 la barre d'avancement correspond aux blocs terminés ; AC-D1-3 sans date, aucune tuile « Test dans ».
- **Tests** : Jest (F7 sur jeux connus ; états S7, S8).

#### D2 · Séance du jour · lot S1
- **But** : la séance composée. **Entrée** : D1. **Sortie** : C5 (cours), C8 (mots), série de rejeu, série ; B11 ramène ici.
- **Interactif** : « Commencer » → lance le premier bloc non terminé ; lignes de blocs → ouvrent le bloc ; « Changer la durée » → feuille de choix 10/20/30 [maquette à venir] ; chaque bloc terminé est coché.
- **Textes exacts** : en-tête « Séance du jour » ; encadré « Pourquoi cette séance ? / Parce que tu as raté 4 questions sur les prépositions, et que 6 mots du carnet arrivent à échéance. » ; lignes « Un point de cours » / « Prépositions de temps · 3 min », « Des mots à revoir » / « 6 mots · séance de mots », « Des questions à rejouer » / « 4 questions ratées · partie 5 », « Une série » / « Partie 5 · 10 questions » ; avancement « 0 sur 4 terminés » ; bouton « Commencer » ; lien « Changer la durée ».
- **États** : bloc sans contenu omis (F7) ; aucun bloc possible → ES-2 [maquette à venir : écart E-20].
- **Acceptation** : AC-D2-1 la composition respecte le budget de F7 pour 10, 20 et 30 minutes ; AC-D2-2 un bloc terminé reste terminé après relance de l'app ; AC-D2-3 la séance est enregistrée à la fin du dernier bloc avec sa composition ; AC-D2-4 changer la durée recompose la séance non commencée.
- **Tests** : Jest (F7 : cas sans mots échus, sans rejeu, sans notion récente, trois durées) ; pgTAP (`cert_session_complete` idempotent).

#### D3 · Mon plan · lot S2 (calcul simple en S1 : liste des jours)
- **But** : semaine et jours avant le test. **Entrée** : D1. **Sortie** : D4 (« Modifier mon objectif »).
- **Textes exacts** : en-tête « Mon plan » ; « Semaine du 12 octobre » ; grille L M M J V S D ; carte « Test le 26 novembre » / « Il reste 42 jours. Le plan prévoit 3 séances par semaine. » avec barre ; lignes « Lundi et mardi » / « Faits », « Jeudi et plus » / « Prévus » ; bouton secondaire « Modifier mon objectif ».
- **Règles** : jours faits = jours avec au moins une séance terminée (D2) ; la barre = jours écoulés entre la création du plan et la date du test ; « 3 séances par semaine » : règle non définie (écart E-21, question ouverte Q-06) ; proposition : 3 par défaut, 5 si l'écart entre estimation et objectif dépasse 150 points ou s'il reste moins de 28 jours ; réglage `{plan_sessions_per_week}`.
- **Acceptation** : AC-D3-1 la grille marque les jours faits ; AC-D3-2 le nombre de jours restants égale F8 ; AC-D3-3 sans date, la carte devient « Ton plan » sans compte à rebours [maquette à venir].
- **Tests** : Jest.

#### D4 · Moi : objectif, date, temps par jour · lot S1
- **But** : modifier les trois réglages. **Entrée** : Moi, D3. **Sortie** : retour à Moi.
- **Textes exacts** : en-tête « Mon objectif TOEIC » ; « Score visé » (valeur « 800 », chevron) ; « Date du test » (« 26 novembre 2026 ») ; « Temps par jour » (pastilles « 10 », « 20 », « 30 ») ; aide « Le score ne garantit rien. Les changements s'appliquent à ton plan du jour. » ; bouton « Enregistrer ».
- **Règles** : même validation que A3 et A4 ; « Score visé » ouvre la saisie de A3 dans une feuille [maquette à venir] ; l'enregistrement recompose la séance du jour non commencée.
- **Évènements** : `cert_goal_set` (si le score ou la date change), `cert_daily_time_set`.
- **Acceptation** : AC-D4-1 un changement est visible dans D1 et D3 sans relance ; AC-D4-2 aucune valeur hors bornes n'est enregistrée.
- **Tests** : Jest.

### 5.E Test blanc (lot V2, épreuve sombre dans les deux thèmes)

Rappel : tout l'ensemble E1 à E7 est **hors du lot S1 et S2** (D-02). Aucun code n'est écrit avant la maquette finale validée par Benny et l'ouverture du lot V2. Les fiches ci-dessous fixent le comportement attendu pour éviter une dérive plus tard.

#### E1 · Introduction au test blanc
- **Textes exacts** : en-tête « Test blanc » ; « Test complet » ; « 200 questions · 2 h » ; « 45 minutes d'écoute, puis 75 minutes de lecture. Pas de pause automatique. » ; lignes « Chronomètre exact » / « Il tourne aussi en arrière-plan », « Audio joué une seule fois » / « Pas de réécoute en Listening », « Pas de retour en Listening » / « Retour libre en Reading » ; encadré « Un test blanc ne donne pas de score officiel. L'estimation vient de la même règle que la démo. » ; boutons « Commencer le test » et lien « Plus tard ».
- **Règles** : coût selon `cert_mock_full` (E7) ; chronomètre sur horodatage absolu + `AppState` (comme le chronomètre des annales) ; le mode demi-test n'est pas dessiné [maquette à venir]. Le texte « même règle que la démo » est interne et ne doit pas être affiché tel quel (écart E-22).
- **Acceptation** : AC-E1-1 le coût est lu du serveur ; AC-E1-2 « Plus tard » ne débite rien.

#### E2 · Listening : question, audio, pas de retour
- **Textes exacts** : en-tête « Listening · question 45 » ; grille de numéros 41 à 45 ; audio « Question 45 · écoute en cours » ; « Qu'est-ce que la femme va faire ? » ; options « Envoyer le contrat. », « Appeler le client. », « Changer de bureau. » ; indication « Pas de retour en Listening » ; bouton « Question suivante ».
- **Règles** : audio joué une fois (B8 mode examen) ; aucune navigation vers une question passée ; enchaînement automatique à la fin de l'audio non dessiné.
- **Acceptation** : AC-E2-1 impossible de revenir à une question de Listening ; AC-E2-2 l'audio ne se rejoue pas ; AC-E2-3 le chronomètre continue en arrière-plan.

#### E3 · Transition vers Reading
- **Textes exacts** : « Transition » ; « Fin de Listening » ; « Reading commence » ; « Tu peux revenir librement sur les questions de Reading. » ; bouton « Commencer Reading ».

#### E4 · Reading : navigation libre
- **Textes exacts** : en-tête « Reading · navigation libre » ; grille 101 à 110 ; « Partie 5 · question 104 » ; « The board ______ the new plan on Tuesday. » ; options « approve », « approved », « approves » ; boutons « Revoir les questions » et « Question suivante ».
- **Règles** : la grille donne l'état (répondue, courante, à faire) avec texte pour l'accessibilité ; retour libre.

#### E5 · Pause
- **Textes exacts** : « Pause » ; « Temps restant » ; « 12:40 » ; « La pause compte dans le temps total, sauf règle fixée pour le test. » ; bouton « Reprendre le test ».
- **Règles** : règle de pause non décidée (question ouverte Q-08) ; le texte de la maquette ne doit pas être publié avant décision.

#### E6 · Bilan du test
- **Textes exacts** : en-tête « Bilan du test » ; « Estimation sur 990 » ; « 680 à 760 » ; « Une estimation, pas un score officiel. » ; lignes de maîtrise « Listening » et « Reading » ; « Les 3 notions qui ont coûté le plus » avec « Forme du mot » / « 9 points perdus », « Connecteurs » / « 6 points perdus », « Prépositions » / « 5 points perdus » ; « Temps par partie : P1 4 min · P5 14 min · P7 31 min » ; bouton « Voir mon plan ».
- **Règles** : « points perdus » = nombre de questions fausses pondérées par le rôle de la notion (principale 1, secondaire 0,5), arrondi à l'entier ; mêmes F1 et F2 ; le détail de toutes les parties est à dessiner [maquette à venir].

#### E7 · Coût et packs hors ligne
- **Textes exacts** : en-tête « Coût et packs » ; « Ce test blanc coûte » ; « Exemple : 5 crédits » ; « Le montant vient du serveur. Les crédits de la semaine sont mis de côté pour tes séances. » (**texte à clarifier** : écart E-23) ; lignes « Pass inclus » / « Test blanc illimité pendant le pass », « Pack hors ligne » / « Audio et questions pour 7 jours » ; « Un pack se télécharge sur le Wi-Fi. Le contenu expire après 7 jours sans connexion. » ; boutons « Télécharger le pack » et « Plus tard ».
- **Règles** : coût `cert_mock_full` / `cert_mock_half` ; débit idempotent au lancement ; poids du pack affiché avant téléchargement [maquette à venir] ; téléchargement sur Wi-Fi uniquement (réglage).

### 5.S États transverses (dessinés)

| ID | Où il s'applique | Textes exacts | Comportement |
| --- | --- | --- | --- |
| S1 | Chargement d'une question de série | « Série · chargement », « Chargement de la question… » (`aria-live="polite"`), bouton « Valider » grisé | Squelette de B1 à B7 ; durée maximale avant S2 : `{load_timeout_s}` (initial 15) |
| S2 | Série impossible à charger | « Erreur de chargement », « Impossible de charger la série », « Tes réponses déjà données sont gardées sur l'appareil. », boutons « Réessayer » et « Revenir au carnet » | « Revenir au carnet » est mal nommé : le bouton revient à l'écran d'origine de la série (écart E-24) ; « Réessayer » relance la requête |
| S3 | Série hors ligne | pastille « Hors ligne », « Question 5 sur 10 · partie 2 », « Ta réponse est gardée sur l'appareil. Elle partira à la reconnexion. », bouton « Question suivante » | Les questions déjà préparées restent jouables ; la file locale part à la reconnexion (idempotente) |
| S4 | Réponse non envoyée | « Non envoyée », « Ta réponse n'est pas encore partie. », « Elle est gardée. On réessaie dès que la connexion revient. », boutons « Réessayer maintenant » et « Continuer » | Reprise automatique avec délai dégressif (comme la connectivité, AGENTS.md §16) ; jamais de perte silencieuse |
| S5 | Carnet vide | « Ton carnet est vide », « Les mots que tu ajoutes, ou que tu rates en série, apparaissent ici. », bouton « Ajouter un mot » | Voir C6 |
| S6 | Recherche sans résultat | « Aucun résultat », « Aucun mot ne correspond à « contrat ». Vérifie l'orthographe, ou ajoute-le à la main. », « Ajouter « contrat » » | Voir C6 |
| S7 | Mon TOEIC avant diagnostic (accueil sans séance) | « Pas encore de séance », « Fais d'abord le diagnostic : il sert à composer ta séance. », lignes « Carte de maîtrise » / « Vide tant que le diagnostic n'est pas fait », « Cours », « Carnet de mots », bouton « Commencer le diagnostic » | Remplace D1 tant qu'aucune réponse de diagnostic ; **doublon avec A5** (écart E-07) |
| S8 | Estimation pas encore disponible | tuiles « Score estimé » / « Pas encore » et « Test dans » / « 42 jours » ; « Estimation à venir » ; « Il faut au moins 20 réponses pour estimer ton score. Tu en es à 12. » ; barre ; bouton « Continuer le diagnostic » | Seuil `{score_min_answers}` ; le nombre « 12 » est calculé |
| S9 | Contenu expiré | pastille « Contenu expiré », « Ce cours n'a pas été mis à jour depuis 7 jours », « Connecte-toi pour le rafraîchir. Tu peux relire le début, sans les exercices. », boutons « Actualiser » et « Relire le début » | `{offline_validity_days}` ; « Relire le début » affiche le début de la fiche sans questions d'ancrage ni explications |

Acceptation : AC-S-1 chaque état est atteignable par un test (réseau coupé, serveur en erreur, contenu daté de plus de 7 jours) ; AC-S-2 aucun de ces états n'est une impasse (toujours un bouton de sortie) ; AC-S-3 les textes sont ceux de `fr.ts`, pas des chaînes locales. Tests : Jest par état avec connectivité simulée, horloge simulée pour S9.

### 5.X Écrans ajoutés (à valider par Benny)

Tant que Benny n'a pas validé, ils restent dans le périmètre mais marqués « à valider » (question Q-04).

#### X1 · Feuille de crédits pour une explication payante · lot S1 (si validé)
- **Textes exacts** : « Explication payante » ; « Il te faut 1 crédit » (montant lu du serveur) ; « Une explication détaillée de cette notion. Les séances, le cours et le carnet restent gratuits. » ; lignes « Recharger mes crédits » / « Pass ou crédits » et « Revoir la notion gratuitement » / « Le cours est gratuit » ; boutons « Voir l'explication » et lien « Plus tard ».
- **Règles** : réutilise `FeuilleCout` / `FeuilleEpuise` quand c'est possible (écart E-08 sur le point d'entrée) ; pass actif : la feuille n'apparaît pas. Si le solde est insuffisant : `FeuilleEpuise`.
- **Acceptation** : AC-X1-1 le coût vient de `credit_actions.cert_explanation` ; AC-X1-2 « Revoir la notion gratuitement » ouvre C5 sans débit ; AC-X1-3 débit idempotent.

#### X2 · Signaler une erreur · lot S2
- **Textes exacts** : « Signaler une erreur » ; « Un corrigé ou une notion te semble faux ? Dis-nous. La relecture se fait dans la semaine. » ; lignes « La bonne réponse est fausse » / « Question 112 », « L'explication est fausse » / « Notion : Prépositions », « Le son ne correspond pas » / « Audio de la question » ; « Ton message ne contient pas de donnée personnelle. » ; bouton « Envoyer ».
- **Règles** : table `cert_error_reports(question_id, type, client_uuid)` ; un signalement par question et par type et par élève ; le point d'entrée (B9) n'est pas dessiné [maquette à venir].
- **Évènements** : `cert_error_reported { type }`.

#### X3 · Quitter une série · lot S1
- **Textes exacts** : « Quitter la série ? » ; « Tu peux reprendre plus tard » ; « Tes réponses sont gardées sur l'appareil, même hors ligne. » ; boutons « Reprendre la série » et « Quitter et garder mes réponses ».
- **Règles** : quitter n'efface pas la série (reprise au même endroit, validité `{offline_validity_days}`) ; déclenché par le retour système et le bouton retour de l'en-tête ; ne s'affiche pas si aucune réponse n'a été donnée.
- **Acceptation** : AC-X3-1 reprendre rouvre la bonne question ; AC-X3-2 quitter garde les réponses.

#### X4 · Pack audio manquant · lot S1 (audio d'une question) / V2 (pack)
- **Textes exacts** : « Pack audio manquant » ; pastille « Hors ligne » ; « Il manque l'audio de ce test » ; « Le texte reste disponible. Connecte-toi pour télécharger l'audio. » ; « Contenu périmé après 7 jours sans connexion : il se remet à jour dès que tu es en ligne. » ; boutons « Réessayer » et « Continuer sans audio ».
- **Règles** : en S1 (pas de pack), le même écran s'affiche quand l'audio d'une question n'est pas en cache et que le réseau est coupé ; « Continuer sans audio » traite la question comme « Passer la question » (B8).

## 6. Modèle de données (conception ; aucune migration encore)

Toutes les tables dans le schéma `public` de `elearn-supabase`, éditées dans `supabase/schemas/`, migration additive via `supabase db diff`, tests pgTAP (`npx supabase@2.118.0 test db`), PR vers `elearn-supabase` (jamais `main`), rapport à Benny après chaque migration poussée.

| Table | Rôle | Champs principaux | RLS |
| --- | --- | --- | --- |
| `cert_exams` | Examens (A2) | code, nom, sous_titre, duree, nb_questions, goal_steps, actif, ordre | lecture publique des actifs |
| `cert_settings` | Paramètres des formules (section 4) | cle, valeur jsonb | lecture publique, écriture back-office |
| `cert_notions` | Notions et fiches | code, famille, titre, parts[], ordre, cours_md, duree_min, statut | lecture des `reviewed` |
| `cert_questions` | Questions | type, partie, enonce, options, bonne, notion_principale, piege, explication, image, audio_path, passage_id, statut | lecture sans `bonne` ni `explication` avant réponse (RPC) |
| `cert_question_notions` | Étiquettes | question_id, notion_id, role | idem |
| `cert_mots` | Lexique | mot, pos, def_fr, def_en, exemple, theme, niveau, audio_path, statut | lecture des `reviewed` |
| `cert_question_mots` | Mots clés d'une question | question_id, mot_id | idem |
| `cert_notion_ancrage` | Trois questions d'ancrage | notion_id, question_id, rang | lecture |
| `cert_user_plan` | Objectif, date, minutes par jour | user_id, exam, objectif, date_test, minutes_par_jour | propriétaire |
| `cert_user_question` | Dernière réponse, rejeu, raison | user_id, question_id, juste, repondu_le, prochaine_revue, serie_juste, raison | propriétaire |
| `cert_user_notion` | Notions vues | user_id, notion_id, derniere_ouverture | propriétaire |
| `cert_user_mot` | Carnet | user_id, mot_id, boite, prochaine_revue, vues, bonnes, mauvaises | propriétaire |
| `cert_sessions` | Séances | id, user_id, client_uuid unique, composition jsonb, termine_le | propriétaire |
| `cert_answers` | Journal des réponses (source de F3) | user_id, question_id, client_uuid unique, juste, repondu_le, duree_s, contexte (diagnostic, serie, rejeu, test) | propriétaire |
| `cert_error_reports` | Signalements (X2) | user_id, question_id, type, client_uuid | écriture propriétaire, lecture back-office |

RPC proposées (toutes `security definer` avec contrôle explicite de `auth.uid()`, idempotentes quand elles écrivent) : `cert_list_exams`, `cert_get_settings`, `cert_diagnostic_draw`, `cert_series_get`, `cert_submit_answers(batch)`, `cert_notions_list`, `cert_notion_get`, `cert_words_list`, `cert_word_result(batch)`, `cert_set_plan`, `cert_session_complete`, `cert_report_error`, `cert_mastery_for(user)` (pour la reprise multi-appareils).
Hors ligne et invité : le diagnostic et les réponses sont d'abord locaux (clés `cert.*` listées en R-07), rattachés au compte à sa création comme le mini-test actuel (reprise d'invité). Le calcul de F3 à F7 est fait **sur l'appareil** en S1 à partir des réponses locales, avec les mêmes fonctions pures que celles testées ; le serveur recalcule plus tard (S2) sans changer le résultat attendu.

## 7. Évènements PostHog

Tout évènement est typé dans `src/services/evenements.ts`. Propriétés minimales ; aucune donnée personnelle.

| Évènement | Propriétés | Écran(s) | Statut |
| --- | --- | --- | --- |
| `onboarding_choice_made` | `profil: 'certification'` (+ `niveau`, `pays` à rendre facultatifs pour cette valeur) | A1 | existant, nouvelle valeur |
| `cert_exam_chosen` | `examen` | A2 | maquette |
| `cert_goal_set` | `score`, `date_renseignee` | A3, D4 | maquette |
| `cert_goal_skipped` | aucune | A3 | maquette |
| `cert_daily_time_set` | `minutes` | A4, D4 | **à ajouter** (absent de la liste de la maquette) |
| `cert_diagnostic_started` | aucune | A5 | maquette |
| `cert_diagnostic_completed` | `score_min`, `score_max` | A7 | maquette |
| `cert_exercise_answered` | `type`, `partie`, `juste` | A6, B1 à B7 | maquette |
| `cert_why_missed` | `raison` | B10 | maquette |
| `cert_notion_opened` | `notion`, `source` | B9, C3, C4, C5, D2 | maquette |
| `cert_word_state_changed` | `mot`, `boite_avant`, `boite_apres` | C8, B9, C6 | maquette |
| `cert_session_started` | `composition` | D1 | maquette |
| `cert_session_completed` | `composition` | B11, C9, D2 | maquette |
| `cert_mastery_viewed` | `ecran` | A7, C2 | maquette |
| `cert_error_reported` | `type` | X2 | maquette |
| `cert_audio_error` | `ecran`, `code` | B8, B*-AUDIO-KO | **à ajouter** |
| `cert_offline_answer_queued` / `cert_offline_answer_flushed` | `nb` | S3, S4 | **à ajouter** |
| `cert_credit_gate_viewed` | `action` | X1 | **à ajouter** |
| `cert_mock_started` / `cert_mock_completed` | `mode`, `score_min`, `score_max` | E1 à E6 | V2, à ajouter |

Acceptation : AC-EV-1 chaque évènement ci-dessus a un test qui vérifie le nom et les propriétés ; AC-EV-2 aucun évènement ne contient d'e-mail, de nom ni de numéro.

## 8. Plan de tests (récapitulatif)

- **Jest (app)** : un fichier par écran (`src/components/certification/__tests__/<Ecran>.test.tsx`) couvrant rendu clair/sombre, états de la section 3, interactions de la fiche, évènements ; un fichier par service pur (`certScore`, `certMaitrise`, `certCarnet`, `certSeance`, `certRejeu`) couvrant F1 à F7 par jeux de données connus (limites incluses : 0 réponse, 1 réponse, seuil exact 0,40 et 0,70, boîte 4, année bissextile pour F8) ; test des clés locales dans `src/services/__tests__/reviser.test.ts` (R-07) ; test du garde-fou natif inchangé (aucun module natif ajouté).
- **pgTAP (base)** : isolation entre deux comptes pour chaque table `cert_user_*` et `cert_answers`, idempotence de chaque RPC d'écriture (même `client_uuid`, deux appels, un seul effet), non-fuite de la bonne réponse avant la réponse, filtrage `reviewed`, valeurs de `cert_settings` lues par les RPC (aucune constante dans les fonctions).
- **Intégration** : parcours complet A1 → A7 sans compte, puis création de compte et reprise ; parcours série hors ligne puis reconnexion ; parcours séance du jour de bout en bout.
- **Recette Benny sur téléphone** : liste de contrôle générée à partir des critères AC de ce cahier (fichier `fiche-recette-toeic.md`, à produire avec le lot S1).
- **Validation avant poussée** : `npm run valider` ; `git pull` avant push ; un seul push groupé (un push annule l'OTA précédente).

## 9. Tableau de traçabilité

Colonnes : écran (identifiant de la maquette) → exigences (préfixes d'acceptation) → composant → table ou RPC → test → évènement. Chemins de composants : `src/components/certification/` sauf mention « (existant) ». Les composants et RPC sont des noms proposés tant que le code n'existe pas ; ce tableau est mis à jour **avant** le code (règle 0.1).

| Écran | Légende de la maquette | Lot | Exigences | Composant | Table / RPC | Tests | Évènements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Bienvenue : trois cartes | S1 | AC-A1-1 à 5 | `ParcoursArrivee.tsx` (existant, `ChoixCarte`) | drapeau PostHog | `ParcoursArrivee.test` | `onboarding_choice_made` |
| A2 | Liste des certifications | S1 | AC-A2-1 à 6 | `ChoixCertification` (gabarit `ChoixConcours`) | `cert_exams`, `cert_list_exams` | `ChoixCertification.test`, pgTAP exams | `cert_exam_chosen` |
| A3 | Objectif | S1 | AC-A3-1 à 5 | `EcranObjectif` | `cert_user_plan`, `cert_set_plan` | `EcranObjectif.test` | `cert_goal_set`, `cert_goal_skipped` |
| A4 | Temps par jour | S1 | AC-A4-1 à 3 | `EcranTempsParJour` | `cert_user_plan` | `EcranTempsParJour.test` | `cert_daily_time_set` |
| A5 | Arrivée avant diagnostic | S1 | AC-A5-1 à 3 | `AccueilTOEIC` | aucune | `AccueilTOEIC.test` | `cert_diagnostic_started` |
| A6 | Question du diagnostic | S1 | AC-A6-1 à 5 | `Diagnostic`, `QuestionCert` | `cert_diagnostic_draw`, `cert_answers` | `Diagnostic.test`, pgTAP draw | `cert_exercise_answered` |
| A7 | Résultat du diagnostic | S1 | AC-A7-1 à 5 | `ResultatDiagnostic` | F1, F2, F4, `cert_mastery_for` | `certScore.test`, `certMaitrise.test` | `cert_diagnostic_completed`, `cert_mastery_viewed` |
| A8 | Fin du diagnostic | S1 | AC-A8-1 à 2 | `FinDiagnostic` | `cert_answers` | `FinDiagnostic.test` | aucun |
| B1 à B7 | Sept types d'exercice | S1 | AC-B-1 à 4 | `QuestionCert` + un rendu par type | `cert_questions`, `cert_series_get`, `cert_submit_answers` | `QuestionCert.<type>.test`, pgTAP series | `cert_exercise_answered` |
| B8 | Lecteur audio | S1 (examen V2) | AC-B8-1 à 4 | `LecteurAudioCert` (`expo-audio`) | `cert_questions.audio_path` | `LecteurAudioCert.test` | `cert_audio_error` |
| B9 | Explication | S1 | AC-B9-1 à 4 | `ExplicationCert` | `cert_question_notions`, `cert_question_mots` | `ExplicationCert.test`, pgTAP droit | `cert_notion_opened` |
| B10 | Pourquoi j'ai raté ? | S2 | AC-B10-1 à 3 | `FeuillePourquoiRate` | `cert_user_question.raison` | `FeuillePourquoiRate.test` | `cert_why_missed` |
| B11 | Fin de série | S1 | AC-B11-1 à 2 | `FinSerieCert` | F6, `cert_user_question` | `certRejeu.test` | `cert_session_completed` |
| B*-CHARGE, -AUDIO-KO, -ERR-AUDIO | États du moteur | S1 | AC-ETAT-1 à 2 | squelette et bannière par type | aucune | un test par état | `cert_audio_error` |
| C1 | Réviser : onglets | S1 | AC-C1-1 à 4 | `ReviserCert` | `cert_notions`, `cert_user_mot` | `ReviserCert.test` | aucun |
| C2 | Carte de maîtrise | S1 | AC-C2-1 à 3 | `CarteMaitrise` | F3, F4 | `certMaitrise.test` | `cert_mastery_viewed` |
| C3 | Une partie : notions | S1 | AC-C3-1 à 3 | `NotionsPartie` | `cert_notions`, F3 | `NotionsPartie.test` | aucun |
| C4 | Cours par famille | S1 | AC-C4-1 à 3 | `ListeCours` | `cert_notions`, `cert_notions_list` | `ListeCours.test`, `reviser.test` | aucun |
| C5 | Fiche d'une notion | S1 | AC-C5-1 à 3 | `FicheNotion` | `cert_notion_get`, `cert_notion_ancrage`, `cert_user_notion` | `FicheNotion.test` | `cert_notion_opened` |
| C6 | Carnet de mots | S1 | AC-C6-1 à 4 | `CarnetMots` | `cert_user_mot`, `cert_words_list` | `CarnetMots.test`, pgTAP RLS | `cert_word_state_changed` |
| C7 | Fiche d'un mot | S1 | AC-C7-1 à 3 | `FicheMot` | `cert_mots`, `cert_user_mot` | `FicheMot.test` | aucun |
| C8 | Séance de mots | S1 | AC-C8-1 à 4 | `SeanceMots` | F5, `cert_word_result` | `certCarnet.test`, pgTAP | `cert_word_state_changed` |
| C9 | Fin de séance de mots | S1 | AC-C9-1 à 2 | `FinSeanceMots` | `cert_user_mot` | `FinSeanceMots.test` | `cert_session_completed` |
| D1 | Accueil après diagnostic | S1 | AC-D1-1 à 3 | `AccueilTOEIC` | F7, F8, `cert_sessions` | `certSeance.test` | `cert_session_started` |
| D2 | Séance du jour | S1 | AC-D2-1 à 4 | `SeanceDuJour` | F7, `cert_session_complete` | `certSeance.test`, pgTAP | `cert_session_completed` |
| D3 | Mon plan | S2 | AC-D3-1 à 3 | `PlanSemaine` (peut réutiliser `MaSemaine`) | `cert_sessions`, `cert_user_plan` | `PlanSemaine.test` | aucun |
| D4 | Moi : objectif | S1 | AC-D4-1 à 2 | `ObjectifMoi` (dans `EcranMoi.tsx` existant) | `cert_user_plan` | `ObjectifMoi.test` | `cert_goal_set`, `cert_daily_time_set` |
| E1 à E7 | Test blanc | V2 | AC-E1-1 à AC-E2-3 (le reste à écrire au lot V2) | `TestBlanc*` | `cert_questions`, `credit_actions` | à écrire | `cert_mock_*` |
| S1 à S9 | États transverses | S1 | AC-S-1 à 3 | selon l'écran | selon l'écran | un test par état | `cert_offline_answer_*` |
| X1 | Crédits d'une explication | S1 (à valider) | AC-X1-1 à 3 | `FeuilleCout` (existant) | `credit_actions.cert_explanation` | `FeuilleCout.test` | `cert_credit_gate_viewed` |
| X2 | Signaler une erreur | S2 | voir X2 | `FeuilleSignalement` | `cert_error_reports` | à écrire | `cert_error_reported` |
| X3 | Quitter une série | S1 | AC-X3-1 à 2 | `FeuilleQuitterSerie` | file locale | `FeuilleQuitterSerie.test` | aucun |
| X4 | Pack audio manquant | S1 (audio) / V2 (pack) | voir X4 | `AudioManquant` | cache audio local | `AudioManquant.test` | `cert_audio_error` |

## 10. Écarts connus et questions ouvertes

### 10.1 Écarts entre maquette, existant et cahier (à résoudre par le journal, section 11)

| ID | Écart | Où | Proposition par défaut (appliquée tant que non tranchée) |
| --- | --- | --- | --- |
| E-01 | Les textes d'A1 pour Élève et Concours diffèrent du code (« Tu es… », « Élève », « Candidat à un concours » contre « Choisis ton profil », « Je suis élève », « Je prépare un concours » et leurs sous-titres) | A1 | Le code garde les textes actuels ; seuls les deux textes de la carte certification sont nouveaux |
| E-02 | Pas d'état pour 1 à 2 réponses sur une notion (« trop peu de réponses ») ni de seuil minimal | F3, C3 | De 1 réponse à 2 : « En progrès » ; seuil minimal réglable `{mastery_min_answers}` initial 1 |
| E-03 | La fourchette de la maquette (80 points) est plus étroite que celle que 20 questions autorisent honnêtement (de l'ordre de 150 points de chaque côté) | A7, D1 | Fourchette honnête (F2) ; l'écran ne change pas, seule la largeur change ; décision de Benny demandée (Q-03) |
| E-04 | A3 affiche « étape 3 sur 3 » alors que le parcours compte maintenant 4 étapes (A4) | A3 | « étape 3 sur 4 » ; la maquette doit être corrigée |
| E-05 | Logo « LOGO À FOURNIR » et encadré pointillé « D'autres certifications… » sont des repères de maquette, pas des textes de production | A2 | Pas de logo tant que Benny n'en fournit pas (pastille neutre `Languages`) ; encadré non affiché |
| E-06 | « Recommandé pour ton objectif » sur 20 minutes sans règle de recommandation | A4 | Affiché sur 20 minutes en dur côté serveur (`cert_settings.session_minutes_recommended`) |
| E-07 | A5 et S7 sont deux accueils « Mon TOEIC » avant diagnostic aux contenus différents | A5, S7 | A5 est affiché juste après A4 ; S7 est l'état de D1 aux ouvertures suivantes tant que le diagnostic n'est pas commencé ; à fusionner par l'agent design si possible |
| E-08 | La porte payante (X1) n'a pas de point d'entrée dans B9 ; B9 montre le piège gratuitement | B9, X1 | En S1, B9 est entièrement gratuit (piège inclus) ; X1 n'est déclenchée par aucun écran (non branchée) tant que Q-01 n'est pas tranchée |
| E-09 | Date du test passée : aucun état dessiné | D1, D3 | La ligne « Test dans » est omise |
| E-10 | « Pourquoi cette séance ? » sans erreur ni mot échu : pas de texte | D1, D2 | « Pour continuer ton plan. » (texte provisoire, à valider) |
| E-11 | « Question 6 » en partie 2 incompatible avec un ordre strict P1 → P7 sur 20 questions | A6 | Ordre mélangé à l'intérieur de chaque section |
| E-12 | B1 montre trois options ; le vrai test en propose quatre en partie 1 | B1 | Le rendu accepte 3 ou 4 options selon la question |
| E-13 | B3 : énoncé en français alors que le test est en anglais | B3 | Énoncés d'entraînement en anglais comme au test réel, consigne d'écran en français ; à confirmer (Q-09) |
| E-14 | B5 : la pastille de notion est visible avant la réponse et dévoile la matière testée | B5 | Pastille masquée avant la réponse en diagnostic ; visible en entraînement par notion |
| E-15 | Pas de variante de B9 pour une réponse juste | B9 | Même écran sans « Ta réponse » ni « Pourquoi j'ai raté ? » |
| E-16 | Tuiles P1 à P7 (C1) en trois aspects sans signification écrite | C1 | Aspect neutre unique (Q-05) |
| E-17 | C3 : la sélection d'une notion n'est pas dessinée | C3 | Tap sur une ligne ouvre C5 ; le bouton vert cible la notion la plus fragile |
| E-18 | C7 : « Mal classé, mot inconnu » et « Vu à la lecture » : motifs non définis | C7 | Seul le libellé « Partie {p} · Question {n} » est affiché, sans sous-titre |
| E-19 | C9 : retour à D2 non dessiné | C9 | Bouton « Séance du jour » si la séance vient de D2 |
| E-20 | D2 sans aucun bloc : non dessiné | D2 | Retour à D1 avec le texte S7-like provisoire |
| E-21 | D3 « 3 séances par semaine » sans règle | D3 | Q-06 |
| E-22 | E1 « même règle que la démo » est une note interne | E1 | Remplacer par « Une estimation, pas un score officiel. » |
| E-23 | E7 « Les crédits de la semaine sont mis de côté pour tes séances » : règle inexistante | E7 | Texte retiré jusqu'à décision |
| E-24 | S2 « Revenir au carnet » alors que l'origine d'une série varie | S2 | Libellé « Retour » vers l'écran d'origine |
| E-25 | Le fichier `toeic-revue-complete.md` (section « Écrans encore absents ») est périmé : moteur d'exercice, lecteur, test blanc, états sont dessinés dans le HTML | Maquette | L'agent design met le `.md` à jour |
| E-26 | La maquette ne montre pas de variante pour un invité (sans compte) après le diagnostic | A7, D1 | Invitation à créer un compte (feuille existante `FeuilleSauvegarde`) après A7 ; à dessiner |
| E-27 | `Profil.type` accepte seulement `'eleve' | 'concours'` ; `onboarding_choice_made` impose `niveau` et `pays` | Code existant | Type étendu de façon additive ; propriétés facultatives pour `certification` |

### 10.2 Questions ouvertes pour Benny (une réponse débloque chaque ligne)

| ID | Question | Ma recommandation |
| --- | --- | --- |
| Q-01 | Que coûte et que montre l'explication ? B9 est-il entièrement gratuit, ou le piège et l'explication détaillée sont-ils derrière X1 (1 crédit, inclus dans le pass) ? | Corrigé, bonne réponse, notion et piège gratuits ; explication rédigée détaillée payante ; à dessiner dans B9 |
| Q-02 | Logos des examens : les fournit-il ? (marque d'ETS : autorisation d'usage à vérifier) | Pas de logo ETS ; pastille neutre |
| Q-03 | Fourchette du diagnostic : accepte-t-il une fourchette large (honnête) ou veut-il une fourchette étroite (moins fiable) ? | Large, avec la mention « Une estimation » |
| Q-04 | Les quatre écrans X1 à X4 restent-ils dans le périmètre ? | Oui |
| Q-05 | Que signifient les trois aspects des tuiles P1 à P7 dans C1 ? | Retirer cette distinction |
| Q-06 | Combien de séances par semaine dans le plan (D3) ? | 3 par défaut, 5 si l'écart à l'objectif dépasse 150 points ou s'il reste moins de 28 jours |
| Q-07 | Temps par jour : défaut 20 minutes, choix libre de l'élève (décidé le 15 octobre) | Appliqué |
| Q-08 | Test blanc : pause autorisée ou non ? | Non autorisée en Listening, libre en Reading |
| Q-09 | Énoncés des questions d'entraînement : anglais comme au test (consigne en français) ? | Oui |
| Q-10 | Qui relit les explications, fiches et mots en anglais ? | Un enseignant d'anglais avant tout passage en `reviewed` |
| Q-11 | Le TOEIC passe-t-il avant ou après le chemin critique du lancement (#44, #35, #17) ? | À arbitrer par Benny ; un seul agent local à la fois |

## 11. Journal des changements

Format : identifiant · date · auteur · écrans touchés · changement · raison · statut (proposé, validé par Benny, appliqué en maquette, appliqué en code).

| ID | Date | Auteur | Écrans | Changement | Raison | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| J-001 | 2026-10-15 | Claude (fil TOEIC) | tous | Création du cahier de référence v1.0 à partir de la maquette v2 (`ced993c`, `9148a7b`) ; archive de la v0.3 | Demande de Benny : aucun écart entre cahier, maquette et code | proposé |
| D-01 | 2026-10-15 | Claude, planning v0.3 | B9, B10 | « Pourquoi j'ai raté ? » livré en S2 ; absent de B9 en S1 | Tenir la semaine | proposé |
| D-02 | 2026-10-15 | Claude, planning v0.3 | E1 à E7, C1 | Test blanc en V2 ; onglet « Tests » absent de C1 en S1 et S2 | Tenir la semaine | proposé |
| D-03 | 2026-10-15 | Claude, planning v0.3 | E7, X4 | Packs hors ligne en V2 ; X4 en S1 limité à l'audio d'une question | Tenir la semaine | proposé |
| D-04 | 2026-10-15 | Claude, planning v0.3 | D3 | Plan de la semaine en S2 | Tenir la semaine | proposé |
| D-05 | 2026-10-15 | Benny | A4, D4, F7 | Le temps d'étude par jour est choisi par l'utilisateur (10, 20, 30) | Message de Benny du 15 octobre, 19 h 01 | validé |
| D-06 | 2026-10-15 | Benny | planning | Quota ElevenLabs : 131 000 crédits par mois | Message de Benny | validé |
| D-07 | 2026-10-15 | Agent design | tous | Identifiants stables `TOEIC-<section><n>` ; états du moteur | Éviter les dérives | validé |

**Règle d'ajout** : toute modification de ce cahier ajoute une ligne ici avant d'être faite ; une ligne « appliqué en code » cite le commit.

## 12. Définition de « terminé » pour un écran
Un écran est terminé quand : (1) son identifiant, ses textes et ses états sont dans ce cahier ; (2) la maquette correspond (clair, sombre, 130 %) ; (3) tous ses critères AC passent en test ; (4) ses évènements sont typés et testés ; (5) aucun montant ni texte non listé n'est dans le code ; (6) `npm run valider` passe ; (7) Benny l'a vu sur téléphone ; (8) la ligne du tableau 9 est à jour.
