# Ma semaine : mini récap hebdomadaire (spec complète)

Maquette validée par Benny le 07/10/2026. Aperçu visuel : `docs/maquettes/ma-semaine.html` (à ouvrir dans un navigateur, les téléphones se font défiler vers la droite ; même contenu sur https://claude.ai/artifact/EuoB9nsZKrygShryzdN6Tj). Règles générales : `docs/design-regles.md`. Cette spec suffit pour coder sans ouvrir l'aperçu.

Principe : une page plein écran de 4 cartes, façon récap de fin d'année en version mini, qui résume la semaine passée (lundi à dimanche). Elle s'ouvre seule la première fois de la semaine où l'élève ouvre l'app, et on y accède aussi par le push du lundi ou par le centre de notifications.

## 1. Données

Une ligne par élève et par semaine, calculée côté serveur (fonction du résumé, PR serveur #47, migration 20261007102000, à fusionner après #43).

```json
{
  "semaine": "2026-09-28",
  "missions": 5,
  "missions_par_jour": [1,1,0,1,1,1,0],
  "lecons_validees": 14,
  "quiz_termines": 6,
  "exercices_faits": 9,
  "questions_ratees": 12,
  "credits_utilises": 38,
  "pass_actif": false,
  "solde": 27,
  "recharge_lundi": 25
}
```

- `semaine` = date du lundi (AAAA-MM-JJ). Semaine = lundi 00 h 00 à dimanche 23 h 59, heure locale de l'appareil.
- `missions_par_jour` : facultatif, lundi à dimanche. S'il manque, la carte 1 n'affiche pas la grille des 7 jours.
- `solde` et `recharge_lundi` : valeurs lues dans la configuration serveur (M18-12), jamais en dur.
- Copie locale : la dernière réponse reçue est gardée sur l'appareil (pour l'état hors ligne).

### Activité et cartes à zéro
- Le récap n'existe pour l'élève que s'il y a eu de l'activité : au moins une mission faite, une leçon validée, un quiz terminé ou un exercice fait. Les crédits seuls ne suffisent pas.
- Une carte dont la valeur principale est 0 est sautée (carte 3 si `questions_ratees` = 0, carte 4 si `credits_utilises` = 0 et pas de Pass). Il reste toujours au moins une carte. Les segments en haut comptent les cartes affichées.
- Carte 2 : chaque ligne à 0 est masquée ; si les trois sont à 0, la carte est sautée.
- Carte 1 : toujours affichée tant qu'il y a de l'activité ; avec 0 mission elle affiche « Tu as avancé. » et le nombre 0 reste visible.
- Invité sans compte : pas de récap (les chiffres viennent du serveur). Décision à confirmer avec Benny.

## 2. Structure d'un écran (360 x 780 de référence, thèmes clair et sombre)

Du haut vers le bas :
1. Barre d'état système.
2. **Segments de progression** : une barre par carte affichée (hauteur 8, bordure 2, rayon 6, espacement 6, marges 16). Cartes passées : `texte.principal` ; carte courante : `marque.principale` ; futures : `fond.creux`.
3. **En-tête** : étiquette « MA SEMAINE » (`typo.etiquette`, `texte.secondaire`) à gauche, bouton croix 48 x 48 à droite (bordure 2 `bord.fort`, rayon 10, fond `fond.surface`, icône Lucide `X`). La croix ferme la page à tout moment.
4. **Corps** (marges 16, espace 14) : sur-titre en mono capitales (`typo.etiquette`), titre `typo.affiche` en 32 (Archivo Black), puis un ou plusieurs blocs.
5. **Pied** : boutons empilés (espace 10, marges 12 / 16 / 22).

Bloc coloré « hero » : fond couleur, bordure 2 `bord.fort`, rayon 14, ombre dure 4 (`ombre.m`, noire), texte toujours `#0A0A0A` (`texte.surCouleur`). Grand nombre en Archivo Black 88 (carte 1 et 3) ou 56 (lignes de la carte 2), libellé Space Grotesk Bold 18 à 19.
Bloc blanc « card » : fond `fond.surface`, bordure 2 `bord.fort`, rayon 14, ombre 3 (`ombre.carte`), étiquette mono en `texte.secondaire`.
Boutons : hauteur 52, bordure 2, rayon 10, `typo.bouton`. Principal = `marque.principale`, texte `#0A0A0A`, ombre 4. Secondaire = `fond.surface` avec texte `texte.principal`. Texte seul (« Fermer ») = souligné, hauteur 44. Un seul bouton vert par écran.
Couleurs de fond des blocs (identiques dans les deux thèmes, texte noir dessus) : émeraude `marque.principale` (`palette.emeraude[500]` en clair, `[400]` en sombre), bleu `typeContenu.quiz` (`palette.bleu[400]`), orange `typeContenu.exercice` (`palette.orange[400]`), soleil `accent.soleil` (`palette.soleil[400]`).

## 3. Les 4 cartes et leur contenu exact

Textes en tutoiement, espace insécable avant `?` `!` `:`. Les valeurs entre accolades viennent des données ; le pluriel s'accorde.

### Carte 1 : missions (hero vert)
- Sur-titre : « Semaine du 28 sept. au 4 oct. » (dates de la semaine, formatées dans la langue de l'app).
- Titre selon `missions` : 7 « Semaine pleine. » ; 4 à 6 « Belle régularité. » ; 1 à 3 « Un bon début. » ; 0 (leçons, quiz ou exercices seulement) « Tu as avancé. »
- Hero émeraude : nombre `{missions}` et libellé « missions faites cette semaine » (singulier : « mission faite cette semaine »).
- Carte blanche « TES JOURS » : 7 cases L M M J V S D (case 40 max, bordure 2). Jour fait : fond `marque.principale`, bordure `bord.fort`, coche Lucide `Check` (la couleur ne porte pas seule l'information). Jour non fait : fond `fond.creux`, bordure `bord.doux`.
- Texte : « {n} jour(s) sur 7 : la régularité fait progresser plus que les grosses séances. » (n = nombre de jours faits ; si `missions_par_jour` manque, la carte blanche et ce texte sont masqués).
- Bouton : « Suivant » vert avec flèche.

### Carte 2 : ce que tu as appris (vert, bleu, orange)
- Sur-titre : « Ce que tu as appris ». Titre : « Tu avances. »
- Trois lignes hero (nombre 56 à gauche, libellé à droite) : vert `{lecons_validees}` « leçons validées » ; bleu `{quiz_termines}` « quiz terminés » ; orange `{exercices_faits}` « exercices faits ». Une ligne à 0 est masquée.
- Texte : « Chaque leçon validée et chaque exercice terminé reste dans ta progression. »
- Bouton : « Suivant » vert avec flèche.

### Carte 3 : à rattraper (hero orange)
- Sur-titre : « À rattraper ». Titre : « Quelques points à revoir. »
- Hero orange : `{questions_ratees}` « questions ratées cette semaine » (singulier : « question ratée cette semaine »).
- Carte blanche « LE BON RÉFLEXE » : « Refaire une erreur aide plus à retenir que relire la leçon. Cinq minutes suffisent pour commencer. »
- Boutons : « Refaire mes erreurs » (vert, icône Lucide `RotateCw`), puis « Suivant » (blanc).
- « Refaire mes erreurs » ouvre le même parcours que le bouton du même nom de l'écran de résultats d'un quiz, avec ses règles de crédits (à confirmer côté dev).

### Carte 4 : crédits (hero jaune)
- Sur-titre : « Tes crédits ». Titre : « À lundi. » (avec Pass : « Tout est ouvert. »)
- Sans Pass : hero soleil `{credits_utilises}` « crédits utilisés cette semaine ». Avec Pass actif : hero soleil « Crédits illimités » (Archivo Black 52) et libellé « avec ton Pass ».
- Carte blanche « POUR LA SUITE » : sans Pass « Il te reste **{solde} crédits**. Lundi, tu recevras **{recharge_lundi} crédits** de recharge. » ; avec Pass « Ton Pass couvre explications, corrigés et annales. Pose toutes tes questions. »
- Boutons : « Aller réviser » (vert, icône Lucide `BookOpen`) qui ouvre l'onglet Réviser, puis « Fermer » (texte).

## 4. États

Chaque état existe en clair et en sombre (voir le fichier HTML, rangées « Variantes et états »).

| État | Contenu |
|---|---|
| Chargement | Squelettes animés (ligne courte, titre, grand bloc, bloc moyen, ligne, bouton). La croix reste active. Pas de spinner seul. |
| Faible activité | Carte 1 avec « Un bon début. » (ex. 2 missions, 2 jours cochés). Le ton reste encourageant. |
| Pass actif | Carte 4 « Crédits illimités ». |
| Récap vide, expiré ou introuvable | Icône `BookOpen` dans un carré vert, titre « Pas encore de récap. », texte « Fais une mission cette semaine : ton récap arrive lundi prochain. », boutons « Faire ma mission » (vert, vers l'accueil) et « Fermer ». |
| Hors ligne avec copie | Bande orange douce sous l'en-tête (`etat.alerteDoux`, icône `WifiOff`) : « Hors ligne. Récap enregistré sur ton téléphone. » ; les cartes s'affichent normalement. |
| Hors ligne sans copie | Icône `WifiOff` dans un carré jaune, titre « Pas de réseau. », texte « Ton récap s'affichera dès que tu seras connecté. Le reste de l'app marche toujours. », boutons « Réessayer » (vert, `RotateCw`) et « Fermer ». |

## 5. Ouverture

### Automatique, première ouverture de la semaine
- Condition : au passage au premier plan (démarrage à froid, ou reprise après plus de 30 minutes), si le récap de la semaine précédente existe, contient de l'activité, et que `derniere_semaine_vue` est antérieure au lundi courant.
- Présentation : page plein écran au-dessus de l'accueil, après le lancement et après une éventuelle mise à jour obligatoire.
- Jamais pendant une mission, un quiz, une épreuve chronométrée, l'inscription ou un paiement : on attend le retour sur l'accueil.
- La semaine est marquée comme vue dès que la carte 1 s'affiche. Si l'élève quitte l'app, elle ne se rouvre pas d'elle-même.

### Par notification
- Push du lundi (« Ta semaine est prête » / « 5 missions, 14 leçons validées. Découvre ton récap. ») et ligne du centre de notifications (« Ta semaine du 28 sept. au 4 oct. » / « Touche pour revoir ton récap. »).
- Lien profond : `/ma-semaine?semaine=2026-09-28` (lundi de la semaine concernée). Ouvre cette semaine même si elle a déjà été vue, et la marque comme vue.
- La ligne du centre de notifications reste 8 semaines. Au-delà, ou si la semaine est introuvable : état « vide ».
- Les alertes de fin de Pass et le résumé restent inactifs tant que la PR serveur #47 n'est pas fusionnée.

## 6. Navigation
- Appui sur le tiers droit de l'écran : carte suivante. Tiers gauche : carte précédente. Balayage horizontal : idem.
- Le bouton « Suivant » est toujours visible : aucun geste n'est obligatoire.
- Pas de défilement automatique.
- Bouton retour Android : carte précédente, puis fermeture. Croix : ferme à tout moment.
- Dernière carte : « Fermer ».

## 7. Animations, retours, accessibilité
- Entrée de la page : glissement de bas en haut, 300 ms (`mouvement.feuille`). Les grands nombres montent de 0 à leur valeur en 600 ms. Tout est coupé avec « réduire les animations » ; les squelettes ne bougent plus.
- Retours (M16, via le service unique, jamais de son joué en direct) : `arrive` à l'ouverture ; `streak` en plus si 7 missions sur 7.
- Chaque carte est une section avec un titre ; le lecteur d'écran annonce « Carte 2 sur 4 ». Les segments ont un libellé équivalent.
- Cibles de 48 px, texte noir sur les couleurs vives, texte qui suit la taille système jusqu'à 130 % sans couper les boutons, aucune information portée par la couleur seule.
- Barre d'état et barre de navigation colorées selon le thème.

## 8. Évènements PostHog
- `week_recap_shown` : `{ source: 'auto' | 'push' | 'inbox', semaine }` (à l'affichage de la carte 1).
- `week_recap_card_viewed` : `{ index, semaine }` (à chaque carte).
- `week_recap_cta` : `{ cta: 'refaire_erreurs' | 'aller_reviser' | 'faire_mission' | 'reessayer' | 'fermer', semaine }`.
- `week_recap_closed` : `{ derniere_carte, semaine }`.

## 9. Tests à écrire
- Nombre de cartes : 1, 2, 3 et 4 (cartes et lignes à 0 sautées) ; segments cohérents.
- Titres de la carte 1 pour 0, 1, 3, 4, 6 et 7 missions ; singulier et pluriel.
- Pass actif / sans Pass / solde à 0 ; chiffres de crédits lus dans la config.
- Ouverture automatique : une seule fois par semaine, jamais pendant une mission, un quiz ou un paiement ; reprise après 30 minutes.
- Lien profond : semaine donnée, semaine déjà vue, semaine introuvable ou expirée.
- Hors ligne avec copie, hors ligne sans copie, « Réessayer ».
- Navigation : tiers droit et gauche, bouton « Suivant », bouton retour Android, croix.
- Clair et sombre, texte système à 130 %, « réduire les animations ».
- Invité : aucune ouverture automatique.

## 10. Points à confirmer avec Benny
- Pas de récap pour l'invité sans compte.
- Règles de crédits de « Refaire mes erreurs » lancé depuis la carte 3.
- Durée de conservation de l'entrée du centre de notifications (8 semaines proposées).
