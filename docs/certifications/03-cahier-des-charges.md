# Cahier des charges : certifications et écoles

Version 0.1 du 7 octobre 2026, à valider par Benny. À intégrer ensuite au cahier des charges général (version 1.13 et suivantes) et à son journal de décisions (section 15) quand Benny a tranché.

Références : `01-etude-certifications.md` (format, données), `02-etude-ecoles.md` (licences), `04-tarifs-et-modele.md` (prix).

## 1. Règles qui s'appliquent à tout le périmètre
- Aucun emoji dans l'interface ni dans les maquettes ; icônes Lucide, carrées.
- Aucun écran sans maquette : voir la liste en §6. Les maquettes ajustent les parcours Figma existants, elles ne les redessinent pas.
- **Tous les montants (crédits, coûts, limites, prix) viennent de la configuration serveur** (`credit_settings`, `credit_actions`, `pass_prices`, réglages de licence). Aucun nombre en dur dans l'app, les textes ou les tests de maquette.
- Prix des pass inchangés : 500 / 2 500 / 7 500 FCFA.
- Migrations additives, schéma édité dans `supabase/schemas/` puis `supabase db diff`, tests pgTAP, PR vers `elearn-supabase` (jamais `main` directement).
- Tests Jest et pgTAP pour toute fonctionnalité ; états de chaque écran (squelette, vide, erreur, hors ligne, succès), clair et sombre, évènements PostHog.
- Contenu : originaux uniquement, aucun sujet officiel copié ; mention de non-affiliation visible.

## 2. Périmètre par lot

| Lot | Contenu | Prérequis |
| --- | --- | --- |
| C0 | Contenu TOEIC : cahier de style, banque de départ (§4.1), chaîne de production, relecture | Aucun code |
| C1 | App : profil Certification, objectif, diagnostic, entraînement par partie, mission du jour, score estimé | C0 (diagnostic et 800 items), lancement de janvier 2027 passé |
| C2 | Tests blancs chronométrés, packs hors ligne, bilan par compétence, plan de révision, crédits des tests | C1 |
| C3 | TOEIC Speaking and Writing : rédaction et enregistrement corrigés par IA | C2, coût IA mesuré |
| C4 | TOEFL iBT puis IELTS (format à relever au moment du lot) | C3 |
| E0 | Écoles en concierge : codes, vue de suivi exportée | Organisation créée à la main |
| E1 | Espace écoles web minimal et licences | E0, cinq entretiens de directeurs |
| E2 | Devoirs, bulletins, factures, import CSV | E1 |

Recommandation de calendrier : rien de ce périmètre ne passe avant les P0 et P1 du lancement de janvier 2027 (paiement pawaPay de bout en bout, mesure PostHog, sécurité). C0 et E0 peuvent démarrer tout de suite : ils ne touchent pas le code.

## 3. Compétences et skills dédiés

« Skills dédiés » est compris ici au sens des **compétences de langue**, chacune avec son module, son type d'exercice et sa métrique :

| Skill | Module | Types d'exercice | Métrique suivie |
| --- | --- | --- | --- |
| Compréhension orale (Listening) | Photo flash, Réponse flash, Écoute et repère, parties 1 à 4 | `audio_photo`, `audio_reponse`, `audio_groupe` | Taux de réussite par partie, pièges |
| Compréhension écrite (Reading) | Mot manquant, Forme du mot, Lecture éclair, Insérer la phrase, parties 5 à 7 | `phrase_blanc`, `texte_blancs`, `passage_simple`, `passage_multiple` | Taux de réussite par étiquette, vitesse |
| Vocabulaire des affaires | Cartes à rappel espacé | cartes | Mots maîtrisés |
| Gestion du temps | Chronomètre des tests blancs | tests blancs | Temps par partie |
| Expression écrite (lot C3) | Rédaction corrigée | `redaction` | Score IA par critère |
| Expression orale (lot C3) | Enregistrement corrigé | `enregistrement` | Score IA par critère |

