# Fiche factuelle — Tarification WhatsApp Business Platform, catégorie AUTHENTICATION

**Périmètre** : OTP de connexion (code 6 chiffres), template de catégorie `authentication`, envoyé via Kapso (proxy revendeur de l'API Cloud WhatsApp de Meta).
**Marchés visés** : Cameroun, Côte d'Ivoire, Sénégal, Gabon, Burkina Faso, RD Congo, France.
**Date de la recherche** : 9 octobre 2026. **Grille tarifaire en vigueur** : rate card Meta **effective 1er octobre 2026**.

> ⚠️ **Le modèle a bougé depuis juillet 2025.** La prémisse de la question (« tarification par message introduite en juillet 2025 : ce qui reste en conversation ») n'est plus exacte en octobre 2026 : les messages **service** sont devenus facturables le 1er octobre 2026, et **tout** est désormais facturé au message. Détail en §1 et §3.

---

## 1. Modèle de tarification actuel de Meta

### 1.1 Confirmations

| Affirmation | Statut | Source |
|---|---|---|
| Passage d'un modèle « par conversation 24 h » à un modèle **par message livré** | ✅ **Confirmé**, effectif **1er juillet 2025** | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) : « Effective July 1, 2025 – Meta charges on a **per-message basis** » |
| Unité facturée = message **livré** (pas envoyé) | ✅ Confirmé | Idem : « Businesses are only charged when a message is *delivered*. Meta does *not* charge for messages sent. » |
| Catégories facturées par message | ✅ Marketing, Utility, **Authentication**, Service (+ Meta Business Agent depuis le 1er juillet 2026) | Idem |
| Tarif dépend de la **catégorie × marché** du numéro du destinataire | ✅ Confirmé | Idem |
| Message entrant (utilisateur → entreprise) | ✅ **Jamais facturé** | Idem |

### 1.2 Ce qui « reste en conversation » — plus rien en octobre 2026

La question posée supposait qu'il subsistait un reliquat de facturation par conversation. Ce n'est plus le cas :

- **Messages service** (réponses libres, non-template, dans la fenêtre client 24 h) : c'était le dernier poste par conversation. Ils sont devenus **facturables le 1er octobre 2026**, au tarif utility du marché, avec un **franc de 1 000 messages service par mois et par numéro de téléphone professionnel**.
  → Source officielle : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) (« Service messages, which became free as of Nov. 1, 2024 […] Meta introduced a free monthly tier per business phone number » et le tableau « Utility and service messages inside the customer service window become chargeable »).
