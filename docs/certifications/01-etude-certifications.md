# Étude : profil « Certification » (TOEIC d'abord)

Date : 7 octobre 2026. Étude seulement, aucun code d'app. Les valeurs de crédits et de prix sont des propositions pour la configuration serveur, jamais des constantes de l'app.

Ce document couvre : les certifications à viser, le format exact à reproduire, les types d'exercices, les mini-exercices, le contenu à produire, le modèle de données Supabase, l'impact sur l'app. Le cahier des charges est dans `03-cahier-des-charges.md`, les tarifs dans `04-tarifs-et-modele.md`, l'axe écoles dans `02-etude-ecoles.md`.

Niveau de certitude : le format du TOEIC Listening and Reading est confirmé par les sources citées en fin de document. Les formats TCF, TEF et IELTS sont écrits de mémoire et marqués « à confirmer » : à vérifier sur les sites officiels avant de les inscrire au cahier des charges.

## 1. Quelles certifications viser

Critères : demande réelle en Afrique francophone, correction automatique possible (QCM), coût de contenu, risque juridique, cohérence avec l'audience actuelle (élèves du secondaire, candidats aux concours, futurs étudiants).

| Ordre | Certification | Pourquoi | Correction | Verdict |
| --- | --- | --- | --- | --- |
| 1 | TOEIC Listening and Reading | Exigé ou valorisé par grandes écoles, universités et employeurs ; passé en centre agréé ; 2 compétences, 100 % QCM | Automatique, bon marché | Premier lot |
| 2 | TOEIC Speaking and Writing | Même public, complément naturel | IA (parole et écrit), coûteuse | Deuxième lot, après mesure du coût IA |
| 3 | TOEFL iBT (nouveau format de janvier 2026) | Études en Amérique du Nord, bourses | Lecture et écoute QCM, expression par IA | Troisième lot |
| 4 | IELTS (Academic et General) | Études et immigration (Royaume-Uni, Canada, Australie) | Idem | Quatrième lot |
| 5 | TCF Canada et TEF Canada (français) | Forte demande d'immigration au Cameroun et en Côte d'Ivoire | Compréhension automatique, expression par IA | À étudier : forte demande, mais public plus âgé que l'audience actuelle |
| Hors périmètre | DELF/DALF, Cambridge, DELE, Goethe, certifications numériques | Demande plus faible ou public différent | | Non retenu pour l'instant |

Recommandation : TOEIC Listening and Reading seul en premier. C'est la certification qui coûte le moins à reproduire fidèlement, qui se vend le plus facilement aux écoles (axe 2) et qui prouve le modèle avant d'investir dans la correction d'expression par IA.

Le test lui-même coûte cher à l'élève (ordre de grandeur : 100 000 FCFA l'examen seul dans un centre de Dakar, 180 000 avec 13 heures de préparation). Une préparation à 2 500 ou 7 500 FCFA est très accessible comparée à l'enjeu : c'est un argument de vente, pas une raison de baisser le prix.

## 2. Format exact du TOEIC Listening and Reading à reproduire

Total : 200 questions, 120 minutes, score de 10 à 990 (chaque section de 5 à 495).

### Section Listening (100 questions, environ 45 minutes)

| Partie | Nom | Questions | Ce que voit et entend le candidat |
| --- | --- | --- | --- |
| 1 | Photographs | 6 | Une photo ; quatre phrases entendues (A à D), non imprimées ; choisir celle qui décrit la photo |
| 2 | Question-Response | 25 | Une question ou un énoncé entendu, trois réponses entendues (A à C), rien d'imprimé |
| 3 | Conversations | 39 (13 conversations de 3 questions) | Dialogue de 2 ou 3 personnes ; trois questions imprimées à quatre choix ; certaines avec un graphique ; certaines sur l'intention d'une phrase |
| 4 | Talks | 30 (10 extraits de 3 questions) | Annonce, message, discours ; trois questions imprimées ; certaines avec un graphique |

Règles d'épreuve à reproduire : l'audio se joue une seule fois, sans pause ni retour en arrière ; accents nord-américain, britannique, australien et canadien ; les instructions de chaque partie sont dites avant les questions.

### Section Reading (100 questions, 75 minutes)

