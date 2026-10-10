# Issue 29 — Intégration WhatsApp Business via Kapso : état des lieux

Issue de référence : [falachabt/elearn-app#29](https://github.com/falachabt/elearn-app/issues/29).
Constat au **10 octobre 2026**, vérifié dans le code, dans la base de production et dans l'API Kapso.

## 1. Réponse courte

L'agent support est **en service et abouti** (il répond à de vrais clients, dans la fenêtre de 24 h). Le reste de l'issue est **bloqué par un réglage Meta** : la devise du compte WhatsApp Business n'est pas configurée, donc **aucun modèle n'est délivrable**. Tant que ce point n'est pas réglé, les rapports parents et les reçus de paiement ne partiront pas, même si tout le reste est terminé.

Deux autres chantiers restent ouverts : le **template OTP** (refusé par Meta, deux conditions non remplies) et la **facture en pièce jointe** (aucun modèle, aucun PDF produit).

## 2. Les tâches de l'issue

### 2.1 Créer le projet final sur Kapso et lier le numéro WhatsApp Meta officiel — **fait**

- Numéro de production : `phone_number_id` **`1270500312823859`**, `+1 201-534-8324`, WABA `1613624570492818`, `display_name` « Elearn Prepa », qualité **GREEN**, webhook vérifié le 7 octobre 2026, `code_verification_status: VERIFIED`.
- Plafond d'envoi : **`TIER_250`** (250 conversations par jour) — à relever si la montée en charge l'exige.
- Un second numéro (`1387709354423791`, `+1 201-534-2417`) existe sur le même WABA, non branché sur l'API Cloud.
- **Piège documentaire** : `docs/etude-connexion-whatsapp.md` (§2.2) donne `597907523413541` comme numéro de production. C'est le **bac à sable** Kapso. À corriger.

### 2.2 Mettre en place le serveur Webhook de production — **fait**

`https://yhznbitjlzeslvudbsil.supabase.co/functions/v1/whatsapp-webhook`, signature `X-Webhook-Signature` vérifiée, idempotence `X-Idempotency-Key`, réponse 200 immédiate et traitement en tâche de fond (`EdgeRuntime.waitUntil`). Statuts `sent` / `delivered` / `read` / `failed` appliqués à `parent_outbox`, `STOP` = désinscription.

### 2.3 Créer l'agent IA et configurer le serveur MCP (lecture DB) — **fait autrement, à confirmer**

- L'agent est en service : `supabase/functions/_shared/support_agent.ts` (boucle d'outils), `support.ts` (base de connaissances), `whatsapp_ui.ts` (listes, boutons, liens), `support_politesse.ts` (silences, clôtures, accents), `support_jev.ts` (forme de la réponse), fonction `support-auth-answer`, écran `/support-confirmer` dans l'application.
- **Il n'y a pas de serveur MCP.** L'accès en lecture à la base passe par des fonctions SQL `security definer` exposées au modèle comme outils (`mes_paiements`, `mon_pass`, `support_tool_*`), appelées par `rpc` depuis l'Edge Function. Le résultat est le même — lecture seule, cloisonnée par compte — avec une surface d'attaque plus petite qu'un serveur MCP joignable.
- **Décision à prendre** : on garde cette approche (recommandé : elle est en production et testée) ou on ouvre un vrai serveur MCP. Tant que ce n'est pas tranché, la case de l'issue reste ambiguë.

### 2.4 Créer les Templates Meta pour factures et rapports — **partiel**

État réel des modèles dans le WABA `1613624570492818` :

| Modèle | Catégorie | Statut | Usage | Envoi réel |
| --- | --- | --- | --- | --- |
| `resume_hebdo_parent` | UTILITY | APPROVED | résumé du lundi aux parents | **échoue (131042)** |
| `recu_paiement` | UTILITY | APPROVED | reçu / confirmation de paiement | **échoue (131042)** |
| `alerte_equipe_support` | UTILITY | APPROVED | alerte interne à l'équipe | **échoue (131042)** |
| `lien_paiement_parent` | UTILITY | PENDING (créé le 10 octobre) | lien de paiement au parent | en revue chez Meta |
| `code_connexion` | AUTHENTICATION | **refusé à la création** | code de connexion (OTP) | impossible aujourd'hui |

Ce qui manque encore :

