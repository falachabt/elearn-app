# Paiement Chariow (complément à pawaPay)

pawaPay ne couvre qu'une poignée de pays. **Chariow** ([chariow.dev](https://chariow.dev/en/introduction/overview)) prend le relais pour les paiements que pawaPay ne sait pas encaisser, en particulier **sur la version web**.

## Où est la clé

- **Clé API** (`sk_…`, 44 caractères) : `CHARIOW_API_KEY` dans `elearn-app/.env.local` (fichier ignoré par git).
- ⚠️ C'est une **clé secrète** : elle ne doit **jamais** partir dans le client web ni dans l'application. Elle sert au **backend** (Edge Functions Supabase), comme les clés pawaPay. À poser aussi en secret Supabase.
- Elle avait d'abord été mise à la racine de `Elearn Apps/.env` sous `cariow_api_key` (nom mal orthographié, mauvais endroit) : la ligne a été retirée.

## Ce que la clé permet (vérifié)

```bash
GET https://api.chariow.com/v1/store      # -> "Elearn Prepa", boutique active
GET https://api.chariow.com/v1/products   # -> les trois pass
```

| Pass (code app) | Produit Chariow | ID | Prix affiché |
| --- | --- | --- | --- |
| `week` | Pass semaine | `prd_c3zgo87t` | 599 FCFA |
| `month` | Pass mois | `prd_un7h0sd1` | 2 499 FCFA |
| `contest` | Pass Concours | `prd_sanxpmoa` | 7 499 FCFA |

Autres ressources lisibles : `/customers`, `/sales`, `/licenses`, `/discounts`, `/pulses`.

⚠️ **Les prix Chariow ne correspondent pas à ceux de `pass_prices`** (500 / 2 500 / 7 500 FCFA) : à aligner, sinon un élève paie 599 FCFA pour le pass semaine au lieu de 500.

## API

- Base : `https://api.chariow.com/v1`
- Authentification : `Authorization: Bearer <clé API>`
- Réponse : `{ "message", "data", "errors" }`

### Créer un paiement — `POST /v1/checkout`

Champs **obligatoires** : `product_id`, `email`, `first_name`, `last_name`, `phone.number`, `phone.country_code`.

Champs utiles pour nous :

| Champ | Usage |
| --- | --- |
| `custom_metadata` | **10 clés max, 255 caractères par valeur**, renvoyées dans les webhooks : c'est **le** moyen de relier la vente au compte de l'élève (`user_id`) et au pass (`product_code`). |
| `redirect_url` | Retour sur notre page après paiement (`https://app.elearnprepa.com/...`). |
| `customer_ip` | IP de l'acheteur (l'appel venant de notre serveur, Chariow verrait sinon notre IP) : détermine les moyens de paiement affichés et le pays de la vente. |
| `payment_currency` | Devise (ISO 4217). |

Réponse : `data.step` vaut

- **`payment`** → rediriger l'élève vers `data.payment.checkout_url` ;
- **`completed`** → produit gratuit, c'est fini ;
- **`already_purchased`** → l'élève possède déjà le produit.

Les ventes créées par l'API portent le canal **« API »** dans le dashboard. Les produits de type **licence** (les nôtres) sont **achetables plusieurs fois** — indispensable pour un pass qui se rachète.

### Être prévenu — les « Pulses » (webhooks)

Un Pulse s'enregistre dans le dashboard (**Automations → Pulses → Add Pulse**) : URL **HTTPS obligatoire**, évènements choisis, produits éventuellement filtrés. L'API ne permet que de les **lire** (`GET /v1/pulses`, `GET /v1/pulses/{id}`), pas de les créer.

Évènements : `successful.sale`, `abandoned.sale`, `failed.sale`, `license.activated`, `license.expired`, `license.issued`, `license.nearing_expiry`, `license.revoked`, `affiliate.joined`.

En-têtes de chaque livraison :

| En-tête | Contenu |
| --- | --- |
| `x-chariow-signature` | `sha256=<hex>` — HMAC-SHA256 du **corps brut** |
| `x-pulse-id` | identifiant du Pulse |
| `x-pulse-delivery-id` | **clé d'idempotence** (stable entre les tentatives) |
| `x-pulse-event` | nom de l'évènement |

**Signature** : HMAC-SHA256 sur les **octets bruts du corps**, avec le **secret de signature du Pulse** (`whsec_…`, propre à chaque Pulse, visible dans *Automations → Pulses → le Pulse → Overview → Signing secret*). Ce secret n'est **pas** la clé API et n'en dérive pas. Il faut donc **lire le corps brut avant tout parsing** : re-sérialiser le JSON casse le HMAC (Chariow échappe les `/` en `\/` et les caractères non-ASCII en `\uXXXX`).

**Réessais** : 5 tentatives (10 s, 100 s, ~17 min, ~2 h 47). ⚠️ **Après 5 échecs, le Pulse est désactivé automatiquement** et il faut le réactiver à la main dans le dashboard — d'où l'importance de répondre **200 rapidement** (< 30 s) et de ne jamais renvoyer d'erreur pour un évènement qu'on ignore.

**Rejeu** : l'onglet *Deliveries* permet de rejouer une livraison (nouvel `x-pulse-delivery-id`, donc retraitée : c'est voulu).

## Intégration (faite)

Règle produit : **si le pays de l'élève n'est pas payable par pawaPay, on lui propose Chariow**. Sur le web les deux
sont proposés (les règles d'Apple ne s'y appliquent pas) ; sur Android le Mobile Money reste la voie normale ; sur iOS
ni l'un ni l'autre (achat intégré Apple).

```
1. create_order(pays, provider := 'chariow')   → une commande `orders`, comme un dépôt Mobile Money
2. POST /v1/checkout (Chariow)                 → custom_metadata = { order_id }   ← le lien avec l'élève
3. l'élève paie sur la page Chariow            → redirect_url vers /offres/retour
4. Pulse « successful.sale »                   → record_deposit_result(order_id, 'completed')
                                                 → droit + reçu + notification + historique
```

1. **Migration `20261009150000_paiement_chariow.sql`** (additive) : `pass_products.chariow_product_id` ;
   `create_order_base` et son enveloppe `create_order` acceptent `p_provider` (défaut `pawapay`, donc le back-office
   ne change pas) ; **repli de prix réservé à Chariow** pour un pays hors zone XAF/XOF ; `record_deposit_result`
   journalise le vrai fournisseur.
2. **Edge Function `chariow-checkout`** (JWT conservé) : crée la commande, appelle Chariow, renvoie `checkout_url`.
3. **Edge Function `chariow-webhook`** (publique, `verify_jwt = false`) : vérifie la signature du **corps brut**,
   déduplique sur la vente, met la commande à jour.
4. **Application** : `src/services/chariow.ts` appelle la fonction ; `PayerPass` propose « Payer par carte » quand le
   pays n'est pas payable ; `src/app/offres/retour.tsx` affiche le résultat au retour de Chariow.

Secrets Supabase posés : `CHARIOW_API_KEY` et `CHARIOW_WEBHOOK_SECRET`.

## À faire côté Benny

1. **Aligner les prix** Chariow sur `pass_prices` (500 / 2 500 / 7 500 FCFA) — l'API Chariow ne fait que lire les
   produits, la modification se fait dans le dashboard.
2. Rien d'autre : le Pulse est créé (`pulse_x9pevzes33z4`, tous les évènements) et les secrets sont posés.
