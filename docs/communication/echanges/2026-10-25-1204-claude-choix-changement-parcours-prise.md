# Choix et changement de parcours — inventaire de l'existant (prise)

Date : 25 octobre 2026, 12:04 UTC. Auteur : Muse.
Demande de Benny : voir sur la maquette **toutes les pages de choix ou de changement de parcours** de l'app,
depuis l'onboarding jusqu'aux réglages — la page Moi et le chip sur l'accueil compris.
Livrable : inventaire ci-dessous + parcours « Choix et changement de parcours » ajouté à la planche vivante
`~/workspace/maquettes-a4-79/maquette-parcours-a4.html`. Aucune implémentation.

Les trois parcours : Secondaire (profil `eleve`), Concours (profil `concours`), Certification (profil
`certification`, examen TOEIC). Le profil est gardé sur le téléphone (`src/services/profil.ts`, clé
`profil.arrivee`) ; aucun compte n'est demandé pour le choisir.

## 1. Onboarding (groupe de routes `(accueil)`, parcours A)

### A1 · Bienvenue — route `/bienvenue`, composant `Bienvenue` (`src/components/ParcoursArrivee.tsx`)
- Logo horizontal, titre « Bloqué sur un exo ? On t'explique chaque étape. », carte jaune d'exemple
  (« Exemple » / « 2x + 3 = 11 » / « On retire 3 des deux côtés : 2x = 8, donc x = 4. »).
- Question « Choisis ton profil » puis trois grandes cartes de choix (icône, titre, aide, chevron) :
  - « Je suis élève » / « De la 6e à la Terminale » → `/classe?type=eleve` ;
  - « Je prépare un concours » / « ENS, médecine, écoles d'ingénieurs… » → `/classe?type=concours` ;
  - « Je prépare une certification » / « TOEIC, puis d'autres examens » (visuel `LogoToeic`, aujourd'hui
    l'icône générique `Award`, le logo officiel n'étant pas livré) → `/certification`.
    **Cette troisième carte n'apparaît que si le drapeau PostHog `cert_profile_enabled` est actif.**
- Bouton texte « J'ai déjà un compte » → `/compte/connexion`.

### A2 · Classe et pays — route `/classe`, composant `ChoixClasse` (même fichier)
Étapes numérotées, bouton pied « Continuer » :
1. « Ta classe » : pastilles 6e, 5e, 4e, 3e, 2nde, 1re, Tle ; si la classe a plusieurs séries, bloc
   « Ta série » (pastilles). En mode concours : « Ton concours » — carte « Mon concours » (sigle · ville,
   ou « Pas encore choisi ») avec bouton « Changer » → écran Concours ci-dessous.
2. « Ton pays » : drapeau, nom du pays, bouton « Changer » → feuille du bas `FeuillePays`.
3. « La langue que tu veux pour l'application » : pastilles Français / English (onboarding seulement).
Continuer enregistre le profil (`termine: false`) puis → `/premier-resultat` ; en concours sans concours
choisi, passage d'abord par l'écran Concours.

### Écran Concours — route `/concours`, composant `ChoixConcours` (`src/components/concours/`)
Deux étapes (« 1 / 2 », « 2 / 2 ») : 1. « Quelle filière vises-tu ? » (liste des filières du serveur) →
2. « Quel concours ? » : champ « Chercher une école ou une ville », liste des concours de la filière,
aide « Ton programme et tes annales suivent ce concours. Tu peux changer quand tu veux. », bouton
« Choisir {sigle} ». Le choix est écrit dans le profil ; retour à l'écran Classe pour le pays.

### Branche certification — route `/certification`, composant `ChoixCertification` (`src/components/certification/`)
- En-tête « Certification », titre « Quelle certification prépares-tu ? ».
- Une ligne de choix par examen (aujourd'hui le seul : TOEIC, visuel `LogoToeic`), aide
  « {sous-titre} · {durée} · {n} questions » (données serveur `cert_exams`).
- Encadré pointillé « D'autres certifications à venir. » (`EncadrePointille`, ajouté par l'issue #77).
- « Ton pays » : sélecteur (drapeau + nom) → feuille du bas `FeuillePays`.
- Pied : « Continuer » + mention « TOEIC est une marque d'ETS. Elearn Prépa n'est pas affilié à ETS. »
- La branche continue ensuite dans l'arrivée TOEIC (objectif, temps par jour, diagnostic) : déjà couverte
  par le parcours « Première arrivée A1 → A7 » de la même planche.

### A3 · Premier résultat — route `/premier-resultat`
« Par quoi on commence ? » : carte verte « Prends un exercice en photo », carte jaune « Fais le mini-test »,
lien « Explorer sans commencer ». Porte de sortie de l'onboarding élève/concours (le profil passe
`termine: true`) — ce n'est pas une page de choix de parcours.