Si « skills » désigne aussi des **skills d'agent** (instructions réutilisables pour Claude Code), la proposition est d'en créer deux : un skill de génération de contenu TOEIC (cahier de style par partie, contrôle de la répartition, format d'import) et un skill de relecture (grille : réponse unique, niveau, naturel). À confirmer par Benny.

## 4. Exigences fonctionnelles : certifications

Format : identifiant, exigence, critère de réception. M = indispensable au lot, S = souhaitable.

### 4.1 Contenu (lot C0)
- CERT-C0-1 (M) Cahier de style par partie du TOEIC (nombre de questions, thèmes, types de questions, longueur des textes, débit audio). *Réception* : un test blanc généré a 200 questions réparties 6 / 25 / 39 / 30 / 30 / 16 / 54.
- CERT-C0-2 (M) Banque de départ : 1 diagnostic, 3 tests blancs, environ 800 items d'entraînement, 600 cartes de vocabulaire, explications en français partout.
- CERT-C0-3 (M) Relecture humaine de chaque item avant publication (statut `reviewed`).
- CERT-C0-4 (M) Voix : quatre accents, deux voix par dialogue.
- CERT-C0-5 (S) Calibrage de difficulté à partir des réponses réelles.

### 4.2 Arrivée et objectif (lot C1)
- CERT-1 (M) La carte « Certification » apparaît sur l'écran d'arrivée à côté de Élève et Candidat concours. *Réception* : choix mémorisé, retour possible sans le perdre.
- CERT-2 (M) Choix de l'examen dans une liste servie par le serveur (`cert_exams`) ; seul le TOEIC est actif au lot C1.
- CERT-3 (M) Objectif : score visé (paliers servis par le serveur) et date du test facultative ; modifiables dans Moi.
- CERT-4 (M) Un compte peut avoir un profil scolaire et un objectif de certification ; le profil actif se change dans Moi.
- CERT-5 (S) Lien « J'ai un code de mon école » (lot E1).

### 4.3 Diagnostic (lot C1)
- CERT-6 (M) Diagnostic de 20 questions réparties sur les parties, gratuit, jouable sans compte.
- CERT-7 (M) Résultat : score estimé avec fourchette (jamais présenté comme officiel), points faibles classés, plan proposé.
- CERT-8 (M) Résultat sauvegardé à la création du compte, comme le mini-test actuel.

### 4.4 Entraînement et mission (lot C1)
- CERT-9 (M) Entraînement par partie et par étiquette, séries de 10 questions, explication après chaque réponse.
- CERT-10 (M) Mini-exercices du §5 de l'étude, de 2 à 3 minutes.
- CERT-11 (M) Mission du jour : un mini-exercice choisi selon le point faible, 10 minutes au plus, série de jours partagée avec le reste de l'app.
- CERT-12 (M) Sept types de présentation (étude §4), chacun avec ses états.
- CERT-13 (M) Lecteur audio : lecture unique en test, relecture libre en entraînement ; reprise après appel ou coupure.
- CERT-14 (S) Fiches de méthode par partie (stratégies, pièges fréquents), courtes.

### 4.5 Tests blancs (lot C2)
- CERT-15 (M) Demi-test (Listening ou Reading) et test complet de 200 questions, conditions réelles : durées, audio non rejouable et sans retour sur Listening, retour libre sur Reading.
- CERT-16 (M) Chronomètre exact, y compris en arrière-plan ; règles de reprise après interruption à fixer avant le lot (pause autorisée ou non).
- CERT-17 (M) Bilan : score estimé par section et total, fourchette, détail par partie et par compétence, temps par partie, écart à l'objectif.
- CERT-18 (M) Tests hors ligne par pack (diagnostic, test, partie), poids affiché, validité de sept jours, envoi des résultats au retour du réseau de façon idempotente (`client_uuid`).
- CERT-19 (M) Plan de révision : séances réparties jusqu'à la date du test selon l'écart à l'objectif.
- CERT-20 (S) Revoir mes erreurs : série construite avec les questions ratées d'un test.

### 4.6 Droits, crédits et pass
- CERT-21 (M) Le gratuit comprend : diagnostic, séries d'entraînement limitées par jour, explications selon crédits. Limites = réglages serveur.
- CERT-22 (M) Les actions payantes en crédits sont des lignes de `credit_actions` : explication, demi-test, test complet, corrigé complet. Coûts proposés dans l'étude, réglés au back-office.
- CERT-23 (M) Un pass en cours (500 / 2 500 / 7 500 FCFA) rend ces actions illimitées, sans changer les prix.
- CERT-24 (M) Le serveur vérifie le droit avant de servir le corrigé ou la clé d'un test (option A) ; crédits débités de façon idempotente comme aujourd'hui.
- CERT-25 (M) Feuilles de crédits existantes réutilisées (coût sur le bouton, crédits épuisés, recharger) ; aucun nouveau parcours de paiement.
- CERT-26 (S) Décision ouverte : pass dédié « jusqu'à la date du test » (README, décision 2).

### 4.7 Notifications et mesure
- CERT-27 (M) Rappel du soir et compte à rebours avant la date du test, réglables dans les notifications.
- CERT-28 (M) Évènements PostHog : choix de certification, objectif défini, diagnostic fini, test lancé, test fini, score estimé, pack téléchargé, achat après test.

### 4.8 Expression écrite et orale (lot C3, aperçu)
- CERT-29 (M) Rédaction saisie ou photographiée, correction IA par critères, coût en crédits réglé au serveur, plafond quotidien.
- CERT-30 (M) Enregistrement vocal, transcription et correction IA ; fichiers conservés peu de temps, effacés avec le compte.
- Détail à écrire au démarrage du lot C3.

## 5. Exigences fonctionnelles : écoles

### 5.1 Concierge (lot E0)
- ECO-0-1 (M) Création manuelle d'une organisation et d'une licence par Benny ou l'associé, avec code d'invitation de classe.
- ECO-0-2 (M) Vue SQL de suivi par classe, exportée en tableur ; rapport mensuel envoyé à l'école.
- ECO-0-3 (M) Un élève qui rejoint par code reçoit l'accès illimité jusqu'à la fin de la licence (droit de source `school`).

### 5.2 Licences et adhésion (lot E1, app mobile)
- ECO-1 (M) Écran d'adhésion par code ou lien : nom de l'école et de la classe, ce que l'école voit, bouton Rejoindre.
- ECO-2 (M) « Mon école » dans Moi : nom, classe, quitter ; départ = place libérée et accès illimité arrêté.
- ECO-3 (M) Fin de licence : retour au régime gratuit, progression conservée, message clair.
- ECO-4 (M) Plafond d'usage IA propre aux licences, réglage serveur.
- ECO-5 (M) Si toutes les places sont prises, l'élève voit un message qui renvoie vers l'enseignant, pas vers un paiement.

### 5.3 Espace web (lot E1)
- ECO-6 (M) Connexion de l'administrateur et de l'enseignant ; rôles et droits (étude écoles §3).
- ECO-7 (M) Tableau de bord : places, élèves actifs, score moyen estimé.
- ECO-8 (M) Classes : création, renommage, code et lien WhatsApp.
- ECO-9 (M) Liste d'élèves avec dernière activité, série, missions, score estimé ; retrait d'un élève.
- ECO-10 (M) Export CSV.
- ECO-11 (M) RLS prouvée par pgTAP : aucune fuite entre écoles, ni entre classes d'enseignants différents.
- ECO-12 (M) Utilisable sur téléphone (navigateur), léger pour des connexions limitées, textes en français, aucun emoji.

### 5.4 Lot E2 (aperçu)
- ECO-13 (S) Devoirs avec date. ECO-14 (S) Détail d'un élève. ECO-15 (S) Bulletin PDF. ECO-16 (M) Factures, reçus, renouvellement, paiement pawaPay de la licence. ECO-17 (S) Import CSV d'élèves.

## 6. Maquettes à produire avant tout code

Rappel : ajuster les parcours A (arrivée), C (accueil), D (réviser), E (offres), H (profil), pas les redessiner.

**App mobile, certification**
| Réf. | Écran | Parcours à ajuster |
| --- | --- | --- |
| M-C1 | Arrivée avec troisième carte « Certification » | A1 |
| M-C2 | Choix de l'examen | A (même famille) |
| M-C3 | Objectif : score visé et date | A |
| M-C4 | Diagnostic en cours | D (épreuve) |
| M-C5 | Résultat du diagnostic : score estimé, fourchette, points faibles | D6 |
| M-C6 | Accueil d'un profil certification : mission et score estimé | C |
| M-C7 | Réviser, profil certification : Méthode, Parties, Tests blancs | D |
| M-C8 | Les sept types d'exercice (une planche chacun) avec états | D |
| M-C9 | Test blanc : introduction, Listening, transition, Reading, pause, fin | D (épreuve chronométrée, reste sombre) |
| M-C10 | Bilan d'un test blanc : par partie, par compétence, temps | D6 |
| M-C11 | Explication et corrigé d'une question | D (corrigé jaune doux) |
| M-C12 | Feuille de coût d'un test blanc | K3 et voisines |
| M-C13 | Téléchargement des packs hors ligne | hors ligne existant |
| M-C14 | Plan de révision et compte à rebours | C ou H |
| M-C15 | Moi : objectif et changement de profil | H1 |

**App mobile, écoles**
| Réf. | Écran | Parcours à ajuster |
| --- | --- | --- |
| M-E1 | Lien « J'ai un code de mon école » | A1 |
| M-E2 | Adhésion à une école | A |
| M-E3 | Carte « Mon école » dans Moi | H1 |
| M-E4 | Accueil sous licence (accès illimité par l'école) | C |

**Web, espace écoles** : W-E1 connexion, W-E2 tableau de bord, W-E3 classes et codes, W-E4 liste d'élèves, W-E5 détail d'un élève (E2), W-E6 licences et factures (E2).

Le Figma est en plan Starter (20 appels `use_figma` par mois) : maquetter en HTML dans le guide quand le quota est atteint, comme le prévoit `docs/design-regles.md`.

## 7. Exigences non fonctionnelles
- Légèreté : pack de test blanc complet petit (objectif à mesurer, de l'ordre de 8 Mo d'audio) ; aucun téléchargement sans action de l'élève.
- Fiabilité audio : une lecture, pas de saut ; test sur Android d'entrée de gamme.
- Sécurité : clés des tests jamais servies sans vérification de droit ; RLS partout ; revue avant les stores.
- Confidentialité : voir étude écoles §4.
- Accessibilité : cibles de 48 px, textes qui suivent la taille système, transcription disponible après un test (jamais pendant).
- Performance : tirage des items par étiquette sans requête lourde.

## 8. Critères de réception d'un lot
Un lot est fini quand : maquettes validées par Benny ; tests Jest et pgTAP verts (`npm run valider`, `supabase test db`) ; états des écrans couverts ; évènements PostHog posés ; recette de Benny sur téléphone ; rapport de migration remis (quoi, pourquoi, tests, risque, retour arrière).

## 9. Hors périmètre
Entreprises, certifications autres que celles listées, multijoueur, classement public des scores de certification, correction humaine payante.

## 10. Journal des décisions
À remplir quand Benny a répondu aux décisions du `README.md`.
