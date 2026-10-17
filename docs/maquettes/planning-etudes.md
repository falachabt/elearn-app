# Planning d'études : plan jusqu'à la date cible (spec, à valider)

Statut : **proposition à valider par Benny avant tout code.** Aucun écran ne se code sans cette validation. Règles générales : `docs/design-regles.md`. Cette spec suffit pour coder une fois validée.

Principe : l'élève donne le temps qu'il peut consacrer à ses études par jour. Le serveur calcule un planning jusqu'à la date cible de sa classe (examen ou fin de cours). Quand le planning est prêt, l'élève reçoit une notification.

Le planning complète la mission du jour (5 questions) : il ne la remplace pas.

## 1. Entrée dans l'app

- Accueil : une carte « Mon planning » sous le compte à rebours. Elle affiche la semaine en cours (matière du jour et durée), ou « Choisis ton temps par jour » si l'élève n'a pas encore de planning.
- Carte absente si la classe n'a aucune date à venir (même règle que le compte à rebours).
- Invité sans compte : la carte apparaît, mais « Crée ton compte pour garder ton planning » remplace le bouton de saisie.

## 2. Données (contrat avec le serveur)

Saisie : `definir_temps_etude(minutes_par_jour)` (RPC, une valeur entière). Bornes : 15 à 240 minutes, par pas de 15.

Lecture : `mon_planning()` (RPC) renvoie :

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

- `statut` : `vide` (pas de temps saisi), `en_preparation` (le serveur calcule), `pret`, `sans_echeance` (aucune date à venir pour la classe).
- `echeance.statut` : `reprise` ou `confirmee`, comme le compte à rebours. Si `reprise`, la date est marquée « · estimé » (même règle que l'accueil).
- `fait` : coché par l'élève quand il termine la séance du jour (écriture à part, idempotente).
- Copie locale : le dernier planning reçu est gardé sur l'appareil. Hors ligne, l'écran affiche cette copie avec la mention « Dernière mise à jour : {date} ».

Calcul côté serveur (fonction de base, pgTAP) :
- Jours restants = date cible moins aujourd'hui. Semaines = arrondi supérieur de jours / 7.
- Trois phases, dans l'ordre : apprentissage des chapitres, annales, révisions finales. Répartition proposée : 60 %, 25 %, 15 % du temps total. **À valider.**
- Les chapitres d'une matière sont répartis selon le temps total de la matière ; les matières où l'élève réussit le moins reçoivent plus de temps (résultats de quiz). **Pondération à valider.**
- Les paramètres (répartition, bornes, jours d'étude) viennent de la configuration serveur, jamais de l'app.

Recalcul : une date saisie au back-office (officielle, ou une nouvelle année) relance le calcul de tous les plannings de la classe. Le planning reste visible pendant le calcul.

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
- Hors ligne : copie locale, mention « Dernière mise à jour : {date} », pas de changement de temps par jour (bouton désactivé).

### 3.6 Sans échéance

- Titre : « Pas encore de date pour ta classe. » Texte : « Ton planning se créera dès que la date de ton examen ou de la fin de cours sera connue. »
- Pas de bouton.

## 4. Thèmes et accessibilité

- Clair et sombre, tous les états. Jetons `theme.color.*` seulement.
- Texte noir sur les couleurs vives (émeraude, bleu, orange, soleil). Cibles tactiles 48 px minimum, espacées de 8 px.
- La couleur ne porte jamais seule une information (coche + libellé).
- Pas d'emojis, icônes Lucide (`Check`, `X`, `RotateCw`).

## 5. Ce que la spec ne tranche pas (à valider)

1. **Répartition** 60 / 25 / 15 % et pondération par résultats : OK ?
2. **Jours d'étude** : tous les 7 jours, ou repos le dimanche ?
3. **Gratuité** : le planning est-il gratuit (sans crédits) ? Hypothèse retenue : oui.
4. **Invité** : carte visible mais saisie réservée aux comptes. OK ?
5. **Notification** : « planning prêt » seulement, ou aussi un rappel quand le planning change après une date officielle ?
6. **« Refaire mes erreurs »** dans le récap : même règle de crédits que l'écran de résultats, à confirmer côté dev.

## 6. Tests à écrire (avant de coder l'écran)

- Base (pgTAP) : calcul des semaines et des phases, bornes du temps par jour, recalcul après une date officielle, RLS (un élève ne lit que son planning).
- App (Jest) : chaque état (vide, préparation, prêt, erreur, hors ligne, sans échéance), clair et sombre, copie locale, libellé « estimé ».