## 2. Page « Moi » (`src/components/EcranMoi.tsx`, onglet Moi)

Même composant pour les trois parcours (prop `toeic` pour la variante certification) :
- En-tête : avatar de niveau, nom, sous-titre « {classe} · {pays} », roue Paramètres.
- Carte XP (ou progression TOEIC), puis carte Pass jaune / carte « Mes crédits » / carte invité.
- Groupe 1 : Progression, Rapport hebdo (connecté), Mes documents, Parrainage, Mes paiements (connecté).
- Groupe 2 : **ligne « Mon profil »** (icône `RefreshCw`) — c'est **le** point d'entrée du changement :
  - élève/concours : sous-titre « {Secondaire|Concours} · {classe ou filière} · changer »
    (clé `profilChoix.monProfilSous`) ;
  - TOEIC : sous-titre « TOEIC · changer de profil » (`certification.moiToeic.monProfilAide`).
  Au toucher → navigation vers `/profil/choisir`.
  Suivent : Parent (connecté), Mon identifiant (connecté), Aide et FAQ.
- En TOEIC, groupe supplémentaire : Mon objectif, Temps par jour, Paramètres TOEIC, Se déconnecter
  (avec feuille de confirmation).

## 3. Le changement depuis Moi — page P2 « Mon profil » (route `/profil/choisir`, `ChoisirProfil`)

- En-tête avec retour : « Mon profil ». Intro : « Choisis ton profil. Tu peux changer à tout moment
  depuis Moi. »
- Trois lignes radio : « Secondaire » / « De la 6e à la terminale » ; « Concours » / titre affiché
  « Candidat à un concours », aide « Filière, concours et annales » ; « Je prépare une certification » /
  « TOEIC, puis d'autres examens ». Le profil actuel porte la mention « Actuel » et est pré-coché.
  Pied : « Continuer ».
