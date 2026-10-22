---
date: 2026-10-22 19:55 UTC
auteur: benny (demande), coordinateur (relais)
sujet: mettre en place le travail en parallèle avec Muse, sans chevauchement
etat: fait
zones: docs/travail-collaboratif.md, docs/methode-agent-design.md, docs/communication/, docs/cahiers/
---

## Demande de Benny

Travailler en parallèle avec un autre agent IA, Muse, sans que les travaux se gênent. Pour cela :

1. un document « travail collaboratif » : rôles (coordinateur, dev TOEIC, manager qualité, agent design, agent contenu, chef de projet), règles et façon de travailler déjà en place ;
2. la méthode de l'agent design, écrite comme un mode d'emploi réutilisable, avec son artefact ;
3. un protocole d'échange par fichiers, à l'intérieur du dépôt ;
4. les cahiers des charges dans le dépôt, avec un README qui dit lequel fait foi ;
5. le prompt de démarrage de Muse.

## Ce qui a été mis en place

- `docs/travail-collaboratif.md` : rôles, branches, déroulé d'une fonctionnalité, pièges connus.
- `docs/methode-agent-design.md` : processus de l'agent design, états à dessiner, livraison, passation.
- `docs/communication/README.md` : protocole (un fichier par échange, `EN-COURS.md`, propriété par zone, préfixes `claude:` et `muse:`, `git pull` avant push).
- `docs/communication/EN-COURS.md` : qui tient quelle zone.
- `docs/communication/PROMPT-MUSE.md` : prompt de démarrage de Muse.
- `docs/cahiers/` : cahier TOEIC en v1.35 (22 octobre 2026), archive du cahier TOEIC v0.3, et un README. Le cahier de référence Elearn Prepa 2 (v1.13) n'est pas copié : il contient le modèle économique, et le dépôt est public. Il reste dans le dépôt privé (point à trancher ci-dessous).

## Points à trancher par Benny

1. **Branche.** Le protocole vise `claude/project-thread-kw792g`, la branche de travail du projet. Le commit de cette session est sur une branche désignée pour la session, à fusionner ou à reporter sur `kw792g` : à confirmer par Benny.
2. **Tri des issues.** La première tâche de Muse (hors TOEIC) doit être confirmée par le chef de projet avant de démarrer.
3. **Cahier de référence (Elearn Prepa 2, v1.13)** : le dépôt `elearn-app` est public et ce cahier contient des chiffres financiers. Faut-il le ranger dans `elearn-supabase` (`docs/projet/`, privé) ? Recommandation : oui, et le README renvoie vers lui.
4. **Accès ElevenLabs et R2** : toujours à reconnecter côté environnement cloud pour l'agent contenu.

## Ce qui n'a pas été touché

Aucune modification de code applicatif, aucun OTA, aucun changement de production, aucune migration. Les zones TOEIC en cours restent au dev TOEIC.