- **Facture en pièce jointe** : aucun modèle avec en-tête `DOCUMENT`, et **aucun PDF de facture n'est produit** dans le dépôt (aucune trace de `facture`/`invoice` dans les migrations). Le reçu existe sous forme de texte (`recu_paiement` : produit, montant, devise, numéro de reçu) et le numéro de reçu vient de `orders.receipt_no`.
- **Modèle OTP** : refusé. Meta exige **deux** conditions, et aucune des deux n'est remplie :
  1. portefeuille d'entreprise Meta **vérifié** ;
  2. plafond d'envoi **≥ 2 000** (Tier 1). Le WABA est en `TIER_250`.

  Erreur exacte renvoyée le 10 octobre 2026 :
  `code 10, subcode 2388185 — "This WhatsApp business account does not have permission to create message template"`.

  À noter : la création de modèles **UTILITY fonctionne** sur ce même WABA (la preuve : `lien_paiement_parent` a été créé). Le refus est bien propre à la catégorie `AUTHENTICATION`.

- **Résumé hebdomadaire enrichi** (demande de Benny du 10 octobre) : nouveau modèle avec **en-tête image** et **bouton vers une page web** consultable, plus la page elle-même. En chantier.

### 2.5 Intégrer le SDK `@kapso/whatsapp-cloud-api` dans les processus métiers — **fait autrement**

Le SDK n'est pas utilisé. Les Edge Functions appellent l'API REST de Kapso directement (`fetch`), sans dépendance : `functions/_shared/whatsapp.ts` (modèles), `whatsapp_ui.ts` (messages libres), `support.ts` (historique, médias). Choix cohérent avec Deno/Edge Functions (pas de `node_modules`, pas de version à maintenir). À acter dans l'issue.

## 3. Ce qui bloque, et qui dépend de Benny

| # | Blocage | Impact | Action |
| --- | --- | --- | --- |
| B1 | **Devise du compte WhatsApp Business non configurée** (`131042`) | **Aucun modèle n'est délivré** : résumés parents, reçus, alertes internes, futurs liens de paiement et OTP | Configurer la devise dans Meta Business : <https://business.facebook.com/billing_hub/accounts/details/?business_id=2907923766070747&asset_id=1613624570492818&wizard_name=CHANGE_COUNTRY_CURRENCY&account_type=whatsapp-business-account> |
| B2 | **Vérification d'entreprise Meta** non faite | Refus de créer le modèle `code_connexion` | Lancer la vérification (gratuite, quelques jours) |
| B3 | **Plafond d'envoi `TIER_250`** | Bloque aussi les modèles d'authentification (il faut ≥ 2 000) | Monter le palier après vérification |
| B4 | **Numéro américain** (+1 201) pour un public camerounais | Confiance : le message vient d'un numéro étranger inconnu | Décider si on demande un numéro local à Kapso |
| B5 | **Liste blanche `WHATSAPP_ALLOWLIST`** | Deux clients réels (Manuella Sephora, Kaaga Djongmo) sont restés sans réponse le 8 octobre | Un message de repli est ajouté ; l'ouverture complète reste ta décision |

## 4. Travail restant, faisable sans Benny

| # | Tâche | État |
| --- | --- | --- |
| T1 | Planifier l'envoi de la file (`parent-message-send`) : le cron `parent-summary` remplit `parent_outbox` le lundi, mais **aucun cron ne vide la file**. Aujourd'hui, elle ne part que sur appel manuel | à faire |
| T2 | Template `lien_paiement_parent` (créé) puis branchement dans le flux de lien de paiement | créé, branchement à faire |
| T3 | Rapport hebdomadaire parent enrichi : page web consultable + image de marque + nouveau modèle | en chantier |
| T4 | Message de repli pour les numéros hors liste blanche | à faire |
| T5 | Audit des conversations de l'agent et corrections associées | fait : `docs/audit-conversations-support.md` |
| T6 | Facture en pièce jointe (PDF + modèle `DOCUMENT`) | à décider : utile seulement si la facture est un vrai document attendu |
| T7 | Corriger la documentation du `phone_number_id` | à faire |
| T8 | Décision MCP (voir 2.3) | à trancher |

## 5. Fichiers de référence

- `elearn-supabase/docs/whatsapp-kapso.md` — mise en service de l'envoi.
- `elearn-supabase/docs/support-agent.md` — fonctionnement complet de l'agent.
- `elearn-supabase/docs/audit-conversations-support.md` — audit des conversations du 8 au 10 octobre 2026.
- `elearn-app/docs/etude-connexion-whatsapp.md` — étude de la connexion par WhatsApp (OTP).