| Partie | Nom | Questions | Contenu |
| --- | --- | --- | --- |
| 5 | Incomplete Sentences | 30 | Une phrase avec un blanc, quatre choix : grammaire, forme du mot, vocabulaire |
| 6 | Text Completion | 16 (4 textes de 4 blancs) | Texte court à quatre blancs ; un blanc sur quatre demande d'insérer une phrase entière |
| 7 | Reading Comprehension | 54 | Passages simples (29 questions), doubles (10), triples (15) ; e-mails, annonces, articles, fils de messages, discussions en ligne ; questions de détail, d'inférence, de synonyme, d'intention, d'insertion de phrase |

Le candidat gère son temps sur Reading et peut revenir en arrière. Sur Listening, non.

Le détail 29 / 10 / 15 de la partie 7 et le nombre de dialogues de la partie 3 viennent de ma connaissance du test, non de la source citée : à confirmer sur le guide officiel avant de figer le gabarit d'un test blanc.

### Score
Le score du vrai test vient d'une table de conversion propre à chaque forme, non publiée. L'app affiche donc un **score estimé** avec une fourchette, jamais un score « officiel » (table `cert_score_tables`, §7). Les correspondances avec le cadre européen (CECRL) sont à reprendre telles que publiées par l'éditeur du test.

### Autres tests (à confirmer avant cahier des charges)
- TOEFL iBT depuis le 21 janvier 2026 : quatre sections (lecture, écoute, écriture, expression orale), échelle 1 à 6 par demi-point en plus de l'échelle 0 à 120, lecture et écoute adaptatives, durée totale annoncée entre 67 et 85 minutes.
- TOEIC Speaking and Writing, IELTS, TCF, TEF : relever le format officiel au moment du lot concerné.

## 3. Ce que font les références

**Practice for TOEIC Test Pro** (application mobile) : plus de 3 000 questions, parties 1 à 7, parcours personnalisé selon le niveau, statistiques par partie et par test, calendrier de révision quotidien, cartes de vocabulaire, exercices de grammaire. À garder : simplicité par partie, calendrier, statistiques.

**Global Exam** (web et application) : plus de 30 000 questions créées par des enseignants, parcours personnalisé, examens blancs chronométrés, exercices corrigés, fiches de révision, suivi de progression, abonnement à partir de 29,90 euros. À garder : l'examen blanc fidèle et chronométré, et le diagnostic qui construit le parcours. À éviter : le prix, hors de portée de notre public.

Notre différenciation : prix en FCFA (500 / 2 500 / 7 500), paiement Mobile Money, hors ligne par pack, explications en français pour des anglophones débutants, et la mission de 10 minutes déjà présente dans l'app.

## 4. Types d'exercices

Chaque item a un **type de présentation** unique, ce qui limite les écrans à dessiner (une maquette par type).

| Code | Type | Parties TOEIC | Éléments d'écran |
| --- | --- | --- | --- |
| `audio_photo` | Photo + audio, 4 choix lus | 1 | Image pleine largeur, lecteur audio, boutons A à D sans texte |
| `audio_reponse` | Audio, 3 choix lus | 2 | Lecteur audio, boutons A à C sans texte |
| `audio_groupe` | Un audio, 3 questions imprimées | 3 et 4 | Lecteur audio fixe en haut, une question à la fois, graphique si présent |
| `phrase_blanc` | Phrase à compléter | 5 | Phrase, 4 choix |
| `texte_blancs` | Texte à 4 blancs | 6 | Texte défilant, blanc actif surligné, 4 choix |
| `passage_simple` | Un passage, plusieurs questions | 7 | Passage, panneau de questions |
| `passage_multiple` | Deux ou trois passages liés | 7 | Onglets de passages, panneau de questions |

Ces sept types couvrent les 7 parties. L'expression écrite et orale ajoutera `redaction` et `enregistrement`, hors du premier lot.

Chaque question porte des **étiquettes de compétence** (table `cert_skills`) : par exemple `grammaire.temps`, `grammaire.forme_du_mot`, `vocabulaire.affaires`, `ecoute.piege_sons_proches`, `lecture.inference`. Elles alimentent le diagnostic, le plan de révision et la mission du jour.

## 5. Parcours d'apprentissage et mini-exercices

