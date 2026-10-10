# Étude : connexion à Elearn Prepa par WhatsApp (Kapso + Supabase Auth)

Demande de Benny, 8 octobre 2026 : « sur les pages connexion et création de compte, on demande e-mail et mot de passe. Et si on mélangeait Kapso et Supabase pour faire l'authentification par WhatsApp ? »

Ce document répond en trois parties : ce que le produit et le backend savent déjà faire, les architectures possibles avec leurs coûts réels, et le plan d'implémentation par phases.

Statut : étude, aucune ligne de code écrite. Décision attendue : section 10.

---

## 1. Résumé exécutif

Trois constats commandent tout le reste.

1. **Le besoin est réel et documenté.** L'app a déjà eu une connexion par numéro de téléphone (`/compte/ancien`, écran A7), coupée le 30 septembre parce qu'elle exigeait un mot de passe hérité de l'ancienne application. Les comptes historiques (`elearn_mobile`) sont des comptes Supabase **à numéro** : leur `auth.users.phone` est déjà rempli. Une connexion par code WhatsApp leur rendrait l'accès sans mot de passe, et supprimerait la principale cause de tickets support.

2. **Toute la tuyauterie WhatsApp existe déjà.** Kapso est branché en production pour les parents et pour l'agent support : webhook signé, envoi de modèles, messages libres dans la fenêtre de 24 h, file d'envoi, idempotence, mode fictif/réel avec liste blanche. Ajouter l'authentification ne demande aucune nouvelle intégration Kapso, seulement une Edge Function et une table.

3. **Le seul obstacle est administratif, pas technique : le compte Meta.** Le modèle d'authentification `code_connexion` a été refusé le 8 octobre (« ce compte WhatsApp Business n'a pas la permission de créer un modèle »). La vérification de l'entreprise dans Meta Business est la clé : elle est gratuite et débloque les modèles d'authentification. Tant qu'elle n'est pas faite, la voie « modèle d'authentification Meta » est fermée.

**Recommandation : deux étapes, pas une.**

