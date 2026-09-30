# Règles de travail de Benny

Benny est le propriétaire (GitHub `falachabt`), parle français, est développeur principal non rémunéré avec un associé (contenu). **Claude écrit le code, Benny assiste et relit.** Ces règles viennent de ses messages dans le projet ; elles priment sur toute habitude.

## Communication

- Messages à Benny : **français clair, court, sans jargon**, réponse en tête. Code, commits, PR, docs : français aussi.
- **Mode concis** (skills `.claude/skills/caveman` du dépôt et `mode-concis` de son compte) : pour le raisonnement interne et les échanges entre agents, pas pour ses messages ni le code.
- Il est souvent absent des heures : avancer sans attendre, choisir le défaut raisonnable, le dire après coup.

## Git et livraison

- **Petits commits fréquents, poussés au fur et à mesure** : si l'usage Claude se termine, le travail est déjà sur GitHub et Benny reprend ailleurs (Claude Code sur son ordinateur). Un commit compile et passe les tests.
- Une tâche = une PR courte **en brouillon**. Benny teste sur son téléphone puis fusionne. Une PR fusionnée est finie : le travail suivant repart d'une branche fraîche depuis `main`.
- Messages de commit : clairs, en français, avec l'identifiant d'exigence quand il existe (ex. « A7 · Reprise des anciens comptes (M2-06) »).
- `main` des dépôts neufs n'a qu'un commit initial : ne pas le casser, ne pas pousser dessus sans accord.

## Qualité

- **Tests écrits avec le code**, exécutés en CI (app et Supabase). Tests dans `__tests__`. Pas d'émulateur en barrière CI (refusé).
- C'est du code de production : propre, typé, pas de `ts-ignore`.
- **Captures d'écran clair et sombre de temps en temps**, envoyées avec le compte rendu (script de vérification + `app/apercus/`).
- Après chaque OTA, l'app doit être ouverte sur le téléphone de test (Jest ne voit pas les crashs natifs).
- Règles d'écran : clavier (`Ecran`), status bar et barre de navigation Android colorées selon le thème sur **tous** les écrans, sons/vibrations réglables (M16), retours via `useFeedback`.
- L'app doit se comporter sur un Android de 2 Go en 3G.

## Limites (demander d'abord)

- **Aucune modification de la production** sans accord explicite et relecture des PR.
- **Aucune dépense** (services payants, builds EAS supplémentaires, budgets Expo, ElevenLabs, abonnements, publicité) sans accord.
- **Aucune suppression** (fichiers, projets Figma, buckets, branches, données) sans accord écrit.
- **Aucune publication** (réseaux sociaux, stores, site en ligne) sans accord.
- **Aucun secret** dans le chat, les commits, la mémoire ou les dépôts. Les clés passent par le formulaire « Ajouter un identifiant ». Si un secret est croisé, le signaler sans le recopier.
- Décisions validées (pawaPay, prix, logo, récompenses) : ne pas les rediscuter, en cas de doute demander.
- Dépenses de build et quotas : Figma Starter 20 appels/mois (remis à zéro le 1er de chaque mois), Make gratuit (5 Mo par fichier).

## Autonomie

Design : totale autonomie sur les choix (hors dépenses et suppressions). Dev : Claude décide des détails techniques ; ce qui change le produit, l'argent ou la production passe par Benny.