### Parcours de l'élève
1. **Choix de la certification**, puis **objectif** : score visé (paliers) et date du test (facultative).
2. **Diagnostic** de 20 questions en environ 12 minutes (quelques questions par partie) : score estimé et classement des points faibles. Gratuit.
3. **Plan de révision** : écart entre score estimé et objectif, séances réparties jusqu'à la date du test.
4. **Mission du jour** (10 minutes) : un mini-exercice choisi selon le point faible du jour, comme pour les élèves.
5. **Entraînement par partie** : séries de 10 questions sur une partie ou une étiquette.
6. **Test blanc** : demi-test (Listening ou Reading) ou test complet de 200 questions, dans les conditions réelles.
7. **Bilan** : score estimé, fourchette, détail par partie et par compétence, évolution.
8. **Revoir mes erreurs** : séries construites avec les questions ratées.

### Mini-exercices (2 à 3 minutes, jouables hors ligne)
- **Photo flash** : 5 photos, choix de la bonne description (partie 1).
- **Réponse flash** : 5 questions entendues, choix de la bonne réponse (partie 2) ; pièges des sons proches.
- **Mot manquant** : 8 phrases à blanc sur une étiquette de grammaire (partie 5), avec la règle en une ligne.
- **Forme du mot** : choisir nom, verbe, adjectif ou adverbe.
- **Vocabulaire des affaires** : cartes (réunion, voyage, recrutement, achats), rappel espacé.
- **Lecture éclair** : un e-mail court, deux questions ; repérer l'information sans tout lire.
- **Insérer la phrase** : placer la phrase manquante dans un texte (parties 6 et 7).
- **Écoute et repère** : un court extrait, une question sur l'intention de la phrase.

Chaque mini-exercice est une série de 5 à 10 questions du même type tirées par étiquette : pas de nouveau moteur, des séries filtrées sur la même banque.

### Explications
Chaque question a une explication courte **en français** (pourquoi la bonne réponse, pourquoi le piège). Elle se débloque comme une explication de quiz : gratuite au diagnostic, payante en crédits ensuite (§7).

## 6. Contenu à produire

### Point de départ : une banque de sujets audio existe déjà
Benny (7 octobre) : une bonne banque de sujets, audio compris, existe quelque part et peut être mise dans l'app. Le lot C0 devient donc un travail d'**import et de mise en forme**, pas de fabrication : cela supprime l'essentiel du coût et du délai de production.

Avant l'import, trois contrôles, dans cet ordre :
1. **Provenance et droits** : d'où vient la banque, qui l'a produite, a-t-on le droit de la publier dans une app payante ? Si les sujets reprennent des tests officiels de l'éditeur ou des livres sous licence, c'est un risque juridique sérieux pour une app qui les vend (« TOEIC » est une marque de l'éditeur). Réponse à obtenir de Benny avant tout import.
2. **Conformité au format** : chaque test importé doit avoir 200 questions réparties 6 / 25 / 39 / 30 / 30 / 16 / 54, audio présent pour les parties 1 à 4.
3. **Qualité** : réponse unique, explications. Les explications en français et les étiquettes de compétence manquantes peuvent être générées par modèle de langage puis relues.

L'app dit « préparation au TOEIC » et affiche une mention de non-affiliation, par exemple : « Elearn Prepa n'est pas affilié au propriétaire du TOEIC. Les scores affichés sont des estimations. » Texte exact à valider.

### Chaîne d'import proposée
1. Inventaire de la banque : nombre de tests complets, d'items par partie, formats audio, transcriptions disponibles ou non.
2. Transcodage de l'audio en voix mono à faible débit (de l'ordre de 8 Mo pour un Listening complet de 45 minutes, à mesurer).
3. Import en base : scripts qui remplissent `cert_stimuli`, `cert_items`, `cert_mocks` ; statut `draft`.
4. Complément par modèle de langage : étiquettes de compétence, explications en français, transcriptions manquantes, résumé de piège.
5. **Relecture par échantillon**, puis publication (`reviewed`, `published`).
6. Calibrage de la difficulté après usage : taux de réussite réel par item.
7. Voix de synthèse et génération d'items **seulement** pour combler un manque (une partie sous-représentée) ou renouveler.