- **Étape 1 (immédiate, déblocable sans Meta)** : connexion par **fenêtre de service de 24 h**. L'élève appuie sur « Continuer avec WhatsApp », l'app ouvre WhatsApp avec un message prérempli, l'élève l'envoie, et le code lui revient en réponse libre. Aucun modèle Meta, aucune autorisation à attendre. Tout le reste (Supabase Auth, session, conversion d'invité, liaison de compte) est identique à l'étape 2.
- **Étape 2 (quand l'entreprise est vérifiée chez Meta)** : bascule sur le **modèle d'authentification Meta**, envoyé par le hook « Send SMS » de Supabase. Meilleure expérience (un seul appui, bouton « Copier le code », remplissage automatique sur Android), mais toujours facturée au message.

**Le chiffrage réserve une surprise utile** (détail en section 8). Meta facture le **même prix unitaire** pour un message de service et un message d'authentification, mais accorde **1 000 messages de service gratuits par mois et par numéro**. L'étape 1 n'est donc pas seulement la plus rapide à livrer : elle est aussi **la moins chère** jusqu'à environ 47 500 connexions par mois.

**Avec les formules gratuites actuelles** (Kapso Free et Supabase Free), le total mensuel est de **0 $ jusqu'à environ 870 connexions**, puis **31 $ à 2 000 connexions** et **74 $ à 10 000** — le saut venant du quota de 2 000 messages du plan Kapso Free, qu'il faut dépasser pour continuer.

Les deux étapes partagent le même écran, le même service et la même table côté serveur : l'étape 2 n'est qu'un changement de canal d'envoi dans une Edge Function. Tout est derrière un drapeau PostHog, donc ouvrable et coupable sans publier une nouvelle version.

---

## 2. État des lieux

### 2.1 Côté application (`elearn-app`)

| Élément | Fichier | Comportement actuel |
| --- | --- | --- |
| Écran connexion / création | `src/components/FormulaireCompte.tsx` | E-mail + mot de passe, code de parrainage facultatif en création |
| Service comptes | `src/services/compte.ts` | `signUp`, `signInWithPassword`, `updateUser`, `signInWithOAuth`, `linkIdentity`, `signInWithIdToken` |
| Invités | `src/services/session.ts` | `signInAnonymously` : au premier lancement, l'app crée une session anonyme |
| Conversion invité | `compte.ts` lignes 99-105 | Un invité qui crée son compte passe par `updateUser({ email, password })` : **même identifiant, progression conservée** |
| Reprise de progression | `src/services/repriseInvite.ts` | Reprise après connexion à un compte existant (invité puis compte) |
| Anciens comptes | `src/services/ancienCompte.ts`, `src/components/AncienCompte.tsx` | `signInWithPassword({ phone, password })` + normalisation du numéro par pays |
| Connexion par numéro | `FormulaireCompte.tsx` ligne 211 | **Coupée** (décision du 30/09) : « les anciens comptes utilisent Google » |
| Langues | `src/i18n/fr.ts`, `en.ts` | Blocs `compte.*` et `ancien.*` déjà rédigés (dont `ancien.erreurs.telephoneInvalide`) |
| Support WhatsApp | `ancienCompte.ts` lignes 52-57 | `SUPPORT_WHATSAPP = 12015348324`, `lienSupport()` construit un `wa.me` prérempli |

À noter : `lienSupport()` prouve que l'app sait déjà ouvrir WhatsApp avec un message prérempli. L'étape 1 ne fait que réutiliser ce mécanisme avec un jeton de session.

### 2.2 Côté backend (`elearn-supabase`)

- Projet Supabase : `yhznbitjlzeslvudbsil`.
- `supabase/config.toml` : `enable_anonymous_sign_ins = true`, `enable_manual_linking = true`, `auth.sms.enable_signup = true`, **`auth.sms.enable_confirmations = false`**, fournisseur Twilio présent mais `enabled = false`, `auth.rate_limit.sms_sent = 30` par heure.
- **Aucun hook d'authentification n'est activé** (`auth.hook.*` entièrement commenté).
- Kapso, déjà en production :
  - `functions/_shared/whatsapp.ts` : envoi de modèles, `BASE_KAPSO = https://api.kapso.ai/meta/whatsapp/v24.0`, gestion 4xx définitif / 5xx-réseau réessayé, vérification de signature `X-Webhook-Signature`, idempotence `X-Idempotency-Key` ;
  - `functions/_shared/whatsapp_ui.ts` : **messages libres** (texte, liste, boutons, lien) dans la fenêtre de 24 h, avec les limites Meta appliquées à l'avance ;
  - `functions/whatsapp-webhook/index.ts` : webhook signé, répond 200 en moins de 10 s, traitements longs via `EdgeRuntime.waitUntil` ;
  - `functions/_shared/support_agent.ts` : agent support IA (Cloudflare Workers AI) branché sur le même webhook ;
  - `functions/parent-message-send/index.ts` : envoi des modèles parents depuis `parent_outbox`.
- Secrets déjà posés ou documentés (`docs/whatsapp-kapso.md`) : `WHATSAPP_MODE`, `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`, `WHATSAPP_ALLOWLIST`.
- Numéro WhatsApp de production : `phone_number_id` **`1270500312823859`** (WABA `1613624570492818`, `display_name` « Elearn Prepa », qualité GREEN, plafond `TIER_250`), numéro de support `12015348324` (indicatif +1). Attention : `597907523413541` est le **bac à sable** Kapso (`kind: sandbox`, WABA `2102230076919824`), pas la production. Un second numéro de production existe (`1387709354423791`, +1 201-534-2417), non branché sur l'API Cloud. **Point à trancher** : un numéro américain pour des élèves camerounais est un signal de confiance négatif — le message vient d'un numéro inconnu à l'étranger, ce qui ressemble à une arnaque. Bonne nouvelle sur le plan tarifaire : la catégorie « authentification internationale » ne concerne aujourd'hui que 18 marchés (Inde, Indonésie, Nigeria, Maroc, Afrique du Sud, Émirats…), **aucun des sept marchés d'Elearn Prepa**. Le risque tarifaire viendra d'une ouverture au Nigeria ou au Maroc, pas du numéro lui-même.

### 2.3 Comptes historiques : le gisement

Les anciens comptes ont été créés par Firebase Phone Auth, puis migrés dans Supabase avec leur numéro :

- `migrations/20260504231913_fix user auth .sql` : backfill de `firebase_uid` depuis les métadonnées Firebase ; e-mail de secours `concat(NEW.id::text, '@phone.elearnprepa.local')`.
- `migrations/20260404110000_streamline_mobile_phone_auth.sql` : `public.accounts.phone` normalisé, avec la règle camerounaise (12 chiffres commençant par `237` ramenés à 9 chiffres).
- `elearn_mobile/contexts/auth.tsx` ligne 491 : l'ancienne app se connecte déjà par `signInWithPassword({ phone })`, et `firebasePhoneAuth.native.ts` utilisait un vrai OTP SMS.

Conséquence directe : **pour ces élèves, un code WhatsApp remplace à la fois le mot de passe et le SMS**. C'est le gain produit le plus net de toute l'opération, avant même de parler de nouveaux comptes.

---

## 3. La contrainte qui décide de l'architecture : les règles de Meta

WhatsApp Business Platform distingue quatre catégories de messages :

| Catégorie | Nature | Facturation (grille du 1er octobre 2026) |
| --- | --- | --- |
| `authentication` | Code à usage unique, vérification d'identité | **Toujours payant, au message**, même dans la fenêtre de 24 h |
| `utility` | Suivi de commande, reçu, rappel | Payant au message, y compris dans la fenêtre depuis le 1er octobre 2026 |
| `marketing` | Promotion | Payant, tarif le plus élevé |
| `service` | **Réponse de l'entreprise dans la fenêtre de 24 h** | **Franc de 1 000 messages par mois et par numéro**, puis payant au tarif service |

Trois règles structurent tout le reste :

1. **Un code de connexion non sollicité doit partir d'un modèle de catégorie `authentication`.** On ne peut pas envoyer un code d'authentification en `utility` ou en `marketing` : Meta reclasse ou refuse le modèle, et un usage détourné expose le compte à une restriction. Et ce modèle est **facturé même si la fenêtre de service est ouverte** — c'est l'exception explicite de la grille.
2. **Créer un modèle `authentication` exige une entreprise vérifiée.** La vérification est gratuite, prend quelques jours, et débloque à la fois les modèles d'authentification et le palier d'envoi de 2 000 par jour. C'est le point de passage obligé de l'étape 2, et la cause la plus fréquente de refus est une discordance de nom d'entreprise.
3. **Tant que le client a écrit au numéro dans les 24 h, la réponse de l'entreprise est un message de service**, sans modèle. Il est franc jusqu'à 1 000 messages par mois et par numéro, puis facturé au tarif service. C'est ce qui rend l'étape 1 possible sans autorisation de Meta.

**Ce qui a changé le 1er octobre 2026** — et qui invalide les estimations antérieures, y compris celles consignées dans `PRIORITES.md` : les messages de service sont devenus facturables au-delà d'une franchise mensuelle, et les modèles `utility` ne sont plus gratuits dans la fenêtre de 24 h. Plus rien n'est facturé « à la conversation ». Toute estimation faite avant cette date doit être recalculée, ce que fait la section 8.

Autrement dit : la seule façon d'obtenir un code de connexion **sans autorisation Meta** est de faire en sorte que ce soit l'élève qui écrive le premier. Le coût, lui, n'est plus nul : il devient celui d'un message de service, dans la limite de la franchise.

**Une exception à connaître, et à exploiter plus tard** : une publicité Click-to-WhatsApp, ou le bouton d'appel à l'action d'une Page Facebook, ouvre une fenêtre dite « free entry point » pouvant durer **jusqu'à 7 jours**, et qui rend gratuites **toutes** les catégories, y compris l'authentification. Un élève qui arrive par ce chemin reçoit son code sans frais, à condition d'être sur l'application mobile. Un simple lien depuis notre propre site ne l'ouvre pas.

### 3.1 Ce que le modèle d'authentification impose, précisément

Détail confirmé dans la documentation Kapso ([templates/authentication](https://docs.kapso.ai/docs/whatsapp/templates/authentication)) :

- **Le corps du message est imposé par Meta** : `*{{1}}* is your verification code.` On ne peut pas écrire « Ton code Elearn Prepa ». Une seule variable, le code. Aucun en-tête autorisé.
- **Trois variantes de bouton** : `COPY_CODE` (« Copier le code », universel), `ONE_TAP` (remplissage automatique sur Android, exige le nom de paquet et l'empreinte de signature de l'application), `ZERO_TAP` (Android, sans aucune interaction).
- Options : `add_security_recommendation` (« ne partagez pas ce code ») et `code_expiration_minutes` (1 à 90).
- À l'envoi, le code doit être transmis **deux fois** : dans le corps et dans le paramètre du bouton.
- **Prérequis** : portefeuille d'entreprise Meta **vérifié**. La vérification est gratuite, prend quelques jours, et débloque à la fois les modèles d'authentification et le palier d'envoi. Les modèles d'authentification ne peuvent pas être envoyés depuis le bac à sable. Sur le seuil précis de 2 000 conversations par jour annoncé par certains fournisseurs ([Vonage](https://www.vonage.com/communications-apis/sms/)), la documentation Meta actuelle ne le reprend pas explicitement : **divergence non tranchée**, à confirmer au moment du dépôt du modèle. Le refus du 8 octobre reste, lui, un fait.

Le `ONE_TAP` mérite l'attention : sur Android — la quasi-totalité du public visé — le code se remplit tout seul dans l'application. C'est le seul argument d'expérience qui rend l'étape 2 strictement meilleure que l'étape 1, et il justifie de mener la vérification Meta même si l'étape 1 est déjà en production.

---

## 4. Architectures possibles

### Option A. Modèle d'authentification Meta + hook « Send SMS » de Supabase

**Principe.** On garde Supabase Auth comme autorité. L'app appelle `signInWithOtp({ phone })` ; Supabase génère le code et, au lieu de le confier à Twilio, appelle un **hook « Send SMS »** (Edge Function). Cette fonction envoie le code par Kapso avec un modèle `authentication` (`code_connexion`, français, bouton « Copier le code », expiration 10 minutes). L'élève saisit le code, l'app appelle `verifyOtp({ phone, token, type: 'sms' })` et obtient une session.

**Séquence**

```
Élève            App                    Supabase Auth            Edge Function         Kapso/Meta
  |  numéro  ->  signInWithOtp(phone) -> génère l'OTP  ------>  Send SMS hook  ---->  modèle authentication
  |  code    <-  (saisie)                                                                |
  |            verifyOtp(phone, token, type sms) <- session                              |
```

**Prérequis** : entreprise Meta vérifiée (le seuil de palier exact reste à confirmer, cf. §3.1), modèle `code_connexion` approuvé, hook activé, `auth.sms.enable_confirmations = true`.

**Point vérifié, décisif pour la faisabilité** : le hook « Send SMS » **remplace totalement le fournisseur SMS de Supabase**. Ce n'est pas seulement ce que dit la documentation (« The Send SMS Hook *replaces* Supabase's built-in SMS sending », [Supabase](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)) : c'est ce que fait le code source, où `GetSmsProvider()` n'est appelé que dans la branche `else` d'un `if (config.Hook.SendSMS.Enabled)` ([internal/api/phone.go](https://github.com/supabase/auth/blob/master/internal/api/phone.go)). Autrement dit : **aucun identifiant Twilio n'est nécessaire**, et aucun SMS ne partira jamais de chez Twilio sur ce chemin. Le drapeau « Phone provider » doit rester activé (pour que le chemin de code soit atteint), mais sans identifiants. Le hook est disponible **dès le plan gratuit**.

**Coût** : tarif Meta par message d'authentification, plus d'éventuels renvois. Voir section 8.

**Risques** : dépend entièrement de Meta (délai et issue de la vérification d'entreprise) ; le moindre changement de politique peut fermer le canal ; dépend aussi de la disponibilité du hook, dont le budget d'exécution est de 5 secondes.

### Option B. Fenêtre de service de 24 h (recommandée pour démarrer)

**Principe.** Aucun modèle, aucune autorisation Meta. L'élève ouvre WhatsApp depuis l'app avec un message prérempli contenant un jeton aléatoire. En l'envoyant, il **ouvre lui-même la fenêtre de 24 h** et nous révèle son numéro (`wa_id`) de façon fiable. Le webhook associe jeton et numéro dans une table. L'app, qui interroge cette table, déclenche alors l'OTP Supabase ; le hook « Send SMS » voit que la fenêtre est ouverte et envoie le code en **message libre de service** : gratuit dans la limite de 1 000 messages livrés par mois et par numéro, puis facturé au tarif service.

**Séquence**

```
1. App : génère `jeton` (128 bits, SecureStore) et l'affiche
2. App : ouvre  https://wa.me/<numero>?text=ELEARN%20<jeton>
3. Élève : appuie sur Envoyer dans WhatsApp
4. Kapso -> whatsapp-webhook : message entrant "ELEARN <jeton>", wa_id = +237...
   -> table whatsapp_auth_requests (jeton, telephone, expire_le, statut='ouvert')
   -> réponse libre : « Ton code arrive dans l'application Elearn. »
5. App (sondage) : POST /functions/v1/whatsapp-auth-etat { jeton }
   -> { statut: 'pret', telephone_masque: '+237 6•• ••• •••' }
6. App : signInWithOtp({ phone })   [ou updateUser({ phone }) si invité]
7. Supabase -> Send SMS hook -> Edge Function
   -> fenêtre ouverte pour ce numéro ? oui -> message libre avec le code (service, franc dans la limite mensuelle)
8. App : verifyOtp({ phone, token }) -> session
```

**Ce que ça coûte** : un message de service sortant par connexion, franc jusqu'à 1 000 par mois et par numéro, puis facturé au tarif service — de l'ordre de plusieurs fois moins qu'un message d'authentification. À cela s'ajoute l'abonnement Kapso, dont le quota compte **tous** les messages, entrants comme sortants. Détail et chiffres en section 8.

**Ce que ça coûte en expérience** : un aller-retour dans WhatsApp et un appui sur « Envoyer » avant de voir le code. Deux écrans au lieu d'un. C'est acceptable pour une première version, et surtout **déblocable cette semaine**.

**Garde-fous nécessaires** (sinon c'est une faille) :

- le jeton doit être à usage unique, à durée de vie courte (10 minutes) et stocké haché côté serveur ;
- la table `whatsapp_auth_requests` n'est **jamais** lisible par le client : seul un point d'entrée Edge Function, appelé avec le jeton, renvoie le statut, et il ne renvoie jamais le code, seulement l'état, le numéro complet (nécessaire à `verifyOtp`, et qui est celui de l'élève) et une version masquée pour l'affichage ;
- une limite par jeton (5 interrogations), par numéro (5 demandes par heure) et par IP ;
- le code Supabase reste généré et vérifié par Supabase Auth : on ne réinvente pas la vérification d'OTP, on ne fait que choisir le tuyau d'envoi.

**Ce qu'il ne faut pas tenter.** Une idée naturelle serait de vérifier le code nous-mêmes puis d'ouvrir une session Supabase. C'est une impasse : `verifyOtp` compare le jeton fourni à un hash que **Supabase** a généré et stocké, `generateLink` est réservé à l'e-mail (typage strict), et l'écriture directe dans `auth.users` n'est pas une API supportée. La seule voie détournée qui fonctionne (`admin.createUser({ phone, password })` puis `signInWithPassword`) impose de fabriquer un mot de passe que l'élève ne connaît pas. **Le hook est la bonne réponse, et c'est la seule.**

**Variante « message entrant direct »** : l'élève écrit simplement `ELEARN <jeton>` à la main ou depuis un lien collé. Utile en dépannage, mais l'ouverture depuis l'app reste le chemin normal.

### Option C. Fournisseur SMS classique (Twilio) via Supabase

**Principe.** On utilise le fournisseur SMS natif de Supabase, sans WhatsApp.

**Verdict : à écarter.** Trois raisons. Le coût par SMS en Afrique de l'Ouest et centrale est d'un ordre de grandeur supérieur au message WhatsApp d'authentification ; la délivrabilité SMS est mauvaise (filtrage opérateur, préfixes gris) ; et surtout cela rate la cible : ces élèves vivent dans WhatsApp, pas dans leurs SMS. Twilio reste la solution des tests locaux (le `config.toml` est déjà prérempli) et un repli si Kapso tombe.

### Option D. Statu quo (e-mail, Google, Apple, Facebook)

**Principe.** On ne fait rien.

**Verdict : acceptable mais coûteux en support.** C'est l'état actuel, il fonctionne, et il est gratuit. Mais il laisse deux trous : les anciens comptes à numéro dépendent encore d'un mot de passe oublié (le support WhatsApp doit les débloquer à la main, ce que `support-agent.md` décrit déjà), et une partie des élèves n'a pas d'adresse e-mail utilisée régulièrement.

---

## 5. Comparaison et recommandation

| Critère | A. Modèle Meta | B. Fenêtre 24 h | C. Twilio SMS | D. Statu quo |
| --- | --- | --- | --- | --- |
| Disponible aujourd'hui | Non (entreprise non vérifiée) | **Oui** | Oui | Oui |
| Coût Meta par connexion | Tarif authentification, **toujours facturé** | Tarif service, **franc jusqu'à 1 000 sortants par mois** | 0 | 0 |
| Coût opérateur | 0 | 0 | Élevé (SMS international) | 0 |
| Étapes pour l'élève | 2 (numéro, code) | 3-4 (numéro, WhatsApp, Envoyer, code) | 2 | 0 |
| Bouton « Copier le code » | Oui (et remplissage automatique Android) | Non (copie manuelle) | Non | — |
| Débloque les anciens comptes à numéro | Oui | **Oui** | Oui | Non |
| Dépendance externe | Meta + Kapso | Kapso seul | Twilio | — |
| Effort de développement | Moyen | Moyen | Faible | Nul |
| Réutilisable en étape A | — | **Oui, même code** | Non | — |

**Recommandation.**

1. Construire l'**option B** maintenant, derrière un drapeau PostHog `connexion_whatsapp`, avec les mêmes écrans et services que l'option A.
2. Mener **en parallèle** la vérification d'entreprise Meta et la montée de palier (déjà engagées).
3. Basculer sur l'**option A** quand le modèle `code_connexion` est approuvé : le changement se limite à la branche d'envoi dans l'Edge Function, plus le passage de `auth.sms.enable_confirmations` à `true`.
4. Garder Twilio configuré comme **repli d'urgence** si Kapso est indisponible, et l'e-mail/Google comme chemin toujours visible (règle App Store 4.8 : là où Google est proposé, Apple l'est aussi).

---

## 6. Mise en œuvre technique détaillée

### 6.1 Backend (`elearn-supabase`)

**Nouvelle migration `20261xxx_auth_whatsapp.sql`** (additive, comme l'exige `CLAUDE.md`) :

- table `public.whatsapp_auth_requests` :
  - `jeton_hash text primary key` (SHA-256 du jeton, jamais le jeton en clair),
  - `telephone text` (format E.164 sans `+`, comme `parent_contacts.phone`),
  - `user_id uuid` (rempli si la conversion d'un invité est connue d'avance),
  - `statut text` (`en_attente` | `ouvert` | `consomme` | `expire`),
  - `fenetre_jusqua timestamptz` (fin de la fenêtre de 24 h, `dernier_message_client + 24 h`),
  - `tentatives integer`, `cree_le`, `expire_le` (10 minutes) ;
- table `public.whatsapp_fenetres` (ou une colonne dans `parent_contacts`, à trancher) : `telephone` → `dernier_message_client_le`, alimentée par le webhook à chaque message entrant ;
- fonctions `SECURITY DEFINER` réservées à `service_role`, sur le modèle de `support_auth_start` (`migrations/20261008100000_support_agent.sql`) : `whatsapp_auth_ouvrir(p_jeton_hash, p_telephone)`, `whatsapp_auth_etat(p_jeton_hash)`, `whatsapp_auth_fermer(p_jeton_hash)` ;
- RLS activée, **aucun droit client**, exactement comme `parent_contacts` et `parent_outbox` ;
- purge automatique des demandes expirées.

**Nouvelle Edge Function `auth-whatsapp-otp`** (le hook « Send SMS » de Supabase) :

- reçoit le payload du hook : `user` (identifiant, `is_anonymous`, métadonnées), `sms.otp` (le code) et — champs présents dans le code mais non documentés — `sms.phone` (le destinataire réel) et `sms.sms_type` (`confirmation` ou `phone_change`). **Utiliser `sms.phone` avec repli sur `user.phone`** : en flux de changement de numéro, `user.phone` désigne encore l'ancien numéro ;
- vérifie la signature **Standard Webhooks** (`webhook-id`, `webhook-timestamp`, `webhook-signature`, secret au format `v1,whsec_…`) avant tout traitement, exactement comme le webhook Kapso vérifie déjà `X-Webhook-Signature` ;
- **décide du canal** : fenêtre de 24 h ouverte pour ce numéro → `whatsapp_ui.ts` (message libre de service) ; sinon → `whatsapp.ts` (modèle `code_connexion`) si `WHATSAPP_MODE=reel` et si le modèle est approuvé ; sinon → repli ;
- **répond en moins de 5 secondes** : c'est le budget total de Supabase, *retries inclus*. Le hook **écrit la demande dans une file** (`otp_outbox`, sur le modèle de `parent_outbox`) et répond `200` immédiatement, puis poursuit l'envoi en tâche de fond via `EdgeRuntime.waitUntil` — le mécanisme déjà utilisé dans `whatsapp-webhook`. Un envoi échoué reste `pending` et sera repris par un cron `pg_cron` (même schéma que `parent-summary`) ;
- respecte `WHATSAPP_MODE` et `WHATSAPP_ALLOWLIST`, comme le reste du code WhatsApp ;
- journalise chaque envoi (numéro masqué, canal, statut) pour l'audit ;
- **toutes ses réponses portent `Content-Type: application/json`** : sans cela, Supabase Auth transforme la réponse en erreur interne. Un échec transitoire de Kapso se traduit par un `503` avec en-tête `retry-after` non vide, seule façon de déclencher un nouvel essai ;
- ne lève jamais d'exception non gérée : un échec d'envoi doit produire une erreur propre remontée à l'app, pas une 500 opaque.

**Extension de `whatsapp-webhook`** : un crochet supplémentaire dans `traiterEvenement` (le paramètre `crochets` existe déjà) pour reconnaître `ELEARN <jeton>` et appeler `whatsapp_auth_ouvrir`.

**Nouvelle Edge Function `whatsapp-auth-etat`** : appelée par l'app avec le jeton, renvoie `{ statut, telephone_masque }` et rien d'autre. Limitation de débit par jeton et par IP.

**Nouvelle Edge Function `otp-outbox-send`** : le worker qui vide la file (mêmes conventions que `parent-message-send`), appelé en tâche de fond par le hook et rejoué par un cron toutes les minutes pour les envois restés en attente.

**Configuration Supabase à modifier** (dashboard et `config.toml`, hors dépôt). Chaque ligne de ce tableau est un piège vérifié : sans elle, la fonctionnalité ne marche pas, ou ne marche pas à l'échelle.

| Réglage | Valeur actuelle | Valeur cible | Pourquoi |
| --- | --- | --- | --- |
| `auth.sms.enable_confirmations` | `false` | **`true`** | Avec l'autoconfirmation activée, les inscriptions sont confirmées sans OTP et **le hook ne se déclenche jamais**. Panne silencieuse, aucune erreur levée. C'est le piège numéro un. |
| Expiration de l'OTP téléphone | **60 s** | **600 s** | Le défaut de Supabase est de 60 secondes, ce qui est intenable quand le code doit d'abord traverser WhatsApp. La documentation self-hosting reconnaît elle-même que « 60 seconds is often too short for production use ». À aligner sur `code_expiration_minutes` du modèle Meta. |
| `auth.rate_limit.sms_sent` | **30 / heure** | **à définir** (500 à 2 000) | Ce plafond est vérifié **avant** la bifurcation hook/fournisseur : activer le hook ne le supprime pas. À 30, la production plafonne à 30 codes par heure pour tout le projet. Aucun coût Supabase n'est plus en jeu, la limite est devenue artificielle. |
| Hook « Send SMS » | désactivé | activé, `https://<projet>/functions/v1/auth-whatsapp-otp`, secret Standard Webhooks | Le canal de livraison. |
| Fournisseur Twilio | présent, `enabled = false` | inchangé | Inutile avec le hook. À garder en réserve comme repli d'urgence. |
| CAPTCHA (Turnstile) | désactivé | à évaluer | Protection officielle recommandée par Supabase contre l'abus d'envoi. Sur une application React Native, l'intégration passe par une WebView : à ne faire que si les journaux montrent des abus. |
| `channel: 'whatsapp'` côté SDK | — | **ne pas utiliser** | Ce paramètre n'est consommé que par le fournisseur Twilio, qui n'est plus appelé. Sans effet avec un hook : source de confusion au débogage. |
| Modèle de SMS Supabase | `Your code is {{ .Code }}` | inchangé | **Ignoré** quand le hook est actif : c'est l'Edge Function qui compose le message. |

### 6.2 Application (`elearn-app`)

**Nouveaux fichiers**

- `src/services/compteWhatsapp.ts` : `demanderCodeWhatsapp`, `verifierCodeWhatsapp`, `ouvrirWhatsappConnexion`, `etatDemande` — sur le modèle de `compte.ts` (fonctions pures, client injecté, testables).
- `src/components/FormulaireWhatsapp.tsx` : deux étapes, un seul écran (numéro → code), conteneur `Ecran` (règle 12 d'`AGENTS.md`), indicateur de renvoi, compte à rebours, sélecteur d'indicatif réutilisant `INDICATIFS` et `normaliserTelephone` d'`ancienCompte.ts`.
- `src/app/compte/whatsapp.tsx` : route.
- Tests : `src/services/__tests__/compteWhatsapp.test.ts` (sur le modèle de `compte.test.ts`, client Supabase simulé) et un test d'écran pour les deux étapes et les erreurs.

**Fichiers modifiés**

- `src/components/FormulaireCompte.tsx` : bouton « Continuer avec WhatsApp » au-dessus des boutons sociaux, affiché seulement si le drapeau est actif. La ligne 211 (« connexion par numéro coupée ») devient caduque et doit être remplacée par un vrai renvoi vers le nouvel écran.
- `src/services/compte.ts` : `Methode` gagne `'whatsapp'`, `cleErreur` gagne les codes d'erreur téléphone (`otp_expired`, `phone_exists`, `over_sms_send_rate_limit`).
- `src/i18n/fr.ts` et `en.ts` : nouveau bloc `compte.whatsapp.*` (titre, texte, numéro, envoi, attente, code, renvoi, délai, erreurs). Les traductions `ancien.*` existantes servent de base.
- `src/components/parametres/Parametres.tsx` (section « Mon compte ») : « Ajouter mon numéro » pour un compte Google/Apple, puis affichage du numéro masqué. Réutilise l'écran en mode « lier ».
- Drapeau : lecture du drapeau PostHog côté app, même convention que les drapeaux existants, avec valeur de repli à `false`.

**Les deux cas à couvrir, et ils sont différents**

| Situation | Appel Supabase | Effet |
| --- | --- | --- |
| Invité qui crée son compte (le cas majoritaire) | `updateUser({ phone })` puis `verifyOtp({ phone, token, type: 'phone_change' })` | **Même identifiant** : progression, missions et série conservées. C'est le pendant exact du `updateUser({ email, password })` actuel |
| Élève existant qui se connecte | `signInWithOtp({ phone, shouldCreateUser: false })` puis `verifyOtp({ phone, token, type: 'sms' })` | Nouvelle session sur le compte existant, y compris un ancien compte à numéro |
| Nouveau compte sans invité | `signInWithOtp({ phone, shouldCreateUser: true })` | Compte créé ; le trigger `create_account_on_auth_insert` fabrique `accounts.email = <uuid>@phone.elearnprepa.local` |

Le premier cas est celui qui compte : **la conversion d'un invité préserve la progression**, exactement comme aujourd'hui avec l'e-mail. C'est la propriété à ne pas casser, et le test à écrire en premier.

### 6.3 Parcours de l'élève

**Étape 1 (fenêtre 24 h)** — écran unique, deux phases :

1. « Continue avec WhatsApp » : pays + numéro, bouton « Recevoir mon code sur WhatsApp ». L'app ouvre WhatsApp sur le message `ELEARN <jeton>`, puis affiche « Appuie sur Envoyer dans WhatsApp, puis reviens ici ».
2. Dès que l'état serveur passe à `pret`, l'app appelle `signInWithOtp`, passe à la saisie du code à 6 chiffres, et valide par `verifyOtp`.

**Détail d'implémentation qui compte** : pendant que l'élève est dans WhatsApp, l'application est en arrière-plan et ses minuteurs sont suspendus (iOS comme Android). Le sondage doit donc se déclencher **au retour au premier plan** (`AppState` / focus d'écran) et non par un `setInterval` permanent. C'est un écart à la règle 16 d'`AGENTS.md` sur la cadence des sondes, à traiter explicitement : ici la sonde est déclenchée par un évènement de focus, pas par une horloge.

**Variante sans sondage**, à garder pour l'étape 2 : la réponse WhatsApp contient un lien `https://app.elearnprepa.com/...` qui rouvre directement l'application (les fichiers `assetlinks.json` et `apple-app-site-association` sont déjà servis sur ce domaine, cf. `PRIORITES.md` ligne 18). L'élève revient d'un appui sur le lien, l'app sait que la fenêtre est ouverte, et le sondage disparaît. À retenir seulement si les essais montrent des retours manuels laborieux.

**Étape 2 (modèle Meta)** — le même écran sans la phase 1 : numéro, « Recevoir le code », saisie. Le bouton « Copier le code » de WhatsApp réduit la friction à un seul geste, et le bouton `ONE_TAP` remplit le champ tout seul sur Android.

---

## 7. Sécurité, abus et conformité

| Risque | Gravité | Mitigation prévue |
| --- | --- | --- |
| Énumération de comptes (savoir si un numéro est inscrit) | Moyenne | `shouldCreateUser` décidé par le contexte (création vs connexion), messages d'erreur génériques, jamais « ce numéro n'existe pas » |
| Bombardement d'OTP sur un tiers | Élevée | Limite par numéro (5/heure, alignée sur `support_auth_requests`), par IP et par jeton ; CAPTCHA Turnstile sur la demande si nécessaire ; alerte interne au-delà d'un seuil |
| Jeton de session volé (étape 1) | Élevée | Jeton de 128 bits, stocké haché, usage unique, 10 minutes, jamais renvoyé par l'API ; la table n'est pas lisible par le client |
| Prise de contrôle d'un ancien compte par recyclage du numéro | Élevée | Le numéro devient un facteur d'authentification unique : pour les comptes porteurs d'achats, exiger un second facteur (Google lié, ou mot de passe) ; journaliser et notifier à la première connexion WhatsApp sur un compte qui en avait un autre |
| Doublons de comptes (téléphone vs e-mail/Google) | Moyenne | Détection avant création sur `public.accounts.phone` ; proposer la liaison (`linkIdentity`) plutôt qu'un nouveau compte ; écran de reprise existant |
| Fuite du numéro dans les journaux | Moyenne | Masquage systématique (`+237 6•• ••• •••`) dans tous les journaux, comme le prévoit déjà `mask_phone_numbers` côté base |
| Énumération d'utilisateurs sur le flux téléphone | Moyenne | **Non documentée par Supabase** (les protections anti-énumération sont documentées pour l'e-mail seulement). À valider empiriquement en recette, avec un message d'erreur uniforme côté interface quelle que soit la cause |
| `shouldCreateUser` laissé à sa valeur par défaut | Élevée | Le défaut est `true` : sur l'écran de **connexion**, un numéro inconnu créerait un compte. Toujours passer explicitement `false` en connexion, `true` en création |
| Opt-in WhatsApp absent | Élevée | Meta exige un consentement pour les messages business-initiated : la demande de code depuis l'app vaut sollicitation, mais l'étape 2 doit s'appuyer sur cette demande explicite et journalisée (une ligne par envoi) |
| Restriction du compte WhatsApp Business | Élevée | Respect strict des catégories ; aucun code de connexion en `utility` ; quota interne d'envoi bien en dessous du palier Meta |

**Conformité.** Le numéro de téléphone est une donnée personnelle : il entre dans la politique de confidentialité, il est supprimable avec le compte, et le consentement WhatsApp est horodaté comme l'est déjà celui des parents (`parent_contacts.consent_at`). Rien à ajouter côté RGPD au-delà de ce qui existe pour les parents, mais la page de confidentialité doit mentionner l'usage de WhatsApp pour l'authentification.

---

## 8. Simulation des coûts

Classeur paramétrique joint : [`simulation-couts-connexion-whatsapp.xlsx`](simulation-couts-connexion-whatsapp.xlsx) — trois feuilles (Simulateur, Scénarios, Hypothèses et sources), toutes les hypothèses dans les cellules jaunes. Il se régénère par `python scripts/simulation-couts-whatsapp.py`.

### 8.1 Qui facture quoi

| Acteur | Base de facturation | Ce que ça implique ici |
| --- | --- | --- |
| **Meta** | Par message, par catégorie et par marché | Le seul coût variable réel. Aucune variation horaire ni par canal |
| **Kapso** | Abonnement mensuel + quota de messages **entrants et sortants** | La fenêtre 24 h consomme deux messages par connexion (celui de l'élève et le code), le modèle un seul |
| **Supabase** | Utilisateurs actifs mensuels, jamais les SMS | Avec le hook, la livraison est entièrement chez Kapso : **aucun coût Supabase supplémentaire** tant que le projet reste sous les 50 000 MAU du plan gratuit (100 000 en Pro) |

Tarifs Meta retenus (USD par message, grille du 1er octobre 2026) :

| Marché | Authentification | Service | Utility |
| --- | --- | --- | --- |
| Cameroun, Côte d'Ivoire, Sénégal, Gabon, Burkina Faso (« Rest of Africa ») | 0,0040 | 0,0040 | 0,0040 |
| RD Congo (tarif « Other », à confirmer) | 0,0077 | 0,0077 | 0,0077 |
| France | 0,0300 | 0,0300 | 0,0300 |

**Fait décisif, et contre-intuitif** : depuis le 1er juillet 2025, Meta facture **le même prix** pour l'authentification, l'utilité et le service sur un marché donné. Le prix unitaire ne départage donc **pas** l'étape 1 de l'étape 2. Ce qui les départage, c'est la **franchise de 1 000 messages de service par mois et par numéro** : les messages de service y sont francs, les messages d'authentification jamais.

### 8.2 Résultat : l'étape 1 est aussi la moins chère aux volumes réalistes

Avec le mix pays du simulateur (80 % Cameroun, 20 % répartis sur cinq pays africains et la France), 15 % de renvoi, l'abonnement Kapso Pro et Supabase Pro :

| Connexions / mois | Étape 1 — fenêtre 24 h | Étape 2 — modèle Meta |
| --- | --- | --- |
| 500 | **50,00 $** (Meta 0,00) | 52,80 $ (Meta 2,80) |
| 2 000 | **56,32 $** (Meta 6,32) | 61,18 $ (Meta 11,18) |
| 10 000 | **101,06 $** (Meta 51,06) | 105,92 $ (Meta 55,92) |
| 50 000 | 339,73 $ (Meta 274,73) | **329,60 $** (Meta 279,60) |

Décomposition à 2 000 connexions par mois, étape 1 : **Kapso 25 $ + Supabase 25 $ + Meta 6,32 $ = 56,32 $**, soit **2,8 cents par connexion**. À 10 000 connexions, le coût par connexion tombe à **1 cent**.

À 500 connexions par mois, la franchise de 1 000 messages de service absorbe tout : **le coût Meta est nul**, et la dépense se réduit aux deux abonnements, déjà payés par ailleurs pour WhatsApp et Supabase.

### 8.3 Le scénario réel du projet : Kapso Free et Supabase Free

Le projet est aujourd'hui sur les **formules gratuites** des deux services. Cela change le total du tout au tout, et le tableau ci-dessus doit être lu avec ce correctif.

- **Supabase Free** : 0 $, 50 000 utilisateurs actifs mensuels inclus, et **aucun dépassement facturé**. Économie sèche de 25 $ par mois par rapport à l'hypothèse Pro.
- **Kapso Free** : 0 $, **2 000 messages par mois** (entrants et sortants), 1 numéro, et **aucun prix de dépassement publié** — au-delà, il faut passer au plan Pro à 25 $. C'est donc le quota, et non le prix, qui décide.

Le seul coût réel devient celui de Meta. Étape 1 (fenêtre de service de 24 h), 15 % de renvoi, mix pays du simulateur :

| Connexions / mois | Meta | Kapso | Supabase | **Total** |
| --- | --- | --- | --- | --- |
| 250 | 0,00 $ | 0 $ | 0 $ | **0,00 $** |
| 500 | 0,00 $ | 0 $ | 0 $ | **0,00 $** |
| 870 | 0,00 $ | 0 $ | 0 $ | **0,00 $** |
| 930 | 0,32 $ | 0 $ | 0 $ | **0,32 $** |
| 1 000 | 0,69 $ | 25 $ | 0 $ | **25,69 $** |
| 2 000 | 6,02 $ | 25 $ | 0 $ | **31,02 $** |
| 5 000 | 22,00 $ | 25 $ | 0 $ | **47,00 $** |
| 10 000 | 48,63 $ | 25 $ | 0 $ | **73,63 $** |

**Trois seuils à retenir :**

1. **870 connexions par mois** — la franchise de 1 000 messages de service de Meta est épuisée. En dessous, **le coût total est rigoureusement nul** : rien à payer nulle part.
2. **930 connexions par mois** — les 2 000 messages du plan Kapso Free sont épuisés (la fenêtre de 24 h en consomme deux par connexion). C'est le vrai mur : à partir de là, il faut passer au plan Pro, soit **25 $ qui tombent d'un coup**.
3. **1 739 connexions par mois** en étape 2 — le modèle d'authentification ne consomme qu'un message par connexion, le quota gratuit tient donc deux fois plus longtemps. Mais Meta facture chaque message, franchise ou pas : l'étape 2 coûte 2,66 $ dès 500 connexions.

**Deux réserves qui peuvent rapprocher le mur.**

- Le quota de 2 000 messages du plan Kapso Free est **partagé avec tout le projet** : les résumés hebdomadaires aux parents, les reçus de paiement et l'agent support consomment le même compteur. Si ces envois passent un jour en mode réel (`WHATSAPP_MODE=reel`), la marge gratuite pour l'authentification se réduit d'autant, et le passage au plan Pro devient inévitable.
- Les montants ci-dessus sont au **tarif Meta seul**. Si le WABA d'Elearn n'est pas libellé en dollars, Kapso applique une marge de change de 5 % : ajoutez 5 % à la colonne Meta.

La feuille « Free Kapso et Supabase » du classeur reproduit ces deux tableaux (étape 1 et étape 2) et les trois seuils.

### 8.4 Le point de bascule, à connaître

L'étape 2 redevient moins chère au-delà d'environ **47 500 connexions par mois**. La raison n'est pas Meta mais Kapso : l'étape 1 consomme deux messages par connexion (un entrant, un sortant) contre un seul pour un modèle, et franchit donc le quota de 100 000 messages du plan Pro deux fois plus tôt. C'est un horizon très au-delà du trafic attendu à l'ouverture ; le simulateur permet de le vérifier pour toute hypothèse de croissance.

### 8.5 Économie annexe à ne pas oublier : la fenêtre « free entry point »

Une publicité Click-to-WhatsApp ou le bouton d'appel à l'action d'une Page Facebook ouvre une fenêtre **pouvant aller jusqu'à 7 jours**, et — c'est l'exception — **elle rend gratuites toutes les catégories, y compris l'authentification**. Un élève qui arrive par ce chemin reçoit un code d'authentification sans frais, à condition d'être sur l'application mobile (ni le web ni le bureau ne déclenchent la fenêtre). Un lien depuis notre propre site ne l'ouvre pas.

À retenir comme levier pour plus tard : si une campagne d'acquisition WhatsApp est lancée, la connexion par code devient gratuite pour les élèves qui en viennent.

### 8.6 Ce que le chiffrage ne dit pas

- **Le coût du statu quo est de 0 $**, mais ce n'est pas son coût réel : chaque ancien compte bloqué par un mot de passe perdu consomme du temps de support via l'agent WhatsApp. Ce temps n'est pas chiffré ici, et c'est probablement le premier poste d'économie.
- **La RD Congo est facturée au double** si Meta la classe en « Other » (le pays n'apparaît pas dans la liste officielle, qui contient le Congo-Brazzaville mais pas la RD Congo). Sur 3 % du trafic, l'effet est faible ; sur un marché élargi, il ne l'est plus.
- **Les remises de volume existent mais ne sont pas chiffrées** : la structure est connue (six bandes, jusqu'à −25 %, agrégées au niveau du portefeuille d'entreprise), les seuils ne sont pas publics. Sans effet à nos volumes.
- **Le mode de facturation Meta du WABA et sa devise sont à vérifier** dans le tableau de bord Kapso : ils déterminent qui encaisse, et une marge de change de 5 % s'ajoute si le WABA n'est pas libellé en dollars.
- **Le coût de Twilio n'a pas été chiffré** : la page tarifaire par pays n'est pas exploitable automatiquement. L'argument contre le SMS reste qualitatif (prix unitaire supérieur, délivrabilité, et un public qui vit dans WhatsApp), pas chiffré.
- **Aucun frais d'installation Kapso n'est publié**, et il n'existe pas de tarif public au-delà de la grille des plans.

### 8.7 Lecture pour la décision

Le coût de cette fonctionnalité est, dans tous les scénarios réalistes, **du même ordre que deux abonnements logiciels** : 50 à 105 $ par mois entre 500 et 10 000 connexions. Le risque financier n'est pas là. Il est dans la dépendance à Meta (vérification d'entreprise, catégories de messages) et dans la robustesse du dispositif anti-abus, qui n'est pas un poste de dépense mais un poste de rigueur.

---

## 9. Plan d'implémentation

Hypothèse de charge : une session de développement pour le backend, une pour l'app, plus la recette par Benny.

### Phase 0 — préalables administratifs et vérifications (Benny, en parallèle)

| # | Action | Responsable | Bloquant pour |
| --- | --- | --- | --- |
| 0.1 | Vérification de l'entreprise dans Meta Business (gratuite, quelques jours, cause n°1 de refus : discordance de nom) | Benny | Étape 2 uniquement |
| 0.2 | Vérifier le palier d'envoi et le relever si nécessaire (la vérification le débloque) | Benny | Étape 2 uniquement |
| 0.3 | Redéposer le modèle `code_connexion` (français, bouton « Copier le code », expiration 10 min) | Benny | Étape 2 uniquement |
| 0.4 | Confirmer avec Kapso le tarif et le mode de facturation (abonnement, refacturation Meta) | Benny | Section 8 |
| 0.5 | Vérifier le numéro de production : un numéro français ou camerounais est-il possible ? | Benny + Kapso | Confiance et tarif |
| 0.6 | Compter les comptes avec `auth.users.phone` non nul et les élèves actifs correspondants | Benny (SQL) | Priorisation |
| 0.7 | Décider : ouvre-t-on WhatsApp à tous, ou d'abord aux anciens comptes ? | Benny | Périmètre |
| 0.8 | Relever le plafond `sms_sent` (30/h) et porter l'expiration de l'OTP téléphone de 60 s à 600 s | Benny | Phase 1 |
| 0.9 | Mesurer la consommation Kapso actuelle (quota du plan, messages par mois, mode de facturation Meta) | Benny | Section 8 |

**Vérification technique préalable, à faire avant d'écrire l'écran** (une heure, sur le projet de recette) : confirmer que `updateUser({ phone })` puis `verifyOtp({ type: 'phone_change' })` convertit bien une **session anonyme** en compte permanent **sans changer d'identifiant**. C'est la propriété qui garantit qu'un invité ne perd pas sa progression, et elle conditionne le design de l'écran. Si elle ne tient pas, le repli est de créer le compte puis d'appeler la reprise de progression existante (`repriseInvite`).

### Phase 1 — socle backend (1 à 2 sessions)

1. Migration additive : `whatsapp_auth_requests`, `whatsapp_fenetres`, `otp_outbox`, fonctions `SECURITY DEFINER`, RLS, purge. Tests pgTAP dans `supabase/tests/` (nouveau fichier `auth_whatsapp.sql`) : ouverture, expiration à 10 minutes, usage unique, limite de débit, absence totale de droits `anon`/`authenticated`.
2. `functions/_shared/auth_whatsapp.ts` : logique pure (choix du canal selon la fenêtre, formatage du message, masquage, vérification de signature Standard Webhooks) + `auth_whatsapp_test.ts` en Deno, sur le modèle de `whatsapp_test.ts`.
3. `functions/auth-whatsapp-otp/index.ts` : le hook « Send SMS » (réponse immédiate, envoi en tâche de fond).
4. `functions/otp-outbox-send/index.ts` : le worker de la file.
5. `functions/whatsapp-auth-etat/index.ts` : le point d'interrogation de l'app.
6. Crochet `ELEARN <jeton>` dans `whatsapp-webhook`.
7. Réglages Supabase du tableau 6.1 (confirmations, expiration, plafond, hook), puis `npx supabase@2.118.0 test db` en local, `supabase functions serve`, et essai de bout en bout avec `WHATSAPP_MODE=fictif`.

**Critère de sortie** : un message entrant `ELEARN <jeton>` depuis un numéro de test ouvre la demande, la fonction d'état renvoie `pret` et un numéro masqué, le hook produit le bon corps de message en mode fictif, et un test prouve qu'aucun rôle client ne peut lire les tables.

### Phase 2 — écran et service côté app (1 à 2 sessions)

1. `src/services/compteWhatsapp.ts` + tests (client Supabase simulé) : les trois cas du tableau 6.2, les erreurs, la normalisation du numéro.
2. `src/components/FormulaireWhatsapp.tsx` + `src/app/compte/whatsapp.tsx`, conteneur `Ecran`, tokens du design system.
3. i18n `fr` et `en`.
4. Bouton dans `FormulaireCompte.tsx`, derrière le drapeau.
5. `npm run valider` (typage, Jest `--runInBand`, export Android).

**Critère de sortie** : un invité qui passe par WhatsApp retrouve sa mission en cours après connexion ; un ancien compte à numéro se connecte sans mot de passe ; aucune régression sur les tests `compte.test.ts`, `session.test.ts`, `repriseInvite`.

### Phase 3 — liaison et paramètres (1 session)

1. « Ajouter mon numéro » pour un compte Google/Apple (`updateUser({ phone })` + `verifyOtp` type `phone_change`).
2. Détection des doublons avant création, renvoi vers l'écran de reprise.
3. Test : un compte Google qui ajoute un numéro déjà rattaché à un ancien compte reçoit un message clair au lieu d'un doublon.

**Pourquoi cette phase n'est pas facultative.** Supabase ne rapproche automatiquement les identités **que par adresse e-mail** ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). Un compte créé par téléphone a un e-mail vide : si cet élève se connecte ensuite avec Google, Supabase crée **un second compte distinct**, et il ne verra pas sa progression. Il n'existe aucun réglage « rapprochement automatique » à activer, seulement le manual linking (étiqueté beta). La liaison doit donc être **proposée explicitement dans l'application** — c'est un choix produit, pas un détail technique. Corollaire : un élève qui entre par WhatsApp doit être invité, après sa première mission, à ajouter une adresse e-mail ou un compte Google.

### Phase 4 — ouverture progressive (1 session, en continu)

1. Drapeau PostHog `connexion_whatsapp`, d'abord `false` partout, puis activé pour Benny, puis pour 5 % des élèves, puis général.
2. Évènements PostHog : `whatsapp_demande_ouverte`, `whatsapp_code_envoye`, `whatsapp_code_valide`, `whatsapp_code_echoue`, avec le canal (`fenetre` | `modele`) et le pays.
3. Tableau de bord : taux de réussite, délai médian entre l'ouverture de WhatsApp et la validation, taux de renvoi, erreurs par pays.
4. Bascule sur le modèle Meta le jour où il est approuvé (un seul point de code).

### Retour arrière

- Drapeau PostHog à `false` : l'écran disparaît, l'e-mail et Google restent intacts.
- `WHATSAPP_MODE=fictif` : plus rien ne part, sans toucher au code.
- La migration est purement additive : aucune table ni fonction existante n'est modifiée, donc aucune restauration de données n'est nécessaire pour revenir en arrière.
- Le hook peut être désactivé dans le dashboard Supabase : on retombe sur Twilio (déjà configuré) ou sur l'e-mail.

### Estimation d'effort

| Phase | Effort | Dépendance externe |
| --- | --- | --- |
| 0 | Benny | Meta, Kapso |
| 1 | 1 à 2 sessions | aucune |
| 2 | 1 à 2 sessions | Phase 1 |
| 3 | 1 session | Phase 2 |
| 4 | 1 session | drapeau, analytics |

**L'étape 1 (option B) est livrable sans aucune autorisation de Meta.** C'est le point décisif du plan.

---

## 10. Décisions attendues

1. **Périmètre d'ouverture** : tous les élèves, ou d'abord les anciens comptes à numéro ? (Recommandé : anciens comptes d'abord, c'est le gain immédiat et le risque le plus faible.)
2. **Numéro WhatsApp** : garde-t-on le numéro américain actuel, ou en demande-t-on un français/camerounais à Kapso ? (Recommandé : au moins tester un numéro local, pour la confiance et pour le tarif.)
3. **Numéro comme authentification unique** : accepte-t-on qu'un porteur de la ligne prenne la main sur un ancien compte, y compris avec des achats ? (Recommandé : oui, mais second facteur obligatoire pour les comptes avec achats.)
4. **Mot de passe conservé** : garde-t-on le champ mot de passe sur l'écran de connexion en plus de WhatsApp ? (Recommandé : oui au début, pour ne rien casser.)
5. **Priorité** : cette étude passe-t-elle avant le paiement pawaPay dans l'app (#35) et l'analytique (#17) ? (La classification actuelle en P2 la place après.)
6. **Devise de facturation du WABA** : elle est **figée à la création du compte et non modifiable**, et l'euro et le dollar ne sont pas convertibles entre eux. Si ce choix n'est pas encore fait, il doit l'être **avant** de finaliser le compte Kapso — une erreur se corrige par la création d'un nouveau WABA et la migration du numéro.
7. **Numéros WhatsApp et franchise de service** : la franchise de 1 000 messages de service par mois s'applique **par numéro**. Un numéro par usage (support, parents, authentification) multiplie la franchise mais aussi la complexité. (Recommandé : un seul numéro au début.)

---

## 11. Sources et références internes

- `elearn-app/docs/PRIORITES.md` lignes 39-45 : demande du 8 octobre, piste du hook « Send SMS », refus Meta, premières estimations de coût.
- `elearn-supabase/docs/whatsapp-kapso.md` : mise en service Kapso, secrets, modèles, premier envoi réel.
- `elearn-supabase/docs/support-agent.md` : vérification du compte par l'application (modèle réutilisable pour l'écran de liaison).
- `elearn-supabase/supabase/migrations/20261007200000_parent_whatsapp.sql` et `20261008100000_support_agent.sql` : conventions de table, de normalisation de numéro et de `SECURITY DEFINER`.
- `elearn-supabase/supabase/functions/_shared/whatsapp.ts`, `whatsapp_ui.ts`, `support_agent.ts` : envoi de modèles, messages libres, webhook.
- `elearn-mobile/contexts/auth.tsx`, `lib/firebasePhoneAuth.native.ts` : origine des comptes à numéro.
- `elearn-app/src/services/ancienCompte.ts`, `compte.ts`, `session.ts` : normalisation des numéros, conversion d'invité, reprise de progression.
- Tarifs et règles Meta, offre Kapso, tarification Supabase : voir section 8 et le tableur joint.
- Notes de recherche brutes, avec toutes les sources et les incertitudes : [`annexes/recherche-tarifs-meta-whatsapp.md`](annexes/recherche-tarifs-meta-whatsapp.md) et [`annexes/recherche-supabase-auth-telephone.md`](annexes/recherche-supabase-auth-telephone.md).

### Sources externes (relevées le 8 octobre 2026)

**Supabase Auth**

- Phone sign-in : https://supabase.com/docs/guides/auth/phone-login
- Send SMS Hook : https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
- Auth Hooks (plans, signature Standard Webhooks, budget de 5 s) : https://supabase.com/docs/guides/auth/auth-hooks
- Rate limits : https://supabase.com/docs/guides/auth/rate-limits
- Identity linking (rapprochement par e-mail uniquement) : https://supabase.com/docs/guides/auth/auth-identity-linking
- CAPTCHA : https://supabase.com/docs/guides/auth/auth-captcha
- Authentification par mot de passe, dont le cas « téléphone » et l'avertissement sur les numéros recyclés : https://supabase.com/docs/guides/auth/passwords
- Code source décisif (`if/else` hook/fournisseur, `sms.phone`, validation E.164) : https://github.com/supabase/auth/blob/master/internal/api/phone.go
- Configuration et valeurs par défaut (expiration OTP 60 s) : https://github.com/supabase/auth/blob/master/internal/conf/configuration.go
- Tarification et MAU : https://supabase.com/pricing et https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users

**Kapso**

- Tarification : https://kapso.com/pricing
- FAQ tarifaire (quota de messages entrants et sortants) : https://docs.kapso.ai/docs/whatsapp/pricing-faq
- Facturation des frais Meta (modes, marge de change) : https://docs.kapso.ai/docs/whatsapp/meta-message-billing
- Modèles d'authentification (corps imposé, `COPY_CODE`, `ONE_TAP`, prérequis) : https://docs.kapso.ai/docs/whatsapp/templates/authentication
- Limites de débit : https://docs.kapso.ai/api/rate-limits
- Configuration instantanée du numéro : https://docs.kapso.ai/docs/platform/phone-numbers/instant-setup

**Meta**

- Tarification WhatsApp Business Platform : https://developers.facebook.com/docs/whatsapp/pricing

**Réserve sur les sources.** Les tarifs de la section 8 proviennent de la grille Meta en vigueur au 1er octobre 2026, recoupée par plusieurs compilations datées et par la documentation Kapso, mais **le fichier officiel des tarifs n'a pas pu être lu directement** (les « CSV » de Meta sont en réalité des classeurs, et la page n'est pas exploitable automatiquement). Les valeurs sont donc des **paramètres de simulation**, modifiables dans les cellules jaunes du tableur, et non des engagements contractuels. Deux points restent explicitement ouverts : le classement de la RD Congo (« Rest of Africa » ou « Other », écart de 1,9) et les seuils chiffrés des remises de volume. À noter aussi que la grille a changé le 1er octobre 2026 (messages de service devenus facturables au-delà de la franchise) : toute estimation antérieure, y compris celle consignée dans `PRIORITES.md` ligne 45, doit être considérée comme périmée.
