# Anciens sujets : détails, correction et travail corrigé par l'IA (issue #72)

Cahier court, puis maquette `anciens-sujets.html` (clair et sombre), puis code. Demande de Benny du 20 octobre 2026.

## Principe
Un seul parcours pour le secondaire et les concours : on ajuste l'existant (parcours D, D3 annales, D4 sujet, lecteur PDF), on ne redessine pas.

## Écrans
| Id | Écran | Ce qui change |
| --- | --- | --- |
| AS1 | Détails du sujet (`/annales/sujet`) | Déjà là pour les concours ; devient la page de tout ancien sujet. Ajoute la liste « Mes sessions » avec la note de chacune. Même page pour le secondaire et les concours. Retours de Benny du 20 octobre : titre en police plus petite (même place), en-tête « Ancien sujet » à côté de la flèche retour (jamais vide), catégorie du document (nom du dossier) en pastille jaune sous les étiquettes, et le choix du temps n'est plus sur la page. |
| AS1c | Feuille « Temps de travail » | S'ouvre quand l'élève appuie sur « Ouvrir le sujet » : choix du chrono, puis « Commencer » ou « Plus tard ». |
| AS2 | Lecteur : sujet | À côté de zoom + et zoom - : bouton « Voir la correction » (seulement si le sujet a un corrigé). |
| AS3 | Lecteur : correction | Même place : bouton « Voir le sujet ». |
| AS4 | Faire corriger par l'IA | Sujet sans corrigé : bouton « Faire corriger par l'IA » (page de détails et lecteur). Choix : prendre en photo ou importer de la galerie. |
| AS5 | Prise de photos | Appareil existant en rafale : une feuille après l'autre, compteur, vignettes. |
| AS6 | Mettre dans l'ordre | Grille des photos numérotées ; monter/descendre (et appui long pour déplacer), retirer, ajouter. Texte : l'ordre aide l'IA. |
| AS5b | Aperçu d'une feuille | Toucher une vignette (prise de photos) ou une feuille (ordre) ouvre l'aperçu en grand : Pivoter (quart de tour), Recadrer (cadre de l'aide par photo, « Appliquer le cadre »), Terminé. La croix de chaque vignette supprime la photo sans passer par l'ordre. |
| AS7 | Correction en cours | Écran d'analyse existant (B3) : lecture, correction, notation. Coches neo-brutalistes comme l'aide par photo ; chaque étape a son état (attente, chargement, terminée, échec), la première tourne dès l'envoi. « Quitter, me prévenir quand c'est prêt » coupe la connexion : la correction continue côté serveur et une notification ouvre la session corrigée. |
| AS8 | Résultat de la session | Note sur le total, points par question (carte par question : points obtenus / possibles, commentaire), photos du travail. Ouverte depuis « Mes sessions ». |
| AS9 | États | Crédits insuffisants (feuille K3), hors ligne, photo illisible (crédits rendus, raison de l'IA affichée, action « Reprendre les photos »), erreur, vide (aucune session). |

## Temps de travail (demande de Benny du 20 octobre)
Dans une feuille du bas ouverte par « Ouvrir le sujet », l'élève choisit : **Mesurer mon temps** (chrono montant, sans limite) ou **Compte à rebours** (simulation d'examen). Le compte à rebours propose **Temps conseillé** (durée du sujet, si connue) ou **Mon temps** (saisie en minutes). Sans durée conseillée, seul « Mon temps » est proposé ; sans temps déjà saisi, la feuille s'ouvre sur « Mesurer mon temps » pour que « Commencer » reste à un appui. Le choix est mémorisé pour la prochaine fois. Le lecteur démarre alors directement le chrono choisi, sans second menu.

## Règles
- Correction fournie par le concours : « Voir la correction » coûte le prix serveur (`exam_correction`, premier sujet gratuit). Aucun changement de droit.
- Correction IA : coût = action `exam_ai_correction` de `credit_actions` (lu côté serveur, jamais en dur), débité à l'envoi, rendu si la photo est illisible ou si l'IA échoue (même mécanique que la photo).
- Points par question : le barème vient du corrigé s'il existe, sinon l'IA propose un barème lisible et le dit. Total sur 20 par défaut, ou sur le total du sujet.
- Sauvegarde : photos dans R2 (bucket privé photos, clé `sujets/{élève}/{session}/{n}.jpg`), lecture par adresses signées de courte durée. Table `exam_attempts` (élève, sujet, statut, note, total, résultat, chemins, dates) avec RLS : l'élève ne voit que les siennes.
- Purge RGPD à 30 jours des photos : même règle que l'aide par photo, la note et le détail de correction restent.
- Vidéo : non pour la v1 (module natif absent de l'APK, AGENTS §17). Photos successives et import galerie.
- Hors ligne : consultation des sessions déjà chargées ; envoi bloqué par la garde réseau avec message clair.
- Pas d'emojis, icônes Lucide, tokens `theme.color.*`, textes en tutoiement, évènements PostHog (`annale_ai_started`, `annale_ai_done`, `annale_correction_toggle`).

## Tests
Jest : tri et réordonnancement des photos, états de l'écran de détails, bascule sujet/correction, calcul de la note. pgTAP : RLS, débit et remboursement. Deno : fonction Edge de correction multi-pages.

## Crédits d'un document de classe (retour de Benny du 20 octobre)
Un document déjà ouvert ne coûte plus rien : il s'ouvre directement, sans feuille d'accord ni débit, comme les ouvertures gratuites restantes. La feuille « prix » ne s'affiche que pour un document jamais ouvert, quand il n'en reste plus de gratuit.

## Retours de Benny du 20 octobre, correction du travail (lot B)
- **« Feuilles illisibles » à tort** : deux causes traitées. Côté app, les feuilles partent en meilleure qualité (côté long 1800 px, JPEG 0,8 au lieu de 1280 px et 0,7). Côté fonction Edge, la consigne de l'IA est tolérante : elle corrige tout ce qui se lit, signale le reste en 0 point dans le commentaire de la question, et ne répond « illisible » que si aucun mot ni calcul ne se lit ou si les photos ne montrent aucun travail écrit. L'absence de l'énoncé n'est jamais une raison de refuser.
- **Illisible pour de bon** : bannière, raison donnée par l'IA, bouton principal « Reprendre les photos » (retour à la prise de photos, les feuilles déjà prises restent), bouton secondaire vers l'ordre. « Renvoyer à l'IA » reste pour les autres échecs.
- **Supprimer une photo** depuis l'écran de prise (croix sur la vignette), sans passer par l'ordre.
- **Aperçu, recadrage, rotation** depuis la prise de photos et depuis l'ordre (AS5b, AS5c).
- **Étapes** : pastille ronde bordée comme dans l'aide par photo (vert et coche si terminée, corail et croix si échec, indicateur de chargement si en cours). Avant le premier signal du serveur, la première étape est déjà « en cours » (préparation et envoi des feuilles).
- **Quitter la page** : bouton « Quitter, me prévenir quand c'est prêt » dès que les feuilles sont arrivées au serveur ; la connexion est coupée, le serveur termine et envoie la notification `photo_ready` (données `exam_attempt_id`, `paper_kind`, `paper_ref`) ; le toucher ouvre `/annales/session`. Quitter avant l'arrivée des feuilles n'est pas proposé : rien ne serait corrigé.
- Tests : états des étapes, quitter (connexion coupée, aucune ouverture tardive de la session), illisible, suppression, aperçu (pivoter, recadrer, échec), routage de la notification, qualité des feuilles.

## Visite guidée interactive de la prise de photos (demandes de Benny du 20 octobre)
Visite remplacée le 21 octobre par la bibliothèque de visite de l’app (voir la section du 21 octobre) ; l’ancienne visite sur feuille d’exemple est supprimée.
- **Quand** : une seule fois, à la première ouverture de la prise de photos (valeur mémorisée). « Passer » est toujours visible (en haut) : il ferme et compte comme vue. Jamais bloquante.
- **Étapes (6)**, chacune avance quand l'action est faite : 1. appuyer sur le bouton rond (la feuille d'exemple est « photographiée ») ; 2. appuyer sur la miniature ; 3. dans l'aperçu, appuyer sur Recadrer ; 4. déplacer le cadre puis appuyer sur Appliquer le cadre ; 5. appuyer sur Terminer puis sur Envoyer à l'IA ; 6. attendre la correction d'exemple (étapes simulées, puis note d'exemple), « Terminer la visite ».
- **Mise en évidence** : l'élément à toucher est entouré en jaune (jeton `accent.soleil`), le reste est atténué et inactif ; une carte d'indication (jaune doux, bordure 2 px, ombre dure) dit quoi faire, avec « Étape n sur 6 » et « Passer ».
- **Écrans** : AS5d (étapes 1 à 6) et AS5e (résultat d'exemple), clair et sombre. L'appareil reste sombre dans les deux thèmes.
- **Inspiration** : l'ancienne app (`@wrack/react-native-tour-guide`, une seule fois, étapes, passer) ; pas de nouvelle dépendance (AGENTS §17), composant maison.
- **Évènements** : `annale_visite_vue` { terminee: boolean }.
- **Correctif lié** : la miniature d'une feuille prise n'avait pas de taille ; fixée à 56 par 70.

## Fin du chrono (demande de Benny du 20 octobre, AS8)
- À l'échéance du compte à rebours : vibration et son de fin d'épreuve (réglages sons et vibrations respectés), puis feuille « Temps écoulé ».
- Actions : « Voir la correction » (seulement si le sujet a un corrigé), « Corriger mon travail » (envoyer ses photos à l'IA), « Quitter ». Chrono libre : rien.
- Application en arrière-plan à l'échéance : notification locale, uniquement si la permission est déjà donnée (jamais demandée ici, AGENTS §18).

- Revoir la visite (AS5f) : bouton rond d'aide (point d'interrogation, 48 px, bord blanc) en haut à droite de l'appareil photo, à côté de la pastille du nombre de feuilles. Relance la visite à tout moment, sans crédit ni envoi à l'IA.

## Retours de Benny du 21 octobre : résultat de la correction (AS8 révisé) et visite avec la bibliothèque de l'app
- **Structure du sujet** : le résultat reprend les parties, les exercices et les questions (ou des questions directes). Chaque partie et chaque exercice est une section repliable avec son titre et ses points obtenus / possibles ; la première est ouverte. Sans structure (anciennes sessions), liste à plat comme avant.
- **Détail d'une question** : toucher une question ouvre une feuille du bas : énoncé, « Ta réponse » (ce que l'élève a écrit), « La bonne réponse » (seulement si la question n'a pas tous ses points), explication, commentaire. Les formules sont rendues comme dans les cours (même composant), jamais en LaTeX brut.
- **Carte de note x/y** : fond émeraude par défaut ; orange (`etat.alerte`) sous 40 % ; corail (`etat.erreur`) sous 20 %. Texte noir (règle de contraste). La couleur ne porte pas seule l'information : le score reste écrit.
- **Quitter** remplace « Retour au sujet » et ramène à la page de détails du sujet (mémorisé par `memoriserSujet`).
- **« Revoir les feuilles »** : les adresses signées sont obtenues par la fonction Edge (lecture de la ligne par le serveur après contrôle du propriétaire), car les colonnes des chemins ne sont pas lisibles par l'élève.
- **Visite guidée (AS5d, remplace la visite maison)** : bibliothèque `@wrack/react-native-tour-guide` (déjà dans l'app, aucun module natif ajouté) : projecteur sur les vrais boutons de la prise de photos, une carte d'explication par étape : viseur, bouton rond, galerie, compteur de feuilles, Terminer, aide. « Passer » toujours visible. Lancée une fois à la première ouverture ; le bouton d'aide (point d'interrogation) la relance. Évènement `annale_visite_vue`. L'ancienne visite sur feuille d'exemple n'est plus ouverte automatiquement.
- Les maquettes HTML ne sont pas redessinées à cette date : cette spec fait foi (écrans existants ajustés, aucun nouvel écran).

## Nettoyage de l'ancien parcours et chrono (21 octobre)
- **Bug du temps** : sans temps conseillé (documents de classe), le choix « Compte à rebours » était aussitôt ramené au chrono libre ; il bascule maintenant sur « Mon temps » avec saisie des minutes.
- **Mes documents** : une annale gardée sur le téléphone rouvre la page de détail du sujet (temps, correction, sessions) et non plus le lecteur seul. Seuls les documents sans origine connue s'ouvrent directement, sans menu de chrono.
- **Supprimé** : l'ancien menu de chrono du lecteur (durée officielle, 30 min, 1 h, 2 h, « Ne plus afficher »), sa feuille d'explication au premier lancement, la visite interactive sur feuille d'exemple et leurs textes. Le temps se choisit uniquement sur la page de détail du sujet.