### Objectifs de contenu (à ajuster à l'inventaire)
| Élément | Objectif au lancement du lot | Objectif à 6 mois |
| --- | --- | --- |
| Diagnostic | 1 | 2 |
| Tests blancs complets (200 questions) | selon la banque, au moins 3 | selon la banque |
| Items d'entraînement par partie | tirés des tests de la banque, découpés par partie | idem, plus compléments |
| Cartes de vocabulaire des affaires | à produire (600) | 1 500 |
| Explications en français | toutes | toutes |

Poids : l'audio d'un Listening complet de 45 minutes, en voix mono à faible débit, pèse de l'ordre de 8 Mo (estimation à mesurer). Les packs se téléchargent par test et par partie, utilisables sept jours hors ligne comme le reste de l'app.

Coût du lot C0 : faible tant que la banque existante est exploitable (import, relecture, compléments) ; chiffres dans l'annexe privée.

## 7. Modèle de données Supabase (conception, pas de migration)

Rappel de la règle : pas de migration écrite à la main ; on édite `supabase/schemas/*.sql` puis `supabase db diff`, migrations additives, tests pgTAP. Nouveau fichier de schéma proposé : `e_certifications.sql`. Tables préfixées `cert_` pour ne pas toucher aux quiz existants (un item de certification a un énoncé partagé entre plusieurs questions, ce que les quiz ne gèrent pas).

### Référentiel
```
cert_exams        code (text pk, ex. 'toeic_lr'), name, language, active, sort_order,
                  total_questions, duration_minutes, score_min, score_max
cert_sections     id, exam_code, code ('listening','reading'), name, duration_minutes,
                  question_count, can_go_back (bool), audio_plays_once (bool)
cert_parts        id, section_id, number (1..7), name, question_count,
                  presentation text (code du type d'écran, §4), instructions_fr, instructions_audio_url
cert_skills       code (text pk, ex. 'grammaire.temps'), label_fr, parent_code
```

### Contenu
```
cert_stimuli      id, kind ('audio','image','text','audio_image','multi_text'),
                  audio_url, image_url, body (texte ou json de passages), transcript,
                  accent text, duration_seconds
cert_items        id, part_id, stimulus_id (nullable), group_id (uuid : les 3 questions d'un dialogue),
                  position_in_group, prompt, choices jsonb (liste ordonnée de {key,text}),
                  correct_key, explanation_fr, difficulty smallint (1..5),
                  status ('draft','reviewed','published'), reviewed_by, created_at
cert_item_skills  item_id, skill_code
cert_mocks        id, exam_code, kind ('diagnostic','half_listening','half_reading','full'),
                  title, status, published_at, pack_size_bytes
cert_mock_items   mock_id, item_id, position
cert_score_tables id, exam_code, section_code, raw_correct, scaled_low, scaled_high
```
`correct_key` et `explanation_fr` ne sont **jamais** lus directement par l'app : ils sortent par une RPC qui vérifie le droit d'accès (option A du 6 octobre, comme les corrigés payants). Pour un test blanc hors ligne, la clé part avec le pack, dans la même logique que les crédits rejoués de façon idempotente.

### Parcours de l'élève
```
user_cert_goals      user_id, exam_code, target_score, test_date (nullable), baseline_estimated,
                     created_at, active       -- plusieurs objectifs possibles
cert_attempts        id, user_id, mock_id nullable, kind ('diagnostic','drill','mock','review'),
                     started_at, finished_at, duration_seconds, raw_listening, raw_reading,
                     est_listening_low/high, est_reading_low/high, client_uuid (idempotence hors ligne)
cert_attempt_answers attempt_id, item_id, chosen_key, is_correct, time_spent_ms
cert_item_stats      item_id, answered_count, correct_count   -- calibrage, tâche planifiée
```
Plus tard (expression) : `cert_productions` (utilisateur, item, type, fichier, statut, retour IA, coût).

### Profil, droits, crédits : ce qui change dans l'existant
- **Profil** : l'arrivée distingue aujourd'hui `eleve` et `concours`. Ajouter `certification`, de façon additive. Hypothèse de Benny (7 octobre) : les utilisateurs de certification arrivent **uniquement pour la certification**, et on ne compte pas sur des élèves déjà dans l'app qui changeraient de profil. Le profil est donc choisi une fois à l'arrivée ; pas de bascule ni de cumul à construire. Les tables `user_cert_goals` ne servent qu'à ce profil. Conséquence : l'audience certification est à acquérir séparément (écoles, universités, communication ciblée), voir `04`.
- **Droits** : les pass existants (`pass_products`) donnent l'accès illimité aux contenus de certification. Le pass « concours » actuel a une fin de saison fixe (`season_ends_on`) : un pass jusqu'à la date du test demanderait une date par achat (décision 2 du rapport).
- **Crédits** : nouvelles lignes dans `credit_actions`, sans changement de schéma :

