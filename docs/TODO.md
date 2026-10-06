# TODO — travail en attente

Points identifiés, vérifiés, et volontairement **non traités**. Chacun dit quoi faire, pourquoi, et où.

---

## 1. Option A : télécharger le contenu payant sans le débiter (issue #13)

**Décision d'architecture prise, implémentation reportée.** L'élève doit pouvoir télécharger un corrigé ou un PDF
**sans consommer de crédits** : le fichier est présent sur l'appareil, mais l'accès reste **verrouillé** localement
tant que les crédits n'ont pas été consommés. S'il consomme, on débite ; s'il a épuisé ses crédits théoriques, il est
limité et doit se reconnecter.

### Le blocage à résoudre

Le serveur ne livre **jamais** de contenu payant hors de la transaction de débit. C'est une décision explicite du
projet (« seule porte vers le contenu payant ») :

| Fonction | Ce qu'elle expose | Ce qu'elle cache |
| --- | --- | --- |
| `exercise_detail` | `has_correction: bool` | le corrigé |
| `class_documents` | nom, type, taille, `correction_id` | l'adresse du PDF et celle du corrigé |
| `exam_paper` | sujet, `has_correction`, `correction_free` | la correction |
| `depenser_credits` | **le contenu**, mais débite et marque le déblocage | — |

Donc « télécharger sans payer » exige une **lecture seule côté serveur** qui n'existe pas encore.

### Piste retenue

Ajouter une fonction de lecture seule, par exemple `credit_content_for_download(p_action, p_ref)`, qui renvoie le
contenu **sans débiter et sans marquer le déblocage**. Côté app, `enregistrerContenuEnCache` gagnerait un drapeau
« payé » à côté du contenu, et `creditsHorsLigne` refuserait d'afficher un contenu dont le drapeau est faux tant que
la dépense n'a pas eu lieu.

### Ce qu'il faut accepter en connaissance de cause

Cette voie **affaiblit la protection actuelle** : aujourd'hui, il est impossible d'obtenir un corrigé sans payer.
Avec A, le contenu transite vers l'appareil sans paiement, et la seule barrière devient le code client. Une
réinstallation remet le verrou local à zéro. C'est un choix de produit assumé, pas un oubli.

### État actuel (à ne pas confondre)

Le mode hors ligne **fonctionne** aujourd'hui, mais avec une autre règle : le débit a lieu **au téléchargement**
(`src/services/horsLigne.ts`, appels `depenser('exercise_solution', …)` et `depenser('document_pdf', …)`). C'est ce
comportement que l'option A remplacera.

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

## 6. App Links cassés : `assetlinks.json` n'est pas servi (vérifié le 5 octobre 2026)

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
