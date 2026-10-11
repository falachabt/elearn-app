# TODO — travail en attente

Points identifiés, vérifiés, et volontairement **non traités**. Chacun dit quoi faire, pourquoi, et où.

---

## 1. Option A : télécharger le contenu payant sans le débiter (issue #13) — FAIT

**Fait côté serveur et côté app.** Préparer le hors ligne ne coûte plus rien : le contenu est téléchargé, rangé
**verrouillé**, et le crédit est consommé à la première consultation.

### Serveur (migration `20261005233000`, en production)

`credit_content_for_download(p_action, p_ref)` sert le contenu **sans débiter et sans marquer le déblocage**, et
**vérifie le droit d'accès** : coût nul, déjà débloqué, premier sujet gratuit du concours, ou couvert par un pass.
`depenser_credits` reste la seule porte du débit.

**Décision du 6 octobre 2026 : la vérification d'accès est CONSERVÉE.** Une variante qui l'aurait retirée (le serveur
servant tout, le client facturant) a été écrite puis abandonnée : elle transformait la protection en simple code
client. La vérification serveur est le socle sécurisé, on ne le contourne pas.

### App

- `telechargerContenuPayant()` appelle `credit_content_for_download` et range le contenu avec **`paye: false`** ;
- `horsLigne.ts` n'appelle plus `depenser` pour les corrigés et les PDF ;
- à la consultation, un contenu verrouillé est débité du solde local (opération mise en file) puis marqué payé ;
  sans solde suffisant il est refusé, jamais affiché gratuitement ;
- avec un pass, il devient lisible sans débit ;
- `paye` est **défaut à vrai**, pour que les contenus rangés par l'ancien chemin (qui débitait) restent lisibles.

### Limite connue

Un contenu **payant jamais débloqué** n'est pas téléchargeable : le serveur le refuse, et c'est voulu. La préparation
ne rapatrie donc que ce à quoi l'élève a déjà droit, plus ce que couvre un pass. Les PDF restent par ailleurs sur un
bucket public — voir §6.


---

## 2. Afficher l'état « solde non confirmé » (issue #13)

`depensesEnAttente` est calculé dans `CreditsProvider`, exposé par `useDepenseCredits` sous le nom `enAttente`, et
**aucun écran ne l'utilise**. Or l'issue #13 demande explicitement de « prévoir un état clair lorsque des dépenses
restent à synchroniser », et de ne jamais présenter un solde local comme confirmé par le serveur.

À faire : afficher cet état là où le solde apparaît (`CompteurCredits`, `FeuilleDetailCredits`, écran crédits). Le
message doit être explicite : solde connu, encore à confirmer.

---

## 3. Déduplication des opérations hors ligne trop large

`ajouterDepenseEnAttente` (`src/services/creditsHorsLigne.ts`) déduplique sur `(action, objet)` sans tenir compte du
temps. C'est correct pour un contenu déblocable **une fois**, mais faux pour `quiz_explanation`, facturée **à chaque
consultation** : deux consultations légitimes du même justificatif ne produisent qu'une seule opération en file.

À faire : fonder la déduplication sur l'identifiant d'opération (`id`, qui porte déjà l'horodatage) plutôt que sur le
couple action/objet.

---

## 4. Cadence de sondage réseau : filet de sécurité

`INTERVALLE_EN_LIGNE_MS` est à 10 s en repli, pour le cas d'un binaire **sans** `expo-network`. Avec le module natif
(reconstruit), la perte de réseau est signalée par le système en moins d'une seconde et cette cadence ne sert plus
que de filet. À rouvrir si la consommation de données devient un sujet : une sonde coûte ~1,6 Ko.

---

## 5. Déploiement Supabase manuel : mot de passe à corriger

`PRODUCTION_DB_PASSWORD` dans `elearn-supabase/.env.local` est **refusé par la production** (SQLSTATE 28P01,
reproduit en `psql` direct sur le pooler). Le mot de passe valide se trouve ailleurs dans l'espace de travail. Tant
que ce n'est pas corrigé, tout déploiement manuel bute dessus.

Procédure qui fonctionne, à réutiliser :

```
npx --yes supabase@2.118.0 test db     # doit passer à 100 % AVANT tout déploiement
npx --yes supabase@2.118.0 db push
```

Deux pièges à retenir : la CLI locale (1.226.4) est trop ancienne pour le `config.toml` du dépôt — utiliser la
version du CI (2.118.0) ; et **ne pas exporter `SUPABASE_PROJECT_ID`** pour les commandes locales, car la CLI nomme
alors le réseau Docker d'après ce ref et échoue.

---

## 6. PDF payants : protégés par rien (constaté le 5 octobre 2026)

**Décision de Benny : on laisse les documents comme ils sont.** Constat gardé pour mémoire, aucune action prévue.

Les PDF ne sont pas dans Supabase Storage : ils sont sur **Cloudflare R2, dans un bucket public** (`pub-…r2.dev`).
Vérifié empiriquement : l'adresse d'un document réellement servi répond **200 sans aucun identifiant**, 155 710 octets
téléchargés.

Conséquence : l'adresse d'un PDF payant n'est pas un secret. `credit_content_for_download` peut la retenir tant que
l'élève n'a pas payé, mais dès qu'elle est servie elle est publique — présente dans le bundle, les journaux réseau, le
cache. Par ailleurs Cloudflare indique que les domaines `r2.dev` sont limités en débit et **ne doivent pas servir du
trafic de production**.

Remédiation possible si le sujet devient sensible : rendre le bucket privé et servir les fichiers par **URL signée**
(il faudrait alors migrer les fichiers et invalider les adresses stockées dans `secondary_documents.download_url`).
C'est un chantier d'hébergement, pas de code d'app.

**À ne pas confondre avec les corrigés d'exercices** : leur texte est en base et passe par `credit_content_for_download`,
qui **vérifie le droit d'accès** côté serveur. Ceux-là sont réellement protégés.

---

## 7. App Links cassés : `assetlinks.json` n'est pas servi (vérifié le 5 octobre 2026)

Les fichiers existent dans `public/.well-known/` (`assetlinks.json` et `apple-app-site-association`) et sont bien
versionnés, mais **ils ne sont pas servis** — or c'est par le réseau qu'Android et iOS les vérifient, pas depuis
l'APK. Les embarquer dans le binaire ne sert donc à rien.

Constat mesuré :

| URL | Réponse |
| --- | --- |
| `app.elearnprepa.com/.well-known/assetlinks.json` | 200, mais **`text/html`** — c'est le fallback SPA de l'app web Expo |
| `app.elearnprepa.com/.well-known/apple-app-site-association` | 200, mais **`text/html`** |
| `elearnprepa.com/.well-known/assetlinks.json` | **404** |

Conséquence : la vérification des App Links échoue, donc les liens `https://app.elearnprepa.com/…` s'ouvrent dans le
navigateur au lieu de l'application. Les commits `974f671` et `5d8996e` (« ouvrir les liens https de
app.elearnprepa.com dans l'application ») ne peuvent pas produire leur effet.

Exigences à satisfaire : HTTPS, type `application/json`, **sans redirection**, contenu JSON. Le domaine
`app.elearnprepa.com` sert aujourd'hui l'app web Expo, qui répond son HTML pour tout chemin inconnu : il faut servir
`/.well-known/*` **avant** le fallback. `elearn-site` (le site Next.js) n'a aucun dossier `.well-known`.

**Hébergement : pris en charge par Benny, ne pas y toucher depuis le code.**
