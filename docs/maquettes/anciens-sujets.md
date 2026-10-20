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
| AS7 | Correction en cours | Écran d'analyse existant (B3) : lecture, correction, notation. |
| AS8 | Résultat de la session | Note sur le total, points par question (carte par question : points obtenus / possibles, commentaire), photos du travail. Ouverte depuis « Mes sessions ». |
| AS9 | États | Crédits insuffisants (feuille K3), hors ligne, photo illisible (crédits rendus), erreur, vide (aucune session). |

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