- **Vérification indépendante de la modèle** : [WhaTools — pricing history](https://wha.tools/whatsapp-api-pricing-history) documente 4 ères tarifaires (2019 → 2022 → 2023 → 1er juillet 2025 → aujourd'hui) et confirme que l'ère « Per message » court depuis le 1er juillet 2025. Le détail des changements (dates, provenance officielle, liens vers Meta) est dans [changes.json](https://wha.tools/api/data/changes.json).
- **Ce qui reste facturé au niveau conversation** chez certains fournisseurs (dont Alibaba Cloud) n'est **plus** une règle WhatsApp : c'est une couche de facturation propre au fournisseur. Source : [Alibaba Cloud — notice du 30 juin 2025](https://www.alibabacloud.com/help/en/chatapp/notice-on-the-change-of-whatsapp-billing-rules-and-the-latest-catalog-price).

### 1.3 Calendrier tarifaire

Meta ne modifie ses tarifs qu'aux **1er janvier, 1er avril, 1er juillet et 1er octobre**, avec préavis contractuels :

| Type de changement | Préavis minimum |
|---|---|
| Mise à jour du rate card (un prix bouge) | 1 mois |
| Ajout tarifaire (nouveau mécanisme, ex. volume tiers) | 3 mois |
| Changement de modèle de tarification | 6 mois |

Source : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) (section *pricing calendar*), repris et daté par [WhaTools](https://wha.tools/whatsapp-api-pricing) et [ChatMaxima](https://www.docs.chatmaxima.com/pricing/whatsapp-messaging-charges).

---

## 2. Tarifs par message — catégorie AUTHENTICATION

### 2.1 Mécanique de rattachement des 7 pays

Meta publie **47 marchés** : 39 pays nommés individuellement + 8 régions « Rest of ». Les 7 pays de la question se répartissent ainsi (mapping officiel par indicatif pays) :

| Pays | Indicatif | Rattachement tarifaire Meta |
|---|---|---|
| Cameroun | +237 | **Rest of Africa** (région) |
| Côte d'Ivoire | +225 | **Rest of Africa** (région) |
| Sénégal | +221 | **Rest of Africa** (région) |
| Gabon | +241 | **Rest of Africa** (région) |
| Burkina Faso | +226 | **Rest of Africa** (région) |
| RD Congo | +243 → *voir incertitude §7.1* | **Rest of Africa** (Congo-Brazzaville +242 listé ; +243 non listé explicitement) |
| France | +33 | **Marché autonome** (« France (FR) - 33 » dans la liste des 39 marchés nommés) |

Source du mapping : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section *Pricing regions on the rate card (country calling codes)*. La liste « Rest of Africa – 40 markets » y inclut nommément Burkina Faso (BF) - 226, Cameroun (CM) - 237, Gabon (GA) - 241, Ivory Coast (CI) - 225, Senegal (SN) - 221, Republic of the Congo (CG) - 242.

### 2.2 Tarifs USD par message (rate card effective 1er octobre 2026)

| Marché | Marketing | Utility | **Authentication** | Authentication-International |
|---|---|---|---|---|
| **Rest of Africa** (CM, CI, SN, GA, BF, CG) | $0.0225 | $0.0040 | **$0.0040** | — (non applicable) |
| **France** | $0.0859 | $0.0300 | **$0.0300** | — (non applicable) |

**Provenance de ces chiffres** — trois sources convergent :

1. **Meta, rate card officiel** : les tarifs unitaires sont publiés par Meta en CSV/PDF (voir §6). Le tableau d'évolution officiel de Meta sur la même page confirme pour l'octobre 2026 : « *Utility, authentication*: 12 markets, with 8 increases and 4 decreases » — **la région Rest of Africa n'est pas dans cette liste**, donc son tarif authentication est **inchangé** au 1er octobre 2026. France n'y figure pas non plus (seul le *marketing* français a baissé de 40 % au 1er janvier 2026, de $0.1432 à $0.0859 — le tarif authentication France est resté $0.0300).
   → [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section *Rate card updates effective October 1, 2026*.
2. **Compilation datée et sourcée du rate card Meta** (CC BY 4.0, vérifiée le 5 octobre 2026, `upstream` = page Meta ci-dessus, `effective` = 2026-10-01) : `AFRICA: [0.0225, 0.004, 0.004, null]` et `FR: [0.0859, 0.03, 0.03, null]`, l'ordre des colonnes étant marketing / utility / authentication / authentication-international.
   → [wha.tools/api/data/rates.json](https://wha.tools/api/data/rates.json), publié aussi sous [GitHub](https://github.com/procom-dev/whatsapp-open-data), [Hugging Face](https://huggingface.co/datasets/WhaTools/whatsapp-open-data) et [Kaggle](https://www.kaggle.com/datasets/procomdev/whatsapp-business-platform-open-data).
3. **Grille exhaustive par pays** (mêmes valeurs, Rest of Africa $0.0225 / $0.0040 / $0.0040 ; France $0.0859 / $0.0300 / $0.0300).
   → [Whautomate — WhatsApp API pricing 2026](https://whautomate.com/whatsapp-business-api-pricing) (« Based on Meta's official rate card effective October 1, 2026 ») et [WhaTools — rate card](https://wha.tools/whatsapp-api-pricing).

**Historique (utile pour vérifier la stabilité côté Afrique)** : au rate card du **1er juillet 2025**, la ligne « Rest of Africa » était déjà `Utility 0.004 / Authentication 0.004`. Source : [Alibaba Cloud — rate card du 30 juin 2025](https://www.alibabacloud.com/help/en/chatapp/notice-on-the-change-of-whatsapp-billing-rules-and-the-latest-catalog-price). Meta précise par ailleurs que depuis ce rate card, utility et authentication portent **un tarif identique dans tous les marchés** ([WhaTools — changes.json, entrée `2025-07-01-auth-matches-utility`](https://wha.tools/api/data/changes.json)).

### 2.3 Authentication-International : **non applicable** à vos 7 marchés

Les tarifs « authentication-international » ne s'appliquent que si **les trois** conditions sont réunies (source : [Meta — Authentication-international rates](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/authentication-international-rates)) :

1. l'entreprise est **éligible** (plus de **750 K** messages authentication livrés hors fenêtre service, sur 30 jours glissants, vers des utilisateurs de pays ayant un tarif auth-intl) ;
2. l'entreprise est **basée dans un autre pays** que le destinataire (Primary Business Location) ;
3. la date de livraison est **postérieure au start time** de ce pays (fixé 30 jours après l'éligibilité).

Liste des 18 marchés à tarif auth-intl (au 1er octobre 2026) : Indonésie, Inde, Égypte, Malaisie, Nigeria, Pakistan, Arabie saoudite, Afrique du Sud, Émirats arabes unis, Bangladesh, Irak, Kazakhstan, Koweït, Maroc, Népal, Oman, Sri Lanka, Ukraine.

→ **Aucun de vos 7 marchés n'y figure.** Un OTP envoyé au Cameroun, en Côte d'Ivoire, au Sénégal, au Gabon, au Burkina Faso, en RD Congo ou en France est facturé au **tarif authentication domestique**, quelle que soit l'éligibilité de votre WABA.

Les pays proches qui **sont** concernés et qu'il faut surveiller si votre audience s'élargit : **Nigeria** ($0.075), **Maroc** ($0.0811), **Afrique du Sud** ($0.0200), **Ghana** → non (Rest of Africa).

### 2.4 Estimation de coût pour votre usage

Un OTP = **1 message authentication facturé**, quelle que soit la fenêtre :

| Volume mensuel d'OTP | Coût côté Afrique (6 pays) | Coût côté France |
|---|---|---|
| 10 000 | $40.00 | $300.00 |
| 100 000 | $400.00 | $3 000.00 |
| 1 000 000 | $4 000.00 | $30 000.00 |

*Calcul : `volume × $0.0040` (Afrique) ou `× $0.0300` (France). Tarif Meta uniquement — hors frais de plateforme Kapso et hors éventuelles remises de volume (§5.1, §7.3).*

**Métrique dérivée utile** : un OTP coûte **7,5 fois plus cher** vers la France que vers un numéro Rest of Africa. Si la répartition est ~95 % Afrique / ~5 % France, le coût moyen pondéré est d'environ **$0.0053** par OTP.

---

## 3. Règles de gratuité

### 3.1 OTP envoyé DANS une fenêtre de service 24 h ouverte par l'utilisateur

**→ Facturé. Le message authentication n'est jamais gratuit, fenêtre ouverte ou non.**

C'est explicité par Meta et par les revues de la documentation :

- **Meta, tableau des catégories** : « *Authentication* – template messages for identity verification objectives », facturé au message, sans exception de fenêtre. La seule exception de fenêtre mentionnée pour les templates concerne **Utility** (« Utility messages sent in response to users (thus in an open customer service window), which became free as of July 1, 2025 » — **et ceci a pris fin le 1er octobre 2026**). Source : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/).
- **Confirmation explicite tierce** : « Authentication is the exception: a one-time passcode is charged whether or not a window is open. » → [ThinnestAI — Windows and what gets charged](https://docs.thinnest.ai/meta/windows-and-pricing).
- **Preuve technique** : dans le webhook de statut, un message utility envoyé dans une fenêtre ouverte voyait son `pricing.type` passer à `free_customer_service` ; ce comportement est **retiré** au 1er octobre 2026 et devient `regular` — tandis que l'authentication n'a jamais eu de `pricing.type` gratuit. Source : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section sur les mises à jour du 1er octobre 2026.

**Conséquence pratique** : faire précéder l'OTP d'un message de l'utilisateur (« je n'ai pas reçu mon code ») **n'ouvre aucun droit à la gratuité** sur l'OTP. Le seul gain serait sur la *réponse libre* de l'agent, plafonnée à 1 000 messages service gratuits par mois et par numéro.

### 3.2 Autres cas de gratuité (au 9 octobre 2026)

| Cas | Gratuit ? | Source |
|---|---|---|
| **Messages entrants** (utilisateur → entreprise) | ✅ **Toujours gratuit, sans plafond** | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) |
| **Fenêtre « free entry point » (FEP)** (Click-to-WhatsApp ad, bouton CTA de Page Facebook) | ✅ **Toutes catégories gratuites** — marketing, utility, **authentication** et service. Durée : **jusqu'à 7 jours** à compter de votre réponse, et non 72 h (le chiffre de 72 h vu chez plusieurs BSP est obsolète). ⚠️ Le client doit utiliser l'app **mobile** Android/iOS : desktop et web ne déclenchent pas la fenêtre. | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) : « The FEP window may remain open for up to 7 days » |
| **Franc mensuel de 1 000 messages service** | ✅ **1 000 messages service livrés par mois et par numéro de téléphone professionnel** (citation officielle ci-dessous), non reportables | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section *free tier of monthly service messages* |
| **Réactions** (emoji) | ✅ Gratuit | [Kapso — Pricing](https://docs.kapso.ai/docs/whatsapp/pricing-faq) |
| **Messages non livrés** | ✅ Non facturés (facturation à la livraison) | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) |
| **Organisations gouvernementales et à but non lucratif éligibles** | ✅ Messages service gratuits au-delà du franc mensuel, politique en vigueur jusqu'au 31 décembre 2027 | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) |
| **Messages service** (anciennement gratuits et illimités depuis le 1er novembre 2024) | ❌ **Plus gratuits** depuis le 1er octobre 2026, au-delà de 1 000/mois/numéro | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) |
| **Templates utility dans la fenêtre 24 h** (gratuits du 1er juillet 2025 au 30 septembre 2026) | ❌ **Plus gratuits** depuis le 1er octobre 2026 | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) |
| **Messages non-template** (réponses libres) | ❌ Facturés au tarif utility du marché au-delà du franc mensuel | [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) ; [Kapso — Pricing](https://docs.kapso.ai/docs/whatsapp/pricing-faq) |

**Citation officielle du franc mensuel** ([Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section *free tier of monthly service messages*) :

> « Each business phone number has one free tier of **1,000 delivered service messages per month**. Meta charges as of the 1,001st service message per month, after the free tier has been used. Unused service messages in the free tier **do not roll over** to the next month. The free tier **resets monthly for each business phone number** […]. This reset happens at 12am by Messaging account timezone. »

Deux précisions qui en découlent :

- **Niveau d'application : par numéro de téléphone professionnel** — *pas* par WABA, *pas* par portefeuille. C'est une exception notable, puisque les **volume tiers**, eux, s'agrègent au niveau du portefeuille.
- **Seuls les messages service sortants livrés comptent.** Meta ne facture jamais les messages de l'utilisateur vers l'entreprise (« Meta does not charge for messages from a WhatsApp user to a business »), donc les messages **entrants ne consomment pas** la franchise.
- Si aucun moyen de paiement n'est enregistré, Meta livre les messages service **dans** la franchise mais **cesse de les livrer** au-delà.

**Tarif des messages service** = tarif **utility du marché** (le rate card Meta ne publie pas de colonne service distincte, précisément parce que les deux sont égaux). Valeurs USD : Rest of Africa $0.0040 · Other $0.0077 · France $0.0300. Aucune variation jour/nuit, aucun tarif par canal : un seul tarif par marché-catégorie.

**Note Kapso** : Kapso confirme la répartition — Meta facture le message, Kapso facture la plateforme. En mode « crédits Kapso », Kapso refacture **le prix USD publié par Meta** (+ marge FX le cas échéant) ; un message peut à la fois consommer votre forfait Kapso et générer un frais Meta. Source : [Kapso — Meta message billing](https://docs.kapso.ai/docs/whatsapp/meta-message-billing).

---

## 4. Règles Meta pour créer un template de catégorie `authentication`

Source principale : [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) (mis à jour 5 octobre 2026).

### 4.1 Prérequis du compte

| Prérequis | Statut | Source |
|---|---|---|
| **Chaque entreprise doit avoir son propre compte WhatsApp et Messaging account, et envoyer depuis son propre numéro.** Le partage d'un Messaging account entre plusieurs entités est contraire à la politique. | ✅ **Exigence Meta explicite** | [Meta — Authentication best practices](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-best-practices) |
| **Opt-in utilisateur obligatoire** avant l'envoi (WhatsApp Business Messaging Policy) | ✅ Exigence | Idem |
| **Meta Business Verification** (Business Portfolio vérifié) | ✅ **Nécessaire** — c'est le chemin recommandé, et Meta liste « One-time password templates: **Blocked** » sans vérification | [ThinnestAI — Business verification](https://docs.thinnest.ai/meta/verification) (tableau « What it unlocks ») |
| **Palier d'envoi ≥ 2 000** | 🟡 **Attesté par des partenaires, non retrouvé tel quel dans la doc Meta actuelle** — voir incertitude §7.2 | [Vonage — Guidelines and Eligibility Criteria](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template) |
| Aucune restriction/ban actif sur le WABA ou le portefeuille | ✅ Attesté par les partenaires | Idem |

> Si le compte est incomplet, Meta renvoie l'erreur **`This WhatsApp Business account does not have permission to create message template`**. Source : [Vonage](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template).

### 4.2 Format obligatoire

Le corps du message est **écrit par Meta, non personnalisable** :

> **`<CODE>`** is your verification code. *For your security, do not share this code.* *This code expires in `<N>` minutes.*

| Élément | Règle | Source |
|---|---|---|
| **Texte du corps** | Fixe, non modifiable : « `<VERIFICATION_CODE> is your verification code.` » | [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) |
| **Avertissement sécurité** | Optionnel, « For your security, do not share this code. » — **activé par défaut** | Idem + [Twilio — whatsapp/authentication](https://www.twilio.com/docs/content/whatsappauthentication) (`add_security_recommendation`, défaut `TRUE`) |
| **Expiration du code** | Optionnel, footer « This code expires in `<N>` minutes. » — **entier de 1 à 90**, défaut usuel 10 | [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) (min 1, max 90) ; [Twilio](https://www.twilio.com/docs/content/whatsappauthentication) |
| **Bouton OTP** | **Exactement un** bouton, obligatoire, parmi : `COPY_CODE` (fonctionne partout), `ONE_TAP` (Android ; sur iOS 26+ c'est l'OS qui gère via *keyboard suggestions*), ou `ZERO_TAP` (Android, livraison silencieuse). **Pas d'option « sans bouton »** sauf zero-tap. | [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) ; [ThinnestAI — One-time codes](https://docs.thinnest.ai/whatsapp/one-time-codes) |
| **Variable** | **Une seule** variable (`{{1}}` ou `{{code}}`) = le code OTP. Le code envoyé doit faire **moins de 15 caractères**. | [Twilio — whatsapp/authentication](https://www.twilio.com/docs/content/whatsappauthentication) ; [Vonage](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template) |
| **Langue** | Code de langue **obligatoire** à la création ; le texte est **traduit par Meta** dans la langue de l'utilisateur. Les chaînes et paramètres ne sont pas traduits automatiquement, c'est à vous de fournir la bonne langue. | [Meta — Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines) ; [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) (exemple `fr`, `es_ES`) |
| **Nom du template** | Minuscules, chiffres et underscores uniquement ; max 512 caractères | [Meta — Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines) |
| **Langue en masse** | Création multi-langues possible via `upsert_message_templates` avec `languages: ["en_US","es_ES","fr"]` | [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) |
| **Sécurité appareils liés** | Activée par défaut : le code n'est livré qu'à l'**appareil principal** ; sur les appareils liés le message est masqué. Non configurable. Cloud API uniquement. | [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) |

### 4.3 Contraintes de contenu (catégorie la plus restrictive)

| Interdit | Détail |
|---|---|
| **URLs** | Dans le contenu **et** dans les paramètres |
| **Média** | Images, vidéos, documents |
| **Emojis** | Non autorisés |
| **Paramètres > 15 caractères** | Plafond strict |
| **Contenu marketing/utility** | Un template `AUTHENTICATION` ne doit contenir ni contenu utility ni contenu marketing |
| **Personnalisation du texte** | Impossible — pas de nom de marque, pas d'explication ajoutée |

Sources : [Vonage](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template), [Sinch](https://support.sinch.com/hc/en-us/articles/53658330739603-Why-was-my-WhatsApp-message-template-rejected), [ThinnestAI — Template review](https://docs.thinnest.ai/meta/template-review).

### 4.4 Processus de review et raisons de refus fréquentes

**Processus** : review automatique (ML) en quelques minutes pour la majorité ; escalade humaine possible jusqu'à **24–48 h**. Les templates authentication sont **généralement approuvés en quelques minutes**, Meta ayant écrit le contenu. Source : [ThinnestAI — Template review](https://docs.thinnest.ai/meta/template-review) ; max **100 templates créés par heure et par Messaging account** ([Meta — Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines)).

**Raisons de refus les plus fréquentes** (source principale : [Sinch — Why was my WhatsApp message template rejected?](https://support.sinch.com/hc/en-us/articles/53658330739603-Why-was-my-WhatsApp-message-template-rejected), qui cite la liste officielle Meta « common rejection reasons ») :

1. **`INVALID_FORMAT`** — le plus courant, toujours corrigeable : paramètres mal formatés (il faut `{{1}}` avec doubles accolades), caractères spéciaux dans les paramètres, paramètres non séquentiels (`{{1}}`, `{{2}}`, `{{4}}` sans `{{3}}`), exemples manquants ou ne correspondant pas, slashes mal placés avant un paramètre d'URL dynamique.
2. **`TAG_CONTENT_MISMATCH`** — le contenu ne correspond pas à la catégorie (OTP décrit comme utility/marketing, ou contenu promotionnel dans un template authentication).
3. **`ABUSIVE_CONTENT`** — violation de la WhatsApp Commerce Policy ou Business Policy, contenu abusif ou menaçant.
4. **Doublon** de template existant — ⚠️ **exception explicite pour les templates `AUTHENTICATION`**, qui peuvent être dupliqués.
5. **Langue incohérente** — le code de langue sélectionné ne correspond pas au contenu, ou contenu multilingue dans un seul template.
6. **Nom invalide** — majuscules, tirets ou caractères autres que minuscules/chiffres/underscores.
7. **Templates `AUTHENTICATION` anciens non conformes** — depuis le **1er juin 2024**, les guidelines authentication sont plus restrictives : les templates approuvés avant cette date et non conformes sont désormais **rejetés** et doivent être recréés.
8. **Erreur de permission au niveau compte** (pas le template) : `This WhatsApp Business account does not have permission to create message template` → vérification d'entreprise incomplète, palier d'envoi non atteint, ou compte restreint.

Sources : [Sinch](https://support.sinch.com/hc/en-us/articles/53658330739603-Why-was-my-WhatsApp-message-template-rejected) ; [Vonage](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template) ; [Sinch — restrictions de juin 2024](https://support.sinch.com/hc/en-us/articles/53658350834451).

---

## 5. Coût et conditions des paliers d'envoi et de la vérification d'entreprise

### 5.1 Volume tiers (remises de volume) — utility et authentication uniquement

| Règle | Détail |
|---|---|
| **Catégories éligibles** | **Utility et authentication uniquement.** Marketing exclu. Service exclu (pas de remise). |
| **Agrégation** | Volume compté au niveau du **business portfolio**, à travers tous les Messaging accounts qu'il possède — **pas** par numéro de téléphone. |
| **Périmètre** | Par **couple marché × catégorie**. Votre volume au Cameroun n'affecte pas la France. |
| **Remise** | **Marginale** (comme des tranches d'impôt) : seuls les messages **au-delà** du seuil profitent du taux réduit. |
| **Ce qui compte** | Uniquement les messages **effectivement payés**. Les messages utility gratuits en fenêtre et ceux en free entry point ne comptabilisent pas. |
| **Reset** | Minuit du 1er du mois, fuseau du WABA. |
| **Profondeur** | Six bandes, jusqu'à **25 %** de remise sur le tarif liste. |

Sources : [Meta — Pricing, section *Volume tiers for utility and authentication messages*](https://developers.facebook.com/docs/whatsapp/pricing/) ; [WhaTools changes.json, entrée `2025-07-01-volume-tiers`](https://wha.tools/api/data/changes.json) (« six bands discounting up to 25% off the list rate, accrued monthly across a business portfolio ») ; [ChatMaxima](https://www.docs.chatmaxima.com/pricing/whatsapp-messaging-charges) ; [Whautomate](https://whautomate.com/whatsapp-business-api-pricing).

**Coût d'accès aux tiers : néant.** C'est automatique, sans démarche. Les seuils exacts par marché sont publiés par Meta en CSV/PDF (§6) — **je n'ai pas pu les lire** (voir §7.3).

### 5.2 Paliers d'envoi (messaging limits)

| Palier | Clients uniques par 24 h |
|---|---|
| Départ (nouveau portefeuille) | **250** |
| Puis | **2 000** |
| Puis | **10 000** |
| Puis | **100 000** |
| Puis | **Illimité** |

- **Définition** : nombre maximum de **numéros WhatsApp uniques** auxquels votre entreprise peut livrer des messages, **hors fenêtre de service**, sur **24 h glissantes**. Répondre dans la fenêtre à quelqu'un qui vous a écrit **ne consomme pas** le quota.
- **Niveau portefeuille** : calculé et appliqué au **business portfolio**, partagé par tous les numéros. Un numéro peut consommer toute la capacité du portefeuille.
- **Passer à 2 000** — une des trois voies (*scaling paths*) : (a) **vérifier son entreprise**, (b) faire vérifier son entreprise par son partenaire, (c) envoyer 2 000 messages livrés hors fenêtre à des numéros uniques sur 30 jours glissants, avec des templates de **haute qualité**. Meta analyse ensuite la qualité et approuve ou refuse.
- **Au-delà** — *automatic scaling* : (1) envoi de messages haute qualité sur tous les numéros et templates, **et** (2) au moins la moitié du palier courant utilisé sur les 7 derniers jours → +1 palier sous 6 h.
- **Vérification du palier** : WhatsApp Manager > *Account tools* > *Messaging limits*, ou API via `whatsapp_business_manager_messaging_limit` (le champ `messaging_limit_tier` est **déprécié**).

Source : [Meta — Messaging Limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits) (mis à jour 21 mai 2026). Recoupé par [ThinnestAI](https://docs.thinnest.ai/meta/quality-and-limits) et [360dialog](https://docs.360dialog.com/docs/resources/wabas/messaging-limits).

### 5.3 Vérification d'entreprise Meta

| Point | Réponse |
|---|---|
| **Coût monétaire** | ✅ **Gratuit** — aucune source consultée (Meta, ThinnestAI, Vonage) ne mentionne de frais. La vérification est une validation d'existence légale, pas un produit payant. |
| **Ce que ça débloque** | Palier **2 000** (puis scaling auto), **templates OTP**, publication des Flows, nom d'affichage vérifié sur le numéro, et **6 000 templates** au lieu de 250. |
| **Ce que Meta demande** | Raison sociale légale **correspondant exactement aux documents officiels**, adresse, téléphone ou site vérifiable, document prouvant l'existence de l'entité (certificat d'incorporation, extrait Kbis/équivalent, facture au nom de l'entreprise). |
| **Cause n°1 de refus** | **Discordance de nom** : le nom du portefeuille Meta diffère, même légèrement, du nom sur le document (suffixe `SARL`, `SAS`, `Ltd`…). À faire correspondre **exactement**. |
| **Délai** | **Quelques jours**, parfois plus. Une demande de documents complémentaires relance le compteur. |
| **Recommandation** | **Lancer la vérification dès le jour 1**, avant d'en avoir besoin : elle tourne en arrière-plan. |

Sources : [ThinnestAI — Business verification](https://docs.thinnest.ai/meta/verification) ; [Vonage — Guidelines and Eligibility Criteria](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template) ; [Meta — Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines) (250 templates si portefeuille non vérifié, 6 000 si vérifié + au moins un numéro avec display name approuvé).

---

## 6. Rate cards officiels téléchargeables

**Page de référence** : [Pricing on the WhatsApp Business Platform — Rate cards and volume tiers](https://developers.facebook.com/docs/whatsapp/pricing/#rate-cards-and-volume-tiers)
Meta y publie, **pour chacune des 16 devises**, trois fichiers : « List rates » (CSV), « Volume tiers for utility and authentication » (CSV) et « List rates and volume tiers » (PDF). Ces fichiers couvrent **les 47 marchés**, donc vos 7 pays.

**Liens directs USD** (relevés le 9 octobre 2026 sur la page Meta ci-dessus ; ⚠️ URLs signées CDN Facebook, à expiration — elles pointent vers des `.xlsx` malgré l'extension `.csv`) :

| Fichier | URL |
|---|---|
| USD — list rates | `https://scontent-atl3-2.xx.fbcdn.net/v/t39.8562-6/829311379_1537421421402610_366484812346475911_n.csv` (params `_nc_*`, `oh`, `oe=6ACF14C2`) |
| USD — volume tiers | `https://scontent-atl3-1.xx.fbcdn.net/v/t39.8562-6/830197941_1665057081977768_2267409043178611359_n.csv` (params `_nc_*`, `oh`, `oe=6ACEF657`) |
| USD — list rates + volume tiers (PDF) | `https://scontent-atl3-2.xx.fbcdn.net/v/t39.8562-6/830454456_1096335989550117_8713722417447655185_n.pdf` (params `_nc_*`, `oh`, `oe=6ACEF2EA`) |

**Version interactive officielle** : [business.whatsapp.com/products/platform-pricing#rates](https://business.whatsapp.com/products/platform-pricing#rates) (liée depuis la page développeurs Meta).

**Alternatives exploitables** si les liens signés expirent :

- **API JSON ouverte CORS** : [`https://wha.tools/api/data/rates.json`](https://wha.tools/api/data/rates.json) — 47 marchés × 16 devises + seuils de volume, licence CC BY 4.0, `upstream` = page Meta, `effective` = 2026-10-01, `verified` = 2026-10-05. Miroirs : [GitHub](https://github.com/procom-dev/whatsapp-open-data) (JSON + CSV, rafraîchi hebdomadairement), [Hugging Face](https://huggingface.co/datasets/WhaTools/whatsapp-open-data), [Kaggle](https://www.kaggle.com/datasets/procomdev/whatsapp-business-platform-open-data). DOI : [10.5281/zenodo.22103231](https://doi.org/10.5281/zenodo.22103231).
- **Tableau HTML complet** : [wha.tools/whatsapp-api-pricing](https://wha.tools/whatsapp-api-pricing).
- **Historique daté et sourcé de tous les changements depuis 2019** : [wha.tools/api/data/changes.json](https://wha.tools/api/data/changes.json) et [page lisible](https://wha.tools/whatsapp-api-pricing-history).

> ℹ️ **Limite technique constatée** : les fichiers « CSV » de Meta sont en réalité des archives **XLSX**, et le téléchargement binaire a échoué dans mon environnement (erreur SSL `SEC_E_NO_CREDENTIALS` en PowerShell/curl, et `web_fetch` les décode en binaire illisible). Je n'ai donc **pas pu lire le rate card officiel à la source** ; les valeurs du §2 proviennent de trois compilations indépendantes convergentes, dont une qui déclare explicitement se sourcer sur ce fichier et donne sa date de vérification.

---

## 7. Incertitudes

**7.1 — RD Congo : rattachement non confirmé explicitement.** La liste officielle Meta des 40 marchés « Rest of Africa » inclut **« Republic of the Congo (CG) - 242 »** (Congo-Brazzaville) mais **ne mentionne pas** la RD Congo (+243, ISO `CD`) — ni dans les 39 marchés nommés, ni dans les 8 régions. Meta précise : « If a country is not listed below, it maps to **Other** ». Conséquence : si `CD` n'est pas rattaché à Rest of Africa, un OTP vers un +243 serait facturé au tarif **« Other »**, soit **$0.0077** (et non $0.0040) — **presque le double**. *C'est le point à vérifier en priorité*, et c'est directement actionnable : la grille de volume de votre app doit être validée sur ce point avant tout chiffrage budgétaire de la RD Congo. À confirmer dans le CSV/XLSX officiel ou via la `pricing_analytics` d'un envoi test.

**7.2 — Seuil de déblocage des templates authentication : divergence de sources.** Vonage affirme que Meta exige un palier de **2 000+ conversations initiées par l'entreprise par jour et par numéro** avant de débloquer la création de templates authentication. Je **n'ai pas retrouvé cette exigence formulée ainsi dans la documentation Meta actuelle** : la page [Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) n'énonce aucun prérequis de palier, et la page [Messaging Limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits) présente la vérification d'entreprise comme une *scaling path* vers 2 000, pas comme un prérequis de catégorie. Lecture la plus probable : la **vérification d'entreprise** est le vrai déclencheur (elle débloque à la fois OTP et 2 000), et l'affirmation « 2 000 obligatoire » reflète la situation d'un WABA non vérifié. **Non tranché** — à valider avec le support Kapso ou dans WhatsApp Manager.

**7.3 — Seuils et pourcentages exacts des volume tiers pour Rest of Africa : non obtenus.** La structure est confirmée (6 bandes, jusqu'à −25 %, marginales, mensuelles, par marché × catégorie, agrégées au portefeuille) mais **je n'ai pas les chiffres** : ils figurent dans le CSV/PDF de volume tiers que je n'ai pas pu ouvrir (§6). **Impact concret** : si votre volume d'OTP vers Rest of Africa dépasse quelques centaines de milliers par mois, votre coût réel pourrait être inférieur aux $0.0040 × volume du §2.4, sans que je puisse quantifier la remise. À vérifier dans le fichier.

**7.4 — Un tarif « authentication-international » pourrait vous être appliqué plus tard.** L'éligibilité est **permanente une fois acquise**, se déclenche au-delà de **750 K** messages authentication livrés hors fenêtre sur 30 jours glissants vers les 18 marchés concernés, et le périmètre de ces marchés **s'est élargi de 9 à 18 le 1er octobre 2026** — il pourrait s'élargir encore. Aucun de vos 7 marchés n'est concerné aujourd'hui, mais **le Primary Business Location** (pays où Meta estime que votre entreprise est basée) devient déterminant dès que vous franchissez le seuil. Si une part de votre audience se déplace vers le **Nigeria, le Maroc ou l'Afrique du Sud**, l'écart est de **×10 à ×19** par rapport au tarif Rest of Africa. À instrumenter via le champ `auth_international_rate_eligibility` de votre WABA.

**7.5 — Les taux EUR et USD ne sont pas convertibles.** Meta publie 16 devises dont les valeurs sont **ancrées FX mais non dérivables les unes des autres** : « They are FX-anchored but not reproducible by converting the USD card, so do not derive one currency from another. » ([wha.tools rates.json](https://wha.tools/api/data/rates.json)). Concrètement, la France est facturée **€0.0248** sur le rate card EUR et **$0.0300** sur le rate card USD. **Le choix de la devise de facturation se fait à la création du WABA et ne peut plus être changé** ([ChatMaxima](https://www.docs.chatmaxima.com/pricing/whatsapp-messaging-charges)) — c'est une décision à prendre une fois, correctement, avant d'ouvrir le compte. Non chiffré ici faute de savoir dans quelle devise Kapso ouvre le WABA.

**7.6 — Frais Kapso non chiffrés.** Tous les montants de ce document sont **le tarif Meta uniquement**. Kapso facture en plus l'accès plateforme, et en mode « crédits Kapso » refacture le prix Meta (+ marge FX pour les WABA non-USD). Le montant de cette couche n'apparaît dans aucune des pages publiques que j'ai consultées : [Kapso — Pricing](https://docs.kapso.ai/docs/whatsapp/pricing-faq) et [Kapso — Meta message billing](https://docs.kapso.ai/docs/whatsapp/meta-message-billing) décrivent le mécanisme sans publier de tarif. **À demander directement à Kapso.**

**7.7 — Vérification par lecture directe de la source officielle : non réalisée.** Pour la raison technique exposée en §6, je n'ai pas ouvert le fichier rate card de Meta. Les tarifs du §2 reposent sur trois compilations indépendantes qui convergent, dont deux déclarent se sourcer sur ce fichier officiel et datent leur vérification (5 octobre 2026), et dont les valeurs de juillet 2025 sont corroborées par un quatrième acteur (Alibaba Cloud). La confiance est **élevée** pour le Cameroun, la Côte d'Ivoire, le Sénégal, le Gabon, le Burkina Faso et la France, et **faible pour la RD Congo** (cf. 7.1).

**7.8 — Non vérifié :** le fait que Kapso expose bien 7 marchés distincts dans sa propre facturation (il refacture le prix Meta, donc la structure devrait être identique, mais je n'ai pas de confirmation écrite de Kapso sur les lignes « Rest of Africa » / « Other »).

**7.9 — Résolu depuis la première version.** Trois points qui figuraient comme incertains ou approximatifs sont désormais **confirmés à la source officielle** et ne doivent plus être traités comme incertains :

- **Montant de la franchise service** : les 1 000 messages/mois provenaient initialement d'avis partenaires (360dialog, Gupshup) et non de Meta. La page [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) l'énonce désormais noir sur blanc, avec le niveau d'application (par numéro de téléphone professionnel) et l'absence de report. **Confirmé.**
- **Durée de la fenêtre free entry point** : la première version de ce document indiquait **72 h** (chiffre repris de plusieurs BSP, dont ChatMaxima et Whautomate). La page Meta actuelle indique **« The FEP window may remain open for up to 7 days »**. **Le chiffre correct est 7 jours**, et cela *augmente* le gisement d'OTP gratuits par rapport à ce que j'avais annoncé.
- **Tarif service** : confirmé égal au tarif utility sur ces marchés, avec une seule valeur par couple marché × catégorie (pas de tarif jour/nuit ni par canal).

---

## 8. Tableau récapitulatif — USD par message

**Grille en vigueur : rate card Meta effective 1er octobre 2026. Tarif Meta uniquement, hors frais de plateforme Kapso.**

| Marché | **Authentication** | **Utility** | **Service** | Auth-International | Base du chiffre | Confiance |
|---|---|---|---|---|---|---|
| **Rest of Africa** — Cameroun +237, Côte d'Ivoire +225, Sénégal +221, Gabon +241, Burkina Faso +226, Congo-Brazzaville +242 | **$0.0040** | **$0.0040** | **$0.0040** | Non applicable | Compilation du rate card Meta, 3 sources convergentes | Élevée |
| **RD Congo** +243 | ⚠️ **non listé** dans Rest of Africa | idem | idem | Non applicable | La liste officielle Meta ne mentionne pas `CD` | **Faible — à trancher** |
| ↳ *si rattaché à Rest of Africa* | **$0.0040** | **$0.0040** | **$0.0040** | — | — | — |
| ↳ *si rattaché à « Other »* | **$0.0077** | **$0.0077** | **$0.0077** | — | Règle Meta : « If a country is not listed below, it maps to Other » | — |
| **France** +33 | **$0.0300** | **$0.0300** | **$0.0300** | Non applicable | Compilation du rate card Meta (USD) ; **€0.0248** sur le rate card EUR | Élevée |

**Authentication, utility et service portent le même tarif sur ces marchés** — ce n'est pas une coïncidence ni une approximation : depuis le rate card du 1er juillet 2025, Meta facture les trois catégories au même prix par marché ([WhaTools — changes.json](https://wha.tools/api/data/changes.json), entrée `2025-07-01-auth-matches-utility`), et le rate card ne publie pas de colonne service distincte pour cette raison. Aucune variation jour/nuit, aucun tarif par canal.

**Rappels de lecture :**

- Un OTP **template authentication** = **1 message facturé**, **quelle que soit la fenêtre** (fenêtre 24 h ouverte ou non ; seule la fenêtre *free entry point*, jusqu'à 7 jours, le rend gratuit).
- Le franc mensuel de **1 000 messages service** **ne s'applique pas** aux OTP.
- Aucun de ces 7 marchés n'a de tarif authentication-international aujourd'hui (les 18 marchés concernés sont : Indonésie, Inde, Égypte, Malaisie, Nigeria, Pakistan, Arabie saoudite, Afrique du Sud, Émirats, Bangladesh, Irak, Kazakhstan, Koweït, Maroc, Népal, Oman, Sri Lanka, Ukraine).
- Remises de volume (jusqu'à −25 %, 6 bandes) applicables aux OTP au-delà des seuils du marché — **seuils non obtenus** (§7.3).
- Écart France / Afrique : **×7,5**.

---

## 8 bis. Addendum — tarifs service et utility, et franchise de service

*Ajouté le 9 octobre 2026 en réponse à une demande de compléments.*

### Tarifs service et utility (USD par message, rate card effective 1er octobre 2026)

| Marché | Utility | Service |
|---|---|---|
| **Rest of Africa** (CM, CI, SN, GA, BF, CG) | **$0.0040** | **$0.0040** |
| ↳ alternative « Other » pour la RD Congo | **$0.0077** | **$0.0077** |
| **France** | **$0.0300** | **$0.0300** |

Sources : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) (« Utility, authentication, and service: fixed, per published rates » ; le tableau d'évolution ne mentionne aucune hausse utility/authentication pour Rest of Africa ni pour la France au 1er octobre 2026) et [wha.tools rates.json](https://wha.tools/api/data/rates.json) — `AFRICA: [0.0225, 0.004, 0.004, null]`, `FR: [0.0859, 0.03, 0.03, null]`, `OTHER: [0.0604, 0.0077, 0.0077, null]` (ordre : marketing / utility / authentication / auth-international). **Aucune variation jour/nuit et aucun tarif par canal** : Meta publie un seul tarif par couple marché × catégorie, sans différenciation horaire ni par type de message.

### Règles de la franchise de messages service

1. **Montant et niveau d'application** : **1 000 messages service livrés par mois et par numéro de téléphone professionnel** — *pas* par WABA, *pas* par portefeuille. C'est l'inverse des volume tiers, qui s'agrègent au portefeuille.
2. **Périmètre du décompte** : seuls les messages **sortants livrés** de l'entreprise sont facturés et donc décomptés. Les messages **entrants** (utilisateur → entreprise) ne sont **jamais** facturés et **ne consomment pas** la franchise.
3. **Réinitialisation** : mensuelle calendaire, à minuit dans le fuseau du Messaging account ; l'allocation **ne se reporte pas**. Meta facture à partir du **1 001e** message service du mois et par numéro. Sans moyen de paiement enregistré, Meta livre dans la franchise mais **cesse de livrer** au-delà.

Source : [Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing/), section *free tier of monthly service messages* (citation intégrale en §3.2).

---

## 9. Sources

**Sources primaires (Meta / éditeur de la plateforme)**

1. [Meta — Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing/) — modèle par message, 5 catégories, 47 marchés, frais, gratuités, volume tiers, calendrier tarifaire, mapping des indicatifs, liens des rate cards CSV/PDF. *(mis à jour 30 septembre 2026)*
2. [Meta — Authentication-international rates](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/authentication-international-rates) — éligibilité, liste des 18 marchés, Primary Business Location, start times. *(mis à jour 21 mai 2026)*
3. [Meta — Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates) — structure du template, boutons, expiration, upsert multi-langue. *(mis à jour 5 octobre 2026)*
4. [Meta — Best practices for authenticating users](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-best-practices) — opt-in, compte/numéro propres, sécurité. *(mis à jour 6 octobre 2026)*
5. [Meta — Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines) — nommage, langue, paramètres, limites de templates. *(mis à jour 21 mai 2026)*
6. [Meta — Messaging Limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits) — paliers 250 → 2 000 → 10 000 → 100 000 → illimité, scaling paths. *(mis à jour 21 mai 2026)*
7. [Kapso — Pricing](https://docs.kapso.ai/docs/whatsapp/pricing-faq) — ce que Kapso facture vs ce que Meta facture, franc mensuel service.
8. [Kapso — Meta message billing](https://docs.kapso.ai/docs/whatsapp/meta-message-billing) — modes de facturation, refacturation au prix Meta publié.

**Compilations du rate card Meta (données chiffrées)**

9. [WhaTools — dataset rates.json](https://wha.tools/api/data/rates.json) — 47 marchés × 16 devises + seuils de volume ; CC BY 4.0 ; `effective` 2026-10-01, `verified` 2026-10-05, `upstream` = source 1. Miroirs : [GitHub](https://github.com/procom-dev/whatsapp-open-data), [Hugging Face](https://huggingface.co/datasets/WhaTools/whatsapp-open-data), [Kaggle](https://www.kaggle.com/datasets/procomdev/whatsapp-business-platform-open-data).
10. [WhaTools — rate card lisible](https://wha.tools/whatsapp-api-pricing) et [calculateur](https://wha.tools/whatsapp-api-pricing#calculator).
11. [WhaTools — historique tarifaire daté et sourcé](https://wha.tools/whatsapp-api-pricing-history) + [changes.json](https://wha.tools/api/data/changes.json) — 76 changements enregistrés depuis 2019, chacun avec provenance et lien Meta.
12. [Whautomate — WhatsApp API pricing 2026](https://whautomate.com/whatsapp-business-api-pricing) — grille complète par pays, « Based on Meta's official rate card effective October 1, 2026 », dernière vérification septembre 2026.
13. [Alibaba Cloud — Pricing updates on the WhatsApp Business Platform (30 juin 2025)](https://www.alibabacloud.com/help/en/chatapp/notice-on-the-change-of-whatsapp-billing-rules-and-the-latest-catalog-price) — rate card juillet 2025, « Rest of Africa » utility/authentication = $0.0040.
14. [Alibaba Cloud — Addition of countries for WhatsApp Authentication-International (5 décembre 2024)](https://www.alibabacloud.com/help/en/chatapp/announcement-on-new-countries-with-whatsapp-authentication-international-rates) — genèse de l'auth-international.

**Règles de contenu, gratuité, compte (sources partenaires / BSP)**

15. [ThinnestAI — Windows and what gets charged](https://docs.thinnest.ai/meta/windows-and-pricing) — « Authentication is the exception: a one-time passcode is charged whether or not a window is open. »
16. [ThinnestAI — Business verification](https://docs.thinnest.ai/meta/verification) — ce que débloque la vérification, délais, cause n°1 de refus.
17. [ThinnestAI — Quality ratings and messaging limits](https://docs.thinnest.ai/meta/quality-and-limits) et [Template review](https://docs.thinnest.ai/meta/template-review) et [One-time codes](https://docs.thinnest.ai/whatsapp/one-time-codes).
18. [Vonage — Guidelines and Eligibility Criteria for Creating a WhatsApp Authentication Template](https://api.support.vonage.com/hc/en-us/articles/30129084631068-Guidelines-and-Eligibility-Criteria-for-Creating-a-WhatsApp-Authentication-Template) — prérequis WABA, boutons OTP, restrictions de contenu. *(7 septembre 2026)*
19. [Sinch — Why was my WhatsApp message template rejected?](https://support.sinch.com/hc/en-us/articles/53658330739603-Why-was-my-WhatsApp-message-template-rejected) — raisons de refus, cite la liste officielle Meta. *(21 juillet 2026)*
20. [Twilio — whatsapp/authentication content type](https://www.twilio.com/docs/content/whatsappauthentication) — `add_security_recommendation`, `code_expiration_minutes`, `COPY_CODE`, OTP < 15 caractères. *(31 juillet 2026)*
21. [ChatMaxima — WhatsApp messaging charges](https://www.docs.chatmaxima.com/pricing/whatsapp-messaging-charges) — gratuités, volume tiers, devises non modifiables, max-price bidding.
22. [360dialog — Messaging Limits](https://docs.360dialog.com/docs/resources/wabas/messaging-limits) et [Free vs Billed Messaging](https://docs.360dialog.com/docs/get-started/pricing/free-vs-billed-messaging).
23. [360dialog — Authentication Messages](https://docs.360dialog.com/docs/resources/authentication-messages).

---

*Toutes les valeurs de taux sont datées et rattachées à une source. Aucun tarif n'a été extrapolé, converti d'une devise à l'autre, ni deviné. Les sept points nécessitant une vérification complémentaire sont listés au §7 ; les deux à traiter en priorité sont la **RD Congo (§7.1)** et la **devise de facturation du WABA (§7.5)**.*
