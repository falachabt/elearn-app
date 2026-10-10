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

### 2.3 Créer l'agent IA et configurer l'accès en lecture à la base — **fait, sans MCP**

- L'agent est en service : `supabase/functions/_shared/support_agent.ts` (boucle d'outils), `support.ts` (base de connaissances), `whatsapp_ui.ts` (listes, boutons, liens), `support_politesse.ts` (silences, clôtures, accents), `support_jev.ts` (forme de la réponse), fonction `support-auth-answer`, écran `/support-confirmer` dans l'application.
- **Il n'y a pas de serveur MCP.** L'accès en lecture à la base passe par des fonctions SQL `security definer` exposées au modèle comme outils (`mes_paiements`, `mon_pass`, `support_tool_*`), appelées par `rpc` depuis l'Edge Function. Le résultat est le même — lecture seule, cloisonnée par compte — avec une surface d'attaque plus petite qu'un serveur MCP joignable.
- **Décision de Benny (10 octobre 2026) : pas de serveur MCP.** On garde cette approche. La case de l'issue est donc tranchée.

### 2.4 Créer les Templates Meta pour factures et rapports — **partiel**

État réel des modèles dans le WABA `1613624570492818` :

| Modèle | Catégorie | Statut | Usage | Envoi réel |
| --- | --- | --- | --- | --- |
| `resume_hebdo_parent` | UTILITY | APPROVED | résumé du lundi aux parents | **échoue (131042)** |
| `recu_paiement` | UTILITY | APPROVED | reçu / confirmation de paiement | **échoue (131042)** |
| `alerte_equipe_support` | UTILITY | APPROVED | alerte interne à l'équipe | **échoue (131042)** |
| `rapport_hebdo_parent` | UTILITY | PENDING (créé le 10 octobre) | résumé du lundi enrichi, bouton vers la page web | en revue chez Meta |
| `demande_paiement_parent` | UTILITY | PENDING (créé le 10 octobre) | demande de paiement au parent, bouton « Payer maintenant » | en revue chez Meta |
| `facture_paiement` | UTILITY | PENDING (créé le 10 octobre) | reçu + bouton « Télécharger la facture » (PDF) | en revue chez Meta |
| `code_connexion` | AUTHENTICATION | **refusé à la création** | code de connexion (OTP) | **abandonné** (décision de Benny, 10 octobre 2026) |

Points d'attention :