| Code (proposé) | Action | Coût initial proposé |
| --- | --- | --- |
| `cert_explanation` | Explication détaillée d'une question | 1 |
| `cert_mock_half` | Demi-test blanc chronométré | 8 |
| `cert_mock_full` | Test blanc complet | 15 |
| `cert_review_pack` | Corrigé complet d'un test blanc | 5 |

Ces nombres ne vont **que** dans `credit_actions` (configuration serveur, réglable au back-office). Avec la recharge hebdomadaire actuelle (25 crédits), un élève gratuit fait un test complet par semaine : le gratuit reste utile, le pass reste désirable. Attention : la contrainte actuelle borne un coût à 100 crédits.
- **Sécurité** : RLS sur toutes les tables `cert_*`, lecture publique limitée au référentiel publié, écriture serveur seule pour tentatives et calibrage, comme `credit_ledger`.

## 8. Impact sur l'app

Principe de Benny : ajuster l'existant, ne pas redessiner. Aucun écran sans maquette ; la liste des maquettes est dans le cahier des charges.

| Zone | Aujourd'hui | Changement |
| --- | --- | --- |
| Arrivée `/bienvenue` | Deux cartes : Élève, Candidat concours | Troisième carte « Certification » (icône Lucide, pas d'emoji) ; lien « J'ai un code de mon école » |
| Après le choix | `/classe` puis `/premier-resultat` | `/certification` (choix de l'examen), `/certification/objectif`, puis diagnostic à la place du mini-test |
| Accueil | Mission du jour, série | Même carte mission, tirée de la banque d'items ; carte « Score estimé et objectif » |
| Réviser | Cours, S'entraîner, Annales | Profil certification : Méthode (fiches de stratégie), Parties (entraînement), Tests blancs (à la place des Annales) |
| Photo | Correction d'un exercice | Garde, utile pour une question de grammaire ; correction d'écrit plus tard |
| Questions | Entraide | Inchangé ; étiquette « Anglais / TOEIC » |
| Moi | Progression, documents, paiements | Courbe du score estimé, mon objectif (pas de changement de profil) |
| Crédits et pass | Feuilles K3, offres | Mêmes feuilles ; nouvelles actions avec leur coût lu du serveur |
| Hors ligne | Préparation limitée au programme | Téléchargement par pack (diagnostic, test, partie), poids en Mo affiché |
| Notifications | Rappel du soir | Rappel et compte à rebours avant la date du test |
| Analytique | Évènements PostHog | Choix de certification, diagnostic fini, test lancé, test fini, score estimé, achat après test |

Risques techniques propres au lot : lecture audio fiable (une lecture, pas de retour), reprise après appel ou coupure, poids des packs, chronomètre exact en arrière-plan, test web des modules natifs audio (AGENTS.md §17).

## 9. Ce que cette étude ne tranche pas
Voir les décisions dans `README.md` : calendrier, pass dédié ou non, mention légale, relecture du contenu, ordre des certifications suivantes.

## Sources
- Format du TOEIC Listening and Reading : [IIBC, format du test](https://www.iibc-global.org/english/toeic/test/lr/about/format.html) et [Global Exam, présentation du TOEIC](https://global-exam.com/blog/en/what-is-the-new-toeic-exam/).
- TOEFL iBT, changements de janvier 2026 : [Fulbright Korea, mises à jour du TOEFL iBT](https://testing.fulbright.or.kr/en/toefl-ibt-changes-jan-2026/).
- Global Exam, fonctionnalités et tarifs : [Global Exam, préparation au TOEIC](https://global-exam.com/blog/fr/preparation-toeic/).
- Application de référence : [Practice for TOEIC Test Pro, App Store](https://apps.apple.com/hn/app/practice-for-toeic-test-pro/id1073535605).
- Prix d'un examen au Sénégal : [Dakar Institute of Technology, formation et examen TOEIC](https://dit.sn/wp-content/uploads/2025/09/Formation-et-Examen-TOEIC-DIT.pdf).
