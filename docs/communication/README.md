# Protocole de communication entre agents

Objet : permettre à Claude (coordinateur, dev, manager qualité, design, contenu, chef de projet) et à Muse de travailler en parallèle sans se marcher dessus, en laissant une trace lisible par Benny.

Le schéma est volontairement simple et réversible : des fichiers dans git, pas d'outil en plus.

## 1. Où ça vit

- `docs/communication/EN-COURS.md` : **qui travaille sur quoi, maintenant.** Un seul fichier, mis à jour à chaque prise ou fin de zone.
- `docs/communication/echanges/` : **un fichier par échange** (message, question, passation, décision). Nom : `AAAA-MM-JJ-HHMM-auteur-sujet.md`.
- `docs/communication/PROMPT-MUSE.md` : prompt de démarrage de Muse. À relire quand une règle change.
- Ce protocole : `docs/communication/README.md`.

Le tout est sur la branche de travail de `elearn-app` (`claude/project-thread-kw792g`). Pas de branche dédiée à la communication : un seul endroit à lire, un seul historique.

## 2. Un échange = un fichier

En-tête obligatoire :

```
---
date: 2026-10-22 19:55 UTC
auteur: coordinateur | dev-toeic | manager-qualite | agent-design | agent-contenu | chef-de-projet | muse | benny
sujet: une phrase
etat: ouvert | pris | fait
zones: liste des fichiers ou dossiers touchés (ou « aucune »)
---
```

Corps : ce qui est demandé ou décidé, en quelques lignes. Une question est posée avec la réponse attendue (oui/non, choix A/B). Un échange **fait** garde son fichier : c'est l'historique.

États :
- **ouvert** : posé, personne ne l'a pris.
- **pris** : un agent travaille dessus. Il l'indique dans `EN-COURS.md`.
- **fait** : terminé, avec le lien vers le commit qui le conclut.

Règles :
- On ne réécrit pas le message d'un autre. Pour répondre, on crée un nouveau fichier qui cite le premier.
- Un agent qui s'arrête écrit une passation : état, fichiers touchés, branches, pièges, prochaine étape.

## 3. Qui travaille sur quoi : `EN-COURS.md`

Avant de modifier un fichier, on vérifie `EN-COURS.md`. Une zone déjà prise par un autre n'est pas modifiée. On écrit un échange à son auteur, ou on attend.

Format d'une ligne :

```
| zone | propriétaire | depuis | état | échange |
```

Une zone est un dossier ou un écran (par exemple `écrans TOEIC, parcours d'arrivée`, `src/components/credits/`, `supabase/functions/...`). Une zone prise est libérée en fin de travail, avec le commit qui l'a fermée.

## 4. Propriété par zone (non-chevauchement)

Règle de base : **une zone de code a un seul propriétaire à la fois.**

- Le profil TOEIC (écrans, moteur d'exercice, carnet, statistiques TOEIC, migrations TOEIC) appartient au **dev TOEIC**. Muse n'y touche pas sans échange accepté.
- Le design (`docs/maquettes/`, `docs/methode-agent-design.md`) appartient à l'**agent design**. Le dev ne modifie pas une maquette ; il demande une révision.
- Les cahiers (`docs/cahiers/`) appartiennent au **coordinateur** pour le cahier de référence, et au **dev TOEIC** pour le cahier TOEIC (sous contrôle du coordinateur). Toute modification passe par le journal des changements du cahier.
- Les issues GitHub appartiennent au **chef de projet**. Un agent qui code une issue la prend dans `EN-COURS.md` et la ferme dans son commit.
- L'app hors TOEIC (secondaire : Réviser, Questions, Moi, Photo, paiement) : une zone par écran, prise dans `EN-COURS.md`.
- Un fichier partagé par tous (`src/theme/`, `AGENTS.md`, `docs/REGLES_BENNY.md`, `package.json`) se modifie seulement en petite touche, après `git pull`, et l'échange est noté.

## 5. Branche, commits, pull

- Une seule branche de travail : `claude/project-thread-kw792g` pour `elearn-app`. Commit direct, pas de PR (décision de Benny du 7 octobre).
- **`git pull` avant tout push.** Benny commit parfois à la main.
- Préfixe obligatoire des commits :
  - `claude:` pour les agents Claude ;
  - `muse:` pour Muse.
- Exemple : `claude: maquette ma semaine v2, spec et aperçu` ou `muse: pwa, démarrage à froid hors ligne (#54)`.
- Pas d'emoji, pas d'identifiant de modèle dans les messages de commit.
- Un push sur la branche déclenche l'OTA (workflow CI). On regroupe les commits, et on n'en pousse pas un nouveau tant que le run précédent n'est pas terminé.

En cas de conflit : celui qui pousse en second fait `git pull --rebase`, résout en gardant le travail de l'autre quand la zone lui appartient, et écrit un échange de deux lignes.

## 6. Ce qu'on n'écrit jamais

- Aucun secret, jeton, clé ou mot de passe, même dans un échange.
- Aucun identifiant de compte personnel (adresse, numéro de téléphone réel).
- Aucun chiffre financier confidentiel : le dépôt est public. Les chiffres du modèle financier restent dans le dépôt privé.

## 7. Quand un échange passe par Benny

Benny lit les échanges quand il veut. Trois cas l'obligent à répondre avant que le travail continue :
- une dépense ;
- une suppression (fichier, donnée, branche, production) ;
- une migration de production, ou un changement de but du produit.

Tout le reste se tranche par l'agent concerné, s'écrit dans un échange, et avance.

## 8. Premier échange

`docs/communication/echanges/2026-10-22-1955-coordinateur-protocole.md` : la décision d'origine et ce qui a été mis en place le 22 octobre 2026.