- **Facture** : faite, sous forme de **vrai PDF** rendu par le site sur `/facture/<jeton>` (PR elearn-site #21), avec un bouton dans le message au lieu d'une pièce jointe. Un en-tête `DOCUMENT` dans le modèle aurait demandé l'API Resumable Upload de Meta, que Kapso n'expose pas ; le lien marche et donne le même résultat pour le parent.
- **Modèle OTP : abandonné pour le moment** (décision de Benny, 10 octobre 2026). Meta exige **deux** conditions, et aucune des deux n'est remplie : portefeuille d'entreprise Meta **vérifié**, et plafond d'envoi **≥ 2 000** (le WABA est en `TIER_250`).

  Erreur exacte renvoyée le 10 octobre 2026 :
  `code 10, subcode 2388185 — "This WhatsApp business account does not have permission to create message template"`.

  À noter : la création de modèles **UTILITY fonctionne** sur ce même WABA (la preuve : `demande_paiement_parent` a été créé). Le refus est bien propre à la catégorie `AUTHENTICATION`.

- **Résumé hebdomadaire enrichi** : `rapport_hebdo_parent` (en-tête de texte, corps lisible, bouton **Voir le détail** vers `https://elearnprepa.com/parent/<jeton>`), la page web, l'image de marque et le jeton : **livré**. Envoi prévu le **dimanche à 14 h (Douala)**, sur la semaine en cours.
- **En-tête d'image : écarté** (décision de Benny, 10 octobre 2026). L'API Kapso n'expose pas l'API Resumable Upload de Meta, donc un modèle à en-tête `IMAGE` n'est pas créable par l'API. On envoie **le lien seul, sans image** ; `_image` reste supporté dans le code pour plus tard.

### 2.5 Intégrer le SDK `@kapso/whatsapp-cloud-api` dans les processus métiers — **fait autrement**

Le SDK n'est pas utilisé. Les Edge Functions appellent l'API REST de Kapso directement (`fetch`), sans dépendance : `functions/_shared/whatsapp.ts` (modèles), `whatsapp_ui.ts` (messages libres), `support.ts` (historique, médias). Choix cohérent avec Deno/Edge Functions (pas de `node_modules`, pas de version à maintenir). À acter dans l'issue.

## 3. Ce qui bloque, et qui dépend de Benny

| # | Blocage | Impact | Action |
| --- | --- | --- | --- |
| B1 | **Devise du compte WhatsApp Business non configurée** (`131042`) | **Aucun modèle n'est délivré** : résumés parents, reçus, alertes internes, demande de paiement | Voir la section « Devise » ci-dessous : l'API Kapso refuse, il faut passer par un écran |
| B3 | **Plafond d'envoi `TIER_250`** | Suffit pour le volume actuel ; bloquerait un jour un modèle d'authentification | À relever seulement si le besoin revient |
| B4 | **Numéro américain** (+1 201) pour un public camerounais | Confiance : le message vient d'un numéro étranger inconnu | **Décision du 10 octobre 2026 : on garde ce numéro pour le moment**, on changera plus tard, sans refaire la tuyauterie |
| B5 | **Liste blanche `WHATSAPP_ALLOWLIST`** | Les clients hors liste ne reçoivent qu'un message d'attente | Un message de repli est en place ; l'ouverture complète reste ta décision |

### Devise : ce qui a été vérifié, et pourquoi l'API ne suffit pas

L'enquête menée le 10 octobre 2026 donne la cause exacte : `GET /platform/v1/whatsapp/accounts/1613624570492818/funding` répond
`status: not_funded`, `reason: funding_not_started`, **`waba_currency: null`**. Le compte n'a donc aucune devise, et Meta
refuse tout envoi de modèle.

Deux chemins, tous les deux hors de portée d'un agent :

1. **Carte bancaire chez Meta** (Billing Hub) — c'est Benny qui saisit le moyen de paiement. C'est le chemin recommandé.
2. **Crédits Kapso** (Kapso paie Meta et débite les crédits du projet) — à activer depuis la carte « WhatsApp billing » du
   tableau de bord Kapso. L'API refuse : `POST /platform/v1/whatsapp/accounts/{waba}/funding` répond **409
   « Exactly one active external MPS solution is required »**, ce projet n'ayant pas de solution multi-partenaires externe.
   Attention : ce mode exige des crédits Kapso positifs, sinon les envois (y compris les réponses du support) sont mis en
   pause.

Rien n'est à faire dans le dépôt pour ce point.

### Secrets : posés en production le 10 octobre 2026

- `PARENT_SEND_TOKEN` (secret d'Edge Function) et `parent_send_token` (Vault) : jeton dédié de 64 caractères, créé et
  posé. Le cron `parent-outbox-send` l'utilise ; il ne permet que de vider la file des parents.
- Le mode fictif n'est plus dupliqué dans le Vault : c'est l'Edge Function qui refuse de vider la file quand l'appel
  vient du cron et que `WHATSAPP_MODE` n'est pas `reel`.


## 4. Travail restant, faisable sans Benny

| # | Tâche | État |
| --- | --- | --- |
| T1 | Planifier l'envoi de la file (`parent-message-send`) : le cron remplit `parent_outbox`, aucun cron ne la vidait | **fait** — cron `parent-outbox-send` toutes les 5 minutes, avec le jeton `PARENT_SEND_TOKEN` posé en production. En mode fictif, l'Edge Function refuse de vider la file (sinon les messages seraient perdus) |
| T2 | Modèle `demande_paiement_parent` (demande de paiement au parent, bouton « Payer maintenant ») | **créé** (en revue). Le branchement demande de recueillir le numéro du parent dans l'application : c'est l'issue #14, pas #29 |
| T3 | Rapport hebdomadaire parent enrichi : page web consultable, jeton, nouveau modèle, envoi le dimanche à 14 h | **fait** (PR elearn-supabase #83, elearn-site #20). En-tête image écarté par décision : on envoie le lien seul |
| T4 | Message de repli pour les numéros hors liste blanche | **fait** (secret `SUPPORT_HORS_LISTE`) |
| T5 | Audit des conversations de l'agent et corrections associées | **fait** : `docs/audit-conversations-support.md`, garde-fou anti-répétition, reprise du pays choisi |
| T6 | Facture en pièce jointe (PDF) | **fait** — la facture est un **vrai PDF** rendu par le site sur `/facture/<jeton>` (PR elearn-site #21), et le reçu WhatsApp porte un bouton « Télécharger la facture » (modèle `facture_paiement`, PR elearn-supabase #83). Pas d'en-tête `DOCUMENT` dans le modèle : le PDF est derrière un lien, ce que l'API Kapso permet de bout en bout |
| T7 | Corriger la documentation du `phone_number_id` | **fait** |
| T8 | Décision MCP | **tranchée** : pas de serveur MCP (décision de Benny, 10 octobre 2026) |
| T9 | Un client hors liste de recette ne reçoit qu'un message d'attente : décider quand ouvrir à tous | à trancher |
| T10 | Reprise d'un changement de parcours interrompu par une panne du modèle | **fait** — le pays choisi est noté côté serveur (`support_sessions.pending_action`, 30 minutes) et rappelé au modèle, qui ne le redemande plus |


## 5. Fichiers de référence

- `elearn-supabase/docs/whatsapp-kapso.md` — mise en service de l'envoi.
- `elearn-supabase/docs/support-agent.md` — fonctionnement complet de l'agent.
- `elearn-supabase/docs/audit-conversations-support.md` — audit des conversations du 8 au 10 octobre 2026.
- `elearn-app/docs/etude-connexion-whatsapp.md` — étude de la connexion par WhatsApp (OTP).
