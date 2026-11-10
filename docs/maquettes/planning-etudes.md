# Planning d'études : plan jusqu'à la date cible (spec, à valider)

Statut : **validée par Benny le 17 octobre 2026.** Côté serveur : migration `20261017120000_planning_etudes` (branche `claude/planning-etudes` d'elearn-supabase). Côté app : à coder. Règles générales : `docs/design-regles.md`. Cette spec suffit pour coder une fois validée.

Principe : l'élève donne le temps qu'il peut consacrer à ses études par jour. Le serveur calcule un planning jusqu'à la date cible de sa classe (examen ou fin de cours). Quand le planning est prêt, l'élève reçoit une notification.

Le planning complète la mission du jour (5 questions) : il ne la remplace pas.

## 1. Entrée dans l'app

- Accueil : une carte « Mon planning » sous le compte à rebours. Elle affiche la semaine en cours (matière du jour et durée), ou « Choisis ton temps par jour » si l'élève n'a pas encore de planning.
- Carte absente si la classe n'a aucune date à venir (même règle que le compte à rebours).
- Invité sans compte : la carte apparaît, mais « Crée ton compte pour garder ton planning » remplace le bouton de saisie.

## 2. Données (contrat avec le serveur)

Saisie : `study_plan_set_time(p_level, p_country, p_minutes)` (RPC ; la classe vient de l'app, comme pour `revision_courses`). Bornes : 15 à 240 minutes, par pas de 15, lues dans `study_plan_settings`. Réservé aux comptes (un invité reçoit l'erreur `42501`).

Lecture : `my_study_plan()` (RPC) renvoie :

```json
{
  "statut": "pret",
  "temps_par_jour": 45,
  "echeance": { "type": "examen", "libelle": "Baccalauréat", "date_cible": "2027-06-23", "statut": "reprise" },
  "jours_restants": 249,
  "semaines": [
    {
      "debut": "2026-10-19",
      "phase": "apprentissage",
      "jours": [
        { "date": "2026-10-19", "matiere": "Mathématiques", "chapitre": "Suites numériques", "minutes": 45, "fait": false }
      ]
    }
  ]
}
```

- `status` : `empty` (pas de temps saisi, ou invité), `preparing` (le serveur calcule), `ready`, `no_target` (aucune date à venir pour la classe). Le JSON réel contient aussi `minutes_per_day`, `target` (`type`, `label`, `date`, `status`), `days_left`, `coverage` (`lessons_total`, `lessons_scheduled`) et `weeks` (`start`, `phase`, `days` avec `day`, `phase`, `minutes`, `items`, `done`).
- `echeance.statut` : `reprise` ou `confirmee`, comme le compte à rebours. Si `reprise`, la date est marquée « · estimé » (même règle que l'accueil).
- `done` : coché par l'élève quand il termine la séance du jour, par `study_plan_mark_done(p_day, p_done)` (idempotent, faux si le jour n'est pas dans le planning). Les jours cochés restent cochés quand le planning est recalculé.
- Un jour porte une liste `items` : des leçons (`kind: lesson`, avec la matière, le cours, la leçon et sa durée), ou `past_papers`, `final_review`, `free_review` (révision libre quand il n'y a plus de leçon à placer).
- Copie locale : le dernier planning reçu est gardé sur l'appareil. Hors ligne, l'écran affiche cette copie avec la mention « Dernière mise à jour : {date} ».

Calcul côté serveur (fonction de base, pgTAP) :
- Jours restants = date cible moins aujourd'hui. Semaines = arrondi supérieur de jours / 7.
- Trois phases, dans l'ordre : apprentissage des chapitres, annales, révisions finales. Répartition validée : 60 %, 25 %, 15 % des jours d'étude.
- Les leçons de la classe sont placées dans l'ordre, une matière après l'autre à tour de rôle, jusqu'à remplir le temps du jour. Les leçons qui ne tiennent pas avant la phase d'annales ne sont pas planifiées : la couverture (`coverage`) le dit. **Reste à faire (étape suivante) : donner plus de temps aux matières où l'élève réussit le moins, d'après ses résultats de quiz.**
- Jours de repos (validés) : 1 ou 2 par semaine (lundi à dimanche), tirés au hasard mais toujours les mêmes pour un même élève et une même semaine, donc le recalcul ne les déplace pas.
- Les paramètres (répartition, bornes, jours d'étude) viennent de la configuration serveur, jamais de l'app.

Recalcul : chaque matin à 5 h (heure de Douala), et à la lecture quand le jour ou la date de la classe a changé. Une date saisie au back-office est donc prise en compte au plus tard le lendemain matin, ou dès que l'élève ouvre son planning. L'élève est prévenu quand la date cible a changé (notification `study_plan_updated`). Le planning reste visible pendant le calcul.

## 3. Écrans

### 3.1 Choisir son temps (état vide)

Du haut vers le bas :
1. Barre d'état système.
2. En-tête : étiquette « MON PLANNING » (`typo.etiquette`, `texte.secondaire`), croix 48 x 48 à droite, retour à l'accueil.
3. Titre `typo.affiche` : « Combien de temps par jour ? »
4. Texte : « Il reste {jours} jours avant le {échéance}. » Si `reprise` : « La date est estimée : le planning s'ajustera à la date officielle. »
5. Sélecteur à cinq choix, en cartes blanches (`fond.surface`, bordure 2, rayon 10, hauteur 64) : 15, 30, 45, 60, 90 minutes. Un choix sélectionné : fond `marque.principale`, texte `#0A0A0A`, coche Lucide `Check` (la couleur ne porte pas seule l'information).
6. Ligne d'aide sous le sélecteur : « 45 min par jour, c'est environ {n} heures d'ici la date. »
7. Bouton principal vert : « Créer mon planning » (hauteur 52, ombre 4). Désactivé tant qu'aucun choix.

Un seul bouton vert par écran.

### 3.2 Planning en préparation

- Même en-tête. Titre : « On prépare ton planning. »
- Squelette de carte (trois blocs gris animés), jamais d'écran blanc.
- Texte : « On te prévient dès qu'il est prêt. Tu peux quitter cette page. »
- Pas de bouton vert. Bouton texte « Fermer ».

### 3.3 Planning prêt

- En-tête : « MON PLANNING », croix.
- Titre `typo.affiche` : « Semaine {n} sur {total} » puis la phase en sur-titre (« Apprentissage », « Annales », « Révisions finales »).
- Bloc hero émeraude : « {minutes} min aujourd'hui » et la matière du jour, texte noir.
- Bouton principal vert : « Commencer la séance » (ouvre le chapitre du jour).
- Liste « CETTE SEMAINE » : une carte blanche par jour (hauteur 78, titre sur deux lignes au plus) : matière, chapitre, durée, case à cocher (48 x 48). Jour passé non fait : étiquette « Pas fait » en texte, sans jugement.
- Bouton texte en bas : « Changer mon temps par jour » (reconduit à 3.1).

### 3.4 Notification

- Titre : « Ton planning est prêt ».
- Corps : « Ton planning jusqu'au {échéance} est prêt. » (« estimé » si `reprise`).
- Toucher : ouvre 3.3. Type de notification : `planning_pret`, catégorie « rappels ». Préférence désactivable dans les réglages.

### 3.5 Erreur et hors ligne

- Erreur de calcul : « Le planning n'a pas pu être créé. » + bouton « Réessayer » (secondaire). Message clair, pas d'échec silencieux (règle hors ligne, AGENTS.md section 16).
- Hors ligne : copie locale, mention « Dernière mise à jour : {date} », pas de changement de temps par jour (bouton désactivé). La coche de séance, elle, devient possible hors ligne en écriture différée : voir l'itération du 22 octobre 2026, section 8.

### 3.6 Sans échéance

- Titre : « Pas encore de date pour ta classe. » Texte : « Ton planning se créera dès que la date de ton examen ou de la fin de cours sera connue. »
- Pas de bouton.

## 4. Thèmes et accessibilité

- Clair et sombre, tous les états. Jetons `theme.color.*` seulement.
- Texte noir sur les couleurs vives (émeraude, bleu, orange, soleil). Cibles tactiles 48 px minimum, espacées de 8 px.
- La couleur ne porte jamais seule une information (coche + libellé).
- Pas d'emojis, icônes Lucide (`Check`, `X`, `RotateCw`).

## 5. Décisions de Benny (17 octobre 2026)

1. Répartition 60 / 25 / 15 % et pondération par résultats de quiz : validées. La pondération par quiz est à coder dans une étape suivante.
2. Jours de repos : 1 ou 2 par semaine, au hasard.
3. Planning gratuit, sans crédits.
4. Invité : carte visible, saisie réservée aux comptes.
5. Notification quand le planning est prêt, et aussi quand il change après une date officielle.
6. « Refaire mes erreurs » dans le récap : règle de crédits inchangée, à confirmer côté dev.

## 6. Tests à écrire (avant de coder l'écran)

- Base (pgTAP) : calcul des semaines et des phases, bornes du temps par jour, recalcul après une date officielle, RLS (un élève ne lit que son planning).
- App (Jest) : chaque état (vide, préparation, prêt, erreur, hors ligne, sans échéance), clair et sombre, copie locale, libellé « estimé ».

## 7. Itération du 18 octobre 2026 (retours de Benny sur la première version)

Fait dans l'app (aucune migration) :
- **En-tête** : le titre « MON PLANNING » prend la place restante, la croix est à droite. À côté de la croix, un bouton **Ajuster** (icône curseurs) rouvre le choix du temps par jour, avec le temps actuel déjà sélectionné. Absent hors ligne.
- **Séance du jour (accueil du planning)** : « Aujourd'hui », nombre de tâches et durée, trois premières tâches avec leur case, avancement « 1 sur 2 faits », bouton **Ouvrir la séance**. Jour de repos : le message et un bouton **Voir la prochaine séance**. Séance faite : « Séance du jour faite » et **Voir la séance**.
- **Page d'une séance** (`/planning/jour?jour=AAAA-MM-JJ`) : le jour en toutes lettres, la phase et la durée, l'avancement, toutes les tâches ; chaque tâche s'ouvre (la leçon elle-même, sinon l'onglet Réviser). Bouton **J'ai terminé ma séance** en bas ; une fois terminée : « Séance terminée. Bravo ! », « Marquer comme non faite » (si cochée à la main), retour au planning. Hors ligne : lecture seule.
- **Suivi automatique** : une leçon déjà validée (dans le planning ou à la main dans Réviser) compte comme faite. Une séance composée uniquement de leçons toutes validées se coche toute seule. Les tâches qui ne sont pas des leçons (annales, révisions) se terminent avec le bouton de la séance.
- **Navigation** : flèches semaine précédente et suivante avec les dates (« 26 oct. – 1 nov. ») et la phase ; toucher un jour ouvre sa page.
- **Jours avant le début ou après la fin du planning** : « — » (accessible : « Hors planning »), plus jamais « Jour de repos ». Un vrai repos au milieu du planning reste « Jour de repos ».
- **Carte de l'accueil** : « Aujourd'hui : 2 tâches · 45 min », avec l'avancement quand une leçon est déjà validée.

- **Série du lycée (migration `20261018120000_series_programme`)** : quand la classe a plusieurs séries pour le pays (`2nde`, `1re`, `Tle`), l'élève choisit sa série dans `ChoixClasse` (`class_series`). Ce choix filtre les cours (`revision_courses`), la mission du jour (`daily_mission`, `daily_mission_lessons`, `daily_mission_sized`), les dossiers d'annales (`class_document_folders`) et le planning d'études (`study_plan_set_time`). Changer de classe, de pays ou de série recalcule le planning s'il existe déjà.

Reste à faire (à décider avec Benny) :
1. **Exercices et annales réels** : aujourd'hui une journée d'annales ou de révision finale est une tâche générique. À remplacer par de vrais sujets d'annales et des exercices du chapitre, par une évolution du calcul serveur.
2. **Suivi côté serveur** : la séance cochée par les leçons validées est envoyée au serveur à l'ouverture de la page de la séance ; le calcul serveur ne sait pas encore ignorer les leçons déjà validées à la création du planning.

## 8. Itération du 22 octobre 2026 (issue #74, lot A) : cocher une séance hors ligne — validée par Benny le 22 octobre 2026

La section 3.5 et l'itération du 18 octobre disaient « hors ligne : lecture seule » : la page d'une séance gardait « J'ai terminé ma séance » et « Marquer comme non faite » désactivés sans réseau. L'issue #74 demande la synchronisation des actions faites hors ligne ; cette itération remplace la lecture seule par une écriture différée, pour la coche de séance uniquement.

- **Cocher et décocher hors ligne** : sur la page d'une séance lue depuis la copie locale, les deux boutons sont actifs. La coche est appliquée tout de suite à la copie affichée et gardée sur l'appareil, dans une file par utilisateur qui ne contient que le jour, l'état (faite ou non) et la date d'enregistrement — aucun contenu, aucun montant.
- **Rejeu au retour du réseau** : la file est vidée dès que le planning est lu avec une connexion, et aux mêmes moments que la synchronisation des entraînements (ouverture de session, reprise de l'application). Chaque coche est rejouée par le RPC existant `study_plan_mark_done`, qui est idempotent : un rejeu répété ne change rien.
- **Conflits** : si l'élève coche puis décoche le même jour hors ligne, seul le dernier état est gardé et rejoué. Si le serveur ne connaît plus le jour au moment du rejeu (planning recalculé entre-temps), la coche en attente est abandonnée et le planning relu fait foi — la règle de la section 6 continue de s'appliquer (les jours cochés **côté serveur** survivent au recalcul).
- **La coche automatique suit la même voie** : une séance dont toutes les tâches sont déjà validées se coche aussi hors ligne, par la même file.
- **Texte affiché** : en mode copie, sous les tâches de la page séance : « Tu es hors ligne : ta séance est gardée sur l'appareil, elle sera synchronisée au retour du réseau. » Ni promesse de délai, ni vocabulaire technique.
- **Ce qui ne change pas hors ligne** : créer un planning, changer le temps par jour ou un réglage du planning restent impossibles sans réseau (boutons désactivés, sections 3.2 et 3.5), et la consultation reste la copie locale avec sa mention « Dernière mise à jour ».
- **Échec de rejeu** : si le réseau coupe pendant le rejeu, les coches non encore envoyées restent dans la file et repartiront au prochain essai ; rien n'est perdu et rien n'est annoncé comme synchronisé tant que le serveur n'a pas répondu.

Tests : la file, le rejeu et les conflits sont couverts par des tests unitaires du service planning (dates figées) ; la page séance couvre le cas « hors ligne avec copie : la séance se termine et part dans la file ».

