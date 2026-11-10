# Travail collaboratif sur Elearn Prepa

Ce document dit qui fait quoi, dans quel ordre, et avec quelles règles. Il s'adresse à Benny, à tous les agents IA (Claude, Muse, agents locaux ou cloud) et à toute personne qui reprend le projet.

Il se lit avec : `AGENTS.md`, `CLAUDE.md`, `docs/REGLES_BENNY.md` (règles d'or), `docs/design-regles.md` (règles de design), `docs/MEMOIRE_PROJET.md` (contexte et historique), `docs/PRIORITES.md` (ordre des tâches). Le protocole d'échange entre agents est dans `docs/communication/README.md`. Les cahiers des charges sont dans `docs/cahiers/README.md`. La méthode de l'agent design est dans `docs/methode-agent-design.md`.

## 1. Principes communs

Ces règles valent pour tout le monde, sans exception.

1. **Benny décide.** Les choix qui changent le but du produit lui reviennent. Un agent tranche les choix de mise en œuvre et de design, puis les signale.
2. **Pas de page sans maquette.** Aucun écran ni composant n'est codé sans maquette validée et reportée dans le cahier. Si elle manque, on la dessine (ou on la demande au design), puis on code.
3. **Ajuster l'existant, ne pas redessiner.** Une fonction nouvelle s'intègre dans les écrans existants.
4. **Jamais d'emojis dans l'interface, les maquettes, les issues et les commits.** Icônes Lucide, carrées.
5. **Tokens uniquement.** Les écrans utilisent `theme.color.*`, jamais la palette brute.
6. **Clair et sombre, tous les états.** Chargement (squelette), vide, erreur, hors ligne, succès.
7. **Tests pour toute fonctionnalité.** Jest côté app, pgTAP côté base, Deno pour les Edge Functions. Les tests « solides comme un rocher » : pas de test qui dépend de la date du jour sans l'avoir figée.
8. **Jamais de push sur `main`.** Les dépôts `elearn-supabase` (déploiement en production) et `elearn-app` (OTA) passent par la branche de travail.
9. **Pas de secret dans le dépôt.** Ni clé, ni jeton, ni mot de passe, ni fichier `.env` suivi par git. Une clé exposée se révoque.
10. **Pas d'identifiant de modèle dans les commits, PR, issues ou documents versionnés.**
11. **Pas d'agent en parallèle inutile.** Chaque agent coûte. Un seul agent par rôle à la fois, renouvelé quand son contexte sature, avec un fichier de passation.
12. **Pas d'arrêt pour poser une question.** Un agent tranche ce qui relève de la mise en œuvre et le signale. Il ne remonte à Benny que les dépenses, les suppressions, les migrations de production et les choix de but.

## 2. Branches et dépôts

| Dépôt | Rôle | Branche de travail | Règle |
| --- | --- | --- | --- |
| `elearn-app` | App mobile Expo (et web) | `claude/project-thread-kw792g` | Commit direct, pas de PR (décision de Benny du 7 octobre). `git pull` avant chaque push. OTA via le workflow CI. |
| `elearn-supabase` | Backend (migrations, RPC, Edge Functions) | une branche par lot, par exemple `claude/...` | Une PR par lot. CI pgTAP verte, puis fusion par l'agent (migration additive), puis rapport à Benny. |
| `elearn-site` | Site vitrine, page parent | branche de travail, PR | Vérifier `npm run build` ou `npx tsc --noEmit` avant de pousser (règles ESLint de Vercel). |
| `elearn` | Back-office | branche de travail | Ne pas casser l'ancienne app (`elearn_mobile`). |
| `elearn_mobile` | Ancienne app | aucune modification | À ne pas casser tant que les comptes ne sont pas repris. |

Règles de branche :
- `main` ne reçoit jamais de push direct. Un push sur `main` de `elearn-supabase` déploie en production.
- Une branche, une PR (quand la PR est requise), une branche supprimée à la fusion.
- Chaque push sur la branche de `elearn-app` déclenche le workflow `Contrôles et EAS preview` : un push annule l'OTA précédente. On regroupe les commits et on attend la fin d'un run avant d'en pousser un autre.

## 3. Les rôles

Chaque rôle est tenu par un agent (ou par Benny). Un rôle ne fait pas le travail d'un autre.

### 3.1 Benny (propriétaire)
- Décide le but, valide les maquettes et les décisions de produit, donne le « oui » pour une fusion, un OTA ou une dépense.
- Commit parfois à la main : faire `git pull` avant tout push.
- Configure les comptes et les clés (WhatsApp, réseaux sociaux, Google Play, EAS, Supabase).

### 3.2 Coordinateur
- Reçoit les demandes de Benny, les répartit entre les agents, relaie les messages.
- Ne code pas. Ne tranche pas les choix de Benny.
- Lance les contrôles d'activité et relance les agents bloqués.
- Ne peut pas donner au nom de Benny une approbation (fusion, OTA, dépense) : il la demande.

### 3.3 Chef de projet (PO)
- Tient les issues GitHub de `elearn-app`, `elearn-supabase`, `elearn-site`, `elearn`.
- Tient l'ordre des tâches dans `docs/PRIORITES.md`. C'est la source de l'ordre ; les issues sont la source de l'état.
- Trie les issues avant d'en donner une à un agent. Ne code pas.

### 3.4 Développeur TOEIC
- Implémente le profil TOEIC dans `elearn-app` (branche `kw792g`), et les migrations TOEIC dans `elearn-supabase` (une PR par lot).
- Méthode imposée : **le cahier, puis la maquette, puis le code.**
  1. La règle est écrite dans le cahier TOEIC (`docs/cahiers/cahier-des-charges-toeic-v1.35.md`, section 0.1). Une ligne au journal des changements.
  2. La maquette est à jour (agent design), son identifiant d'écran est repris dans le cahier.
  3. Le code suit, avec le test qui prouve la règle, et l'identifiant d'exigence dans le nom du test ou son commentaire.
- Un écran sans maquette n'est pas codé. Un cas non prévu est écrit dans la section « Questions » du cahier, et on attend la réponse. On n'invente pas.
- Fidélité au design : c'est la seule consigne de forme. Chaque écran de la maquette est implémenté ; aucun écart « parce que c'est plus simple ».
- Vérification avant « conforme » : Expo web, clair et sombre, largeurs 360 et 390 px, captures avec Playwright (les captures vont dans `/mnt/project-files/toeic/verif-web/`).
- Après la vérification : push, puis OTA par le workflow CI (jamais à la main, sauf demande explicite de Benny). Le changelog OTA est mis à jour en base en français et en anglais (règle du 22 octobre : mots simples pour l'élève).
- Les tests sont fournis avec chaque lot.

### 3.5 Manager qualité (contrôle)
- Contrôle chaque lot du dev TOEIC contre la maquette, pas contre sa propre idée.
- Tient le tableau `toeic/revue-ecrans.md` : une ligne ne passe à « oui » que si l'écran est vérifié en Expo web et Playwright, clair et sombre, 360 et 390 px.
- Donne le « conforme » ou la liste des écarts. Il n'écrit pas de code.
- Bloque une livraison qui ne respecte pas la maquette. Le « oui, pousse et lance l'OTA » reste celui de Benny.

### 3.6 Agent design (maquettes)
- Dessine les maquettes en HTML (artifact), clair et sombre, avec la spec écrite à côté. Méthode complète : `docs/methode-agent-design.md`.
- Ne dessine pas à grande échelle sans demande. Surveille Figma de temps en temps et signale les écarts entre Figma, guide et app.
- Pas d'appel Figma sans vérifier le quota (plan Starter : 20 appels par mois). Quota épuisé : aperçu HTML.
- Seules les dépenses (passer Figma en Pro) et les suppressions (fichiers, projets) demandent l'accord écrit de Benny.

### 3.7 Agent contenu
- Tient la banque de questions unique (cahier TOEIC, section « Banque de questions », décision D-49) : une question existe une seule fois et sert partout.
- Audio : ElevenLabs, fichiers sur R2 (bucket `elearnprepa-public`).
- Règle d'ordre : **l'ordre des options à l'écran est l'ordre de l'audio.**
- Relecture avant publication : une question n'arrive en production qu'après relecture.
- Ne publie rien en production sans l'accord de Benny (migration, contenu visible).

### 3.8 Muse
- Autre agent IA, arrivé le 22 octobre 2026 pour travailler en parallèle. Son point de départ est `docs/communication/PROMPT-MUSE.md`.
- Ne touche pas aux écrans TOEIC en cours. Sa première tâche est une issue hors TOEIC, choisie par le chef de projet.
- Suit le même protocole de communication, les mêmes règles de propriété et les mêmes préfixes de commit (`muse:`).

## 4. Déroulé d'une fonctionnalité

1. **Demande** : Benny ou le chef de projet pose la demande (issue ou message).
2. **Cahier** : la règle est écrite ou mise à jour (journal des changements), avec sa date et sa raison.
3. **Maquette** : l'agent design livre la maquette (HTML clair et sombre, états, spec `.md`). Validation de Benny pour un écran nouveau.
4. **Code** : le dev implémente. Test ajouté. `git pull`, puis commit `claude:` ou `muse:`.
5. **Contrôle** : le manager qualité vérifie contre la maquette (Expo web, 360 et 390 px). « Conforme » ou liste d'écarts.
6. **Livraison** : push, OTA si l'app change (CI). Changelog FR et EN en base. Dire à Benny ce que contient l'OTA et quoi tester.
7. **Base** : migration additive dans `elearn-supabase`, PR, CI pgTAP verte, fusion, rapport à Benny (quoi, pourquoi, tests passés, risque, retour arrière).

## 5. Risques connus (pièges)

- **Une migration ne se pose jamais avec un horodatage inférieur à ce que la production a déjà appliqué** : `supabase db push` refuse toute la file. Vérifier `supabase_migrations.schema_migrations` avant de choisir son préfixe.
- **Remplacer une fonction PostgreSQL en ajoutant un paramètre** ne supprime pas l'ancienne signature : les deux coexistent. Il faut un `drop function if exists` explicite.
- **Une suppression en production se compte d'abord** (cascades) et se sauvegarde avant. Incident du 21 octobre 2026 à Bénin : une fusion de classes doublons a supprimé en cascade 507 documents, 63 dossiers, 15 paiements, 8 groupes et une inscription. Récupération par la sauvegarde R2 ; la réinjection attend l'accord de Benny.
- **Les branches divergent vite.** Vérifier avant de conclure : `git rev-list --left-right --count origin/main...origin/<branche>`. Les branches ne cumulent pas deux implémentations concurrentes.
- **Un module natif** doit être compilé dans l'APK installé avant d'être importé (AGENTS.md section 17). Sinon l'OTA fait planter l'app au démarrage.
- **Expiration hors ligne** : toute lecture d'une clé de contenu local passe par `lireLocalHorsLigne()` (AGENTS.md section 16 bis).
- **Dates dans les tests** : figer l'horloge. Un test qui dépend du jour casse le CI le lendemain.
- **Vercel est strict sur ESLint** (`elearn-site`) : une apostrophe non échappée bloque le déploiement.
- **Chronomètre et crédits** : les montants (crédits, durées, coûts) viennent de la configuration serveur, jamais d'une valeur figée dans le code ou les tests.

## 6. Mise à jour de ce document

- Une règle de Benny nouvelle est ajoutée ici avec sa date, et dans `docs/REGLES_BENNY.md`.
- Un rôle qui change de périmètre est mis à jour ici et dans `docs/communication/EN-COURS.md`.
- Ce document ne contient aucun secret, aucun chiffre financier confidentiel (le dépôt est public) et aucun identifiant de modèle.