- **Vers le TOEIC** : feuille de confirmation P4 posée sur la page (fond voilé) — titre
  « Passer au profil TOEIC ? », ligne TOEIC (« TOEIC » / « Le seul examen disponible pour l'instant »),
  boutons « Passer au TOEIC » / « Annuler ». Confirmation → `passerAuToeic()` puis retour à l'accueil
  (`dismissAll` + `replace('/')`).
- **Depuis le TOEIC vers Secondaire ou Concours** : feuille P5 — titre « Revenir au secondaire ? »,
  bouton « Revenir au secondaire », « Annuler ». Si Secondaire : `revenirAuSecondaire()` rétablit le
  profil secondaire mémorisé (sans ressaisie) ; sans mémoire, ou si Concours : enchaînement sur
  `/classe?modifier=1`.
- **Secondaire ↔ Concours (et ajustement dans la même famille)** : « Continuer » ouvre directement
  `/classe?modifier=1` (voir §4), sans feuille de confirmation.
- États de la feuille (`FeuilleChangementProfil`) : chargement (« Changement de profil » / « Un instant,
  ton accueil se prépare. » / bouton désactivé « Patiente un instant ») ; erreur (« Changement
  impossible » / « Ton profil n'a pas changé. Vérifie ta connexion, puis réessaie. Tes données ne sont
  pas modifiées. » / « Réessayer » + « Rester sur mon profil actuel »).
- Mémoire des profils (`src/services/changementProfil.ts`, clé `profil.memoire`) : le dernier profil de
  chaque famille (secondaire/concours d'un côté, TOEIC de l'autre) est conservé ; la bascule ne fait que
  permuter, **aucune donnée d'élève n'est effacée**.
- Conséquences du changement : l'accueil, les onglets, la mission du jour (cache invalidé), le planning
  (recalculé côté serveur), les contenus et les annales suivent le nouveau profil ; événement analytics
  `profile_class_changed`.

## 4. L'écran Classe en mode modification (route `/classe?modifier=1`, `ChoixClasse`)

- Ouvert depuis Moi (via P2) **et** depuis le chip de l'accueil (§5), pré-rempli avec le profil actuel.
- En haut, pastilles de statut « Je suis élève » / « Je prépare un concours » (bascule de famille dans la
  même page) ; pas d'étape langue ; pied : « Enregistrer ».
- Rien n'a changé → retour sans écriture. Sinon : profil enregistré, cache de la mission du jour supprimé,
  planning recalculé, retour à l'accueil du nouveau profil.
- **Hors ligne, le changement est bloqué** (issue #74) : feuille du bas « Tu es hors ligne » —
  « Changer de classe ou de programme demande une connexion : ton planning d'études et tes contenus
  téléchargés sont recalculés pour la nouvelle classe. Sans connexion, rien ne change pour l'instant. »
  + « J'ai compris ». Aucune écriture partielle.

## 5. Le chip sur l'accueil

### Accueil élève/concours (`src/components/mission/Accueil.tsx`, `SelecteurClasse`)
- En-tête de l'accueil, à gauche : pastille bordée (fond surface, bordure forte, rayon 8) avec icône
  (`GraduationCap` en élève, `Trophy` en concours), **libellé court** et `ChevronDown` :
  - élève : la classe seule, avec la série courte si elle ajoute quelque chose (« 3e », « Tle ACD ») —
    **sans le pays** ;
  - concours : le sigle seul (« ENS », « Médecine », « Ingénieurs » ou le sigle du concours choisi).
- À sa droite dans l'en-tête : pastille série (flamme, si série > 0), compteur de crédits, cloche, avatar
  (→ Moi).
- **Au toucher : navigation directe** vers `/classe?modifier=1` (libellé accessibilité « Classe ou
  programme : {libellé}. Appuyer pour changer. »). Pas de menu, pas de feuille, pas de confirmation à ce
  niveau. Le chip change donc la classe/le programme **dans la famille actuelle** ; il ne propose pas la
  certification.

### Accueil TOEIC (`src/components/certification/AccueilToeic.tsx`)
- En-tête `EnteteToeic` : titre « Accueil », à droite cloche + compteur de crédits.
- **Aucun chip de parcours, aucun avatar** : rien, sur cet accueil, ne montre le parcours autrement que
  par le contenu, et rien ne permet d'en changer. Le seul chemin est l'onglet Moi → « Mon profil ».

### Barre d'onglets (contexte)
- Élève/concours : Accueil, Réviser, Photo (bouton central), Questions, Moi.
- TOEIC : Accueil, Réviser, Tests (bouton central), Statistiques, Moi — **masquée tant que le diagnostic
  n'est pas fait** (issue #121).

## 6. Ce qui n'existe pas / points relevés (montrés tels quels dans la maquette)

1. **Pas de chip de parcours sur l'accueil TOEIC** (asymétrie avec l'accueil élève/concours).
2. **Le chip de l'accueil élève/concours ne permet pas de basculer vers la certification** : il ouvre le
   changement de classe/programme ; la bascule de famille passe par Moi → « Mon profil ».
3. **Écran `/profil/certification` orphelin** (`src/app/profil/certification.tsx`,
   `ChoisirCertification`) : carte plein écran reprenant la confirmation TOEIC **avec le texte de
   conséquences complet** (« L'accueil, Réviser, Tests et Statistiques changent. Ton profil secondaire
   reste enregistré : tu pourras y revenir depuis Moi. », clé `profilChoix.passerToeicTexte`) — mais
   **aucun écran ne navigue vers cette route** (le seul référencement est un test qui vérifie qu'on n'y
   pousse pas). Conséquence : dans le flux réel, la feuille P4 de la page « Mon profil » n'affiche **pas**
   ce texte de conséquences ; elle ne montre que le titre et la ligne TOEIC.
4. **Feuille P5 mal étiquetée quand Concours est choisi** : le titre reste « Revenir au secondaire ? » et
   le bouton « Revenir au secondaire » même si l'utilisateur a coché Concours (les clés
   `profilChoix.revenirTitre` / `revenirBouton` sont uniques) ; après confirmation, l'écran Classe en mode
   modification prend le relais pour le concours.
5. **Carte certification de Bienvenue conditionnée** au drapeau PostHog `cert_profile_enabled` : drapeau
   éteint, l'onboarding ne propose que deux parcours.

## 7. Maquette

Parcours « Choix et changement de parcours » ajouté à la planche vivante
`~/workspace/maquettes-a4-79/maquette-parcours-a4.html` (rangée claire puis rangée sombre, écrans à
l'horizontale) : 1 Bienvenue · 2 Classe et pays (élève) · 3 Concours (étape 2) · 4 Certification (A2) ·
5 Moi (ligne « Mon profil ») · 6 Mon profil (P2) · 7 Feuille P4 « Passer au profil TOEIC ? » ·
8 Feuille P5 « Revenir au secondaire ? » · 9 Classe en modification (concours) · 10 Accueil élève (chip
classe) · 11 Accueil concours (chip sigle) · 12 Accueil TOEIC (sans chip). Aperçu :
`~/workspace/maquettes-a4-79/maquette-parcours-choix-apercu.png`.

Aucun commit : l'agent de l'issue #77 travaille en parallèle dans ce worktree ; ce fichier d'échange et la
ligne EN-COURS ne sont pas ajoutés à git ici.
