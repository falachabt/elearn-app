# Confirmer une demande du support (route `/support-confirmer`)

Décision de design du 8 octobre 2026, prise sans attendre Benny (règle de `design-regles.md`) et à lui signaler. Ajustement de l'existant : même conteneur `Ecran`, même carte bordée que « Moi », même `Bouton` et même `Banniere`. Aucun nouveau composant visuel.

## À quoi ça sert

Quand quelqu'un écrit au support Elearn Prepa sur WhatsApp en donnant l'identifiant ou l'e-mail d'un compte, le serveur envoie une notification à ce compte. L'écran lui demande de confirmer que c'est bien lui. Sans cet accord, le support ne voit rien du compte.

## Comment l'écran s'ouvre

1. Toucher la notification « Le support Elearn Prepa te contacte » (le serveur donne `screen: /support-confirmer`).
2. Ouvrir l'application sans toucher la notification : à l'ouverture et au retour au premier plan, une demande en attente ouvre l'écran (une fois par demande, jamais en boucle).
3. Notification reçue application ouverte : l'écran s'ouvre.
4. Moi n'a pas de lien vers cet écran : il n'existe que pour répondre à une demande.

## États

| État | Contenu |
| --- | --- |
| Chargement | Indicateur d'activité au centre. |
| Invité (pas de compte) | Titre « Connecte-toi pour confirmer », une phrase, bouton « Se connecter ». |
| Aucune demande | Titre « Aucune demande en attente », phrase : elle a peut-être expiré, redemander sur WhatsApp. Bouton « Retour ». |
| Demande en attente | Carte bordée : icône casque (Lucide `Headset`) dans une pastille de 34 px, phrase « Quelqu'un demande à parler au support Elearn Prepa sur WhatsApp avec ton compte. », ligne « Depuis le numéro qui se termine par 0501 », question « C'est toi ? ». Deux boutons : « Oui, c'est moi » (seule action verte de l'écran) et « Non, ce n'est pas moi » (blanc). |
| Envoi | Les deux boutons sont grisés pendant l'appel. |
| Confirmé | Bannière de succès « C'est confirmé » : retourne sur WhatsApp, le support peut t'aider. Bouton « Retour ». |
| Refusé | Bannière d'information « Demande refusée » : rien n'a été partagé. Bouton « Retour ». |
| Expirée | Bannière d'alerte « Cette demande a expiré ». Bouton « Retour ». |
| Erreur réseau | Bannière d'erreur « Impossible de répondre pour le moment », les boutons restent actifs. |

Plusieurs demandes en attente : une carte par demande, la plus récente en haut.

## Règles

- Tutoiement, pas d'emoji, icônes Lucide, tokens du thème uniquement, clair et sombre.
- Le numéro n'est jamais affiché en entier : seulement ses quatre derniers chiffres.
- Hors ligne : l'appel échoue, la bannière d'erreur s'affiche (la réponse exige le serveur).
- Évènements PostHog : `support_confirmation_vue`, `support_confirmation_reponse` (accepted, refused, expiree).
