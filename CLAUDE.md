# CLAUDE.md — Elearn Prepa, nouvelle app (elearn-app)

À lire en entier avant toute action. Ce fichier est l'index du contexte du projet ; le détail est dans `docs/`.
Dernière mise à jour : 30/09/2026 (fil « Contexte du projet dans les dépôts »).

## Le projet en 5 lignes

- Elearn Prepa (Cameroun, puis 6 pays d'Afrique francophone) n'arrivait pas à vendre avec l'ancienne app (`elearn_mobile`). Benny et son associé refont le produit et l'app.
- Nouvelle promesse : **« le tuteur de poche de l'élève africain »** : premier résultat sans compte en moins de 2 minutes, aide par photo, mission du jour, annales, pass courts payés en Mobile Money.
- Ce dépôt = la nouvelle app Expo (Android, iOS, web). Lancement visé : **janvier 2027**.
- Backend : dépôt `elearn-supabase` (privé). Site vitrine et pages publiques (paiement parent) : dépôt `elearn-site` (privé).
- Benny (GitHub `falachabt`) est le propriétaire. Il parle français. Claude écrit le code, Benny relit et teste sur son téléphone.

## Règles impératives (à respecter sans exception)

1. **Aucun secret dans le dépôt** : ni clé, ni jeton, ni mot de passe, ni identifiant de compte. Seulement des **noms** de variables (`EXPO_PUBLIC_SUPABASE_URL`, etc.). Ce dépôt est **public**. Si tu croises un secret, ne le recopie nulle part et préviens Benny.
2. **Aucune modification de la production** (base Supabase de prod, canal EAS `production`, stores, site en ligne) sans accord écrit de Benny et relecture de la PR. Lecture seule en prod : seulement s'il l'autorise.
3. **Aucune dépense** (service payant, build EAS en plus, budget, abonnement) ni **aucune suppression** (fichiers, branches d'autrui, données, buckets) sans son accord explicite.
4. **Petits commits fréquents, poussés au fur et à mesure** : si la session s'arrête, le travail doit déjà être sur GitHub. Un commit = une étape qui compile et passe les tests.
5. **Tests écrits avec le code** (Jest, dans un sous-dossier `__tests__`), lancés en CI. Avant de pousser : `npm test -- --ci`, `npm run typecheck`, `npm run lint`.
6. **Ne jamais écrire `[build]` ni `[obligatoire]` dans un message de commit sans le vouloir** : `[build]` lance un build Android EAS (coût), `[obligatoire]` force la mise à jour OTA chez tous les testeurs.
7. **Pas de `@ts-expect-error` / `@ts-ignore` hors tests** (règle lint). Un `@ts-expect-error` a masqué le crash du 30/09 (voir `docs/05-architecture-expo-ota.md`).
8. **Tout écran avec saisie passe par `Ecran`** ; barres système colorées selon le thème ; sons/vibrations uniquement via `useFeedback` ; couleurs uniquement via `theme.*`. Détail : `docs/04-design-system.md`.
9. **Ne jamais utiliser `git stash`** dans un dépôt où un autre agent travaille, ni `pkill -f` large.
10. **Ne pas toucher aux branches des autres fils** (ex. PR #1 `claude/project-thread-cvknuk`, PR #2 `claude/project-thread-kw792g`). Chaque fil a sa branche et sa PR en brouillon.
11. **Décisions validées = non négociables** sans Benny : pawaPay, pass 500 / 2 500 / 7 500 FCFA, invité d'abord, récompenses M15, M16. Voir `docs/01-produit-et-decisions.md`.
12. **Incertain = « à confirmer »**. Ne jamais inventer un prix, une règle ou un identifiant.
13. Communication : messages à Benny **clairs, en français**, sans jargon. Code, commits, PR, docs en français. Mode concis (skills `caveman` et `mode-concis`) seulement pour le raisonnement et les échanges entre agents.

## Avant de coder

1. Lire `AGENTS.md` (règles Expo SDK 57 : ne pas se fier à sa mémoire, lire la doc versionnée) et `README.md` (très détaillé : modules natifs, OTA, M16, compte, parrainage). Ils sont sur la branche de dev tant que les PR #1/#2 ne sont pas fusionnées.
2. Vérifier les skills : `.claude/skills/caveman` (dans le dépôt) et `mode-concis` (compte de Benny).
3. Lire l'état d'avancement : `docs/03-plan-de-dev.md`.
4. Pour un écran : lire d'abord le design (`docs/04-design-system.md`) et l'exigence du cahier des charges qu'il couvre (`docs/02-cahier-des-charges.md`, identifiants `M1-01`…).

## Index de `docs/`

| Fichier | Contenu |
|---|---|
| `docs/01-produit-et-decisions.md` | Produit, cibles, décisions validées par Benny (pawaPay, prix, invité d'abord, récompenses, sons) |
| `docs/02-cahier-des-charges.md` | Résumé du cahier des charges v1.3 (modules M1–M16, exigences clés, événements PostHog) et où est la source |
| `docs/03-plan-de-dev.md` | Phases 0 à 6, état d'avancement au 30/09, ce qui reste |
| `docs/04-design-system.md` | Thème, composants, sons, règles d'écran (clavier, insets, barres, réduire les animations) |
| `docs/05-architecture-expo-ota.md` | Expo SDK 57, EAS, canal preview, runtimeVersion, CI, barrière avant OTA, pièges |
| `docs/06-supabase.md` | Backend : Supabase local (Docker + CLI), migrations, tests, ce que l'app attend |
| `docs/07-stockage-r2-et-marketing.md` | Cloudflare R2 (règle : ne jamais exposer le bucket de production), marketing |
| `docs/08-regles-de-travail.md` | Façon de travailler de Benny, en détail |
| `docs/09-equipes-et-suivis.md` | Fils d'agents du projet, où trouver chaque suivi, fichiers partagés |
| `docs/10-avant-la-production.md` | Liste à cocher avant toute mise en production ou publication sur les stores |

Contexte **confidentiel** (chiffres de ventes, business plan, audit de sécurité détaillé, identifiants de services) : pas ici car ce dépôt est public. Il est dans le dépôt privé `falachabt/elearn-supabase`, dossier `docs/projet/`.
