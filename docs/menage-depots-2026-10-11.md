# Ménage des dépôts — 11 octobre 2026

## Ce qui a été fait

Les branches de développement et d'essai ont été supprimées dans les cinq dépôts. La règle retenue : **une seule
branche de travail vivante par dépôt**, en plus de `main`.

| Dépôt | Branches distantes avant | après |
| --- | --- | --- |
| `elearn-app` | 28 | **`main` + `claude/project-thread-kw792g`** |
| `elearn-site` | 11 | **`main`** |
| `elearn-supabase` | 35 | **`main`** + `claude/project-thread-2ryfy3-canal-parent` (PR #50, brouillon d'une autre session) |
| `elearn` (back-office) | 17 | `main` + les branches des PR ouvertes |
| `elearn_mobile` (hérité) | 32 | 15, celles des PR ouvertes — dont le correctif de sécurité #46 |

**76 branches distantes supprimées**, plus les branches locales orphelines des cinq dépôts.

**Règle pour la suite** : une branche, une PR, et **la branche est supprimée à la fusion** (`gh pr merge
--delete-branch`). Une branche qui survit à sa PR est un oubli.

## Retrouver une branche supprimée

La liste complète — dépôt, nom, SHA du dernier commit, date et sujet — est dans
[annexes/branches-supprimees-2026-10-11.csv](annexes/branches-supprimees-2026-10-11.csv).

Pour restaurer une branche : `git push origin <sha>:refs/heads/<nom>` depuis un clone qui possède encore l'objet, ou
`git fetch origin <sha>` puis `git switch -c <nom> <sha>`.

## Sécurité

- **`.env.vercel` du dépôt `elearn` était versionné** à la racine, avec quinze clés de production (GeniusPay, NotchPay,
  Mux, Resend, Google AI, `AUTH_BRIDGE_SECRET`, jeton OIDC Vercel, mot de passe Supabase). Benny les a **révoquées** le
  11 octobre. Le fichier est sorti du suivi et ajouté au `.gitignore` (PR `elearn#31`) ; il reste sur le disque pour le
  build local.
- **Six scripts `test_db*.js`** laissés à la racine du back-office portaient une **clé secrète Supabase de production en
  clair** (non suivis par git). Supprimés.
- **Règle** : aucun fichier `.env*` suivi par git, sauf `.env.example` sans valeur. `git status` se lit, il ne se
  survole pas.

Il reste, sans urgence : réécrire l'historique (`git filter-repo`) et activer le secret scanning sur les cinq dépôts
(voir `elearn-app#36`).

## Copies locales du dossier de travail

Six clones complets traînaient à côté des dépôts principaux. **Deux sont conservés volontairement** :
`elearn-app-ci` et `elearn-app-notif` détiennent la seule copie de deux branches non fusionnées
(`ci/reduce-actions-minutes`, `docs/priorites-32`) dont la version distante a été supprimée. Les quatre autres
(`elearn-app-alertes`, `elearn-app-certif`, `elearn-supabase-alertes`, `elearn-supabase-tmp`) ne portent aucun travail
non poussé et peuvent partir.

## Ce qui reste ouvert

- **PR** : `elearn-supabase#50` (brouillon, autre session), `elearn#25` et `elearn#13` (en conflit), `elearn#14`
  (brouillon en conflit), `elearn#23` (fusionnable), `elearn_mobile#46`, `#42`, `#41`, `#39`.
- **Modèles WhatsApp** : quatre modèles attendent la revue de Meta (`rapport_hebdo_parent_texte`,
  `rapport_hebdo_parent_image`, `facture_paiement`, `demande_paiement_parent`). Le pipeline les utilise déjà et
  **réessaie** les messages concernés jusqu'à l'approbation, sans perte.
