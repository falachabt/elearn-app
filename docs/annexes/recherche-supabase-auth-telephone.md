# Supabase Auth — OTP par téléphone et livraison via un fournisseur WhatsApp maison (Kapso)

Fiche factuelle et sourcée. Chaque affirmation technique est adossée à une source ; les points non documentés sont signalés comme tels.

---

## 1. Flux `signInWithOtp({ phone })` + `verifyOtp({ phone, token, type })`

### Flux exact

**Étape 1 — demande d'OTP.** `signInWithOtp({ phone })` envoie un code à 6 chiffres ([Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)) :

```js
const { data, error } = await supabase.auth.signInWithOtp({ phone: '+13334445555' })
```

Équivalent HTTP : `POST /auth/v1/otp` avec `{"phone": "..."}`.

**Étape 2 — vérification.** `verifyOtp` avec `type: 'sms'` retourne une session complète ([verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp)) :

```js
const { data: { session }, error } = await supabase.auth.verifyOtp({
  phone: '13334445555',
  token: '123456',
  type: 'sms',
})
```

Équivalent HTTP : `POST /auth/v1/verify` avec `{"type": "sms", "phone": "...", "token": "..."}`. La réponse contient `access_token`, `token_type: "bearer"`, `expires_in: 3600`, `refresh_token`.

Note : dans l'exemple JS du SDK le `phone` de `verifyOtp` est passé **sans** le `+` (`'13334445555'`), alors que `signInWithOtp` l'exige avec `+`. Le serveur normalise en retirant `+` et les espaces avant de comparer (voir `formatPhoneNumber` dans [internal/api/phone.go](https://github.com/supabase/auth/blob/master/internal/api/phone.go)).

### Types d'OTP téléphone

Le type est défini dans `@supabase/auth-js` ([src/lib/types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)) :

```ts
export type MobileOtpType = 'sms' | 'phone_change'
```

- `sms` — connexion / confirmation de numéro à l'inscription.
- `phone_change` — changement de numéro : à utiliser **après** `updateUser({ phone })` pour valider le nouveau numéro. La doc est explicite : « Use the `phone_change` type when calling `verifyOTP` to update a user's phone number. » ([Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)).

Il n'existe **que** ces deux types pour le téléphone. (Les types email sont distincts : `signup`, `invite`, `magiclink`, `recovery`, `email_change`, `email`.) `resend()` accepte aussi `type: 'sms' | 'phone_change'`.

### Durées d'expiration et fréquence

| Paramètre | Valeur par défaut | Source |
|---|---|---|
| Expiration de l'OTP SMS | **60 secondes** | Doc : « a 6-digit pin that you must verify within 60 seconds » ([Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)) ; confirmé par le code `if config.Sms.OtpExp == 0 { config.Sms.OtpExp = 60 }` ([internal/conf/configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)) |
| Longueur de l'OTP | 6 chiffres (configurable 6–10) | `GOTRUE_SMS_OTP_LENGTH`, même fichier |
| Fréquence max par utilisateur | 60 s entre deux demandes (`GOTRUE_SMS_MAX_FREQUENCY`, défaut `1m`) | [internal/conf/configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go) |
| Expiration OTP email (pour contraste) | 3600 s en self-hosted | `GOTRUE_MAILER_OTP_EXP` |

⚠️ **Piège de configuration** : le fichier `example.env` du dépôt auth contient `GOTRUE_SMS_OTP_EXP="6000"`, ce qui contredit la valeur par défaut réelle (60) et la doc. C'est une valeur d'exemple erronée/trompeuse dans [example.env](https://github.com/supabase/auth/blob/master/example.env) — ne pas s'y fier. La source de vérité est `ApplyDefaults()` dans `configuration.go` et la doc self-hosting qui écrit noir sur blanc : « The default OTP expiration is **60 seconds**. This is often too short for production use, consider increasing it. » ([Configure Phone Sign-in & MFA](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa)).

### Configuration requise dans le dashboard

1. **Auth Providers** → activer le **Phone provider** ([Auth Providers page](https://supabase.com/dashboard/project/_/auth/providers), décrit dans [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)).
2. **SMS provider** — la doc indique : « You also need to set up an SMS provider. Each provider has its own configuration. Supported providers include MessageBird, Twilio, Vonage, and TextLocal (community-supported). » Les fournisseurs intégrés listés dans le CLI sont `twilio`, `twilio_verify`, `messagebird`, `textlocal`, `vonage` ([Supabase CLI config — `auth.sms.<provider>.enabled`](https://supabase.com/docs/guides/local-development/cli/config)).
3. **Enable phone confirmations** — équivalent CLI `auth.sms.enable_confirmations` (défaut `false`) : « If enabled, users need to confirm their phone number before signing in. » ([Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config)). Côté self-hosted c'est `GOTRUE_SMS_AUTOCONFIRM` (défaut `false`, donc confirmation demandée) ([example.env](https://github.com/supabase/auth/blob/master/example.env)).
4. **Template SMS** — `auth.sms.template` / `GOTRUE_SMS_TEMPLATE`. Template par défaut dans le code : `Your code is {{ .Code }}` ; la valeur livrée dans `example.env` est `This is from supabase. Your code is {{ .Code }} .` ([configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go), [example.env](https://github.com/supabase/auth/blob/master/example.env)).

⚠️ **Point important sur le template** : quand le Send SMS Hook est actif, le template SMS de Supabase **n'est plus utilisé** — c'est votre code (le hook) qui compose le message. Voir §2.

### ⚠️ WhatsApp natif vs Kapso

La doc précise : « At this time, `WhatsApp` is only supported as a channel for the Twilio and Twilio Verify Providers. » ([Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)). Le SDK expose `options.channel: 'sms' | 'whatsapp'` ([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)), et le provider Twilio implémente le canal WhatsApp dans `SendMessage` ([sms_provider/twilio.go](https://github.com/supabase/auth/master/internal/api/sms_provider/twilio.go)).

**Conséquence pour Kapso** : le paramètre `channel: 'whatsapp'` est consommé **par le provider SMS intégré**, pas par le hook. Comme le hook remplace l'appel au provider (voir §2), ce paramètre n'a aucun effet sur ce chemin. Avec un hook Kapso, c'est votre Edge Function qui décide du canal — Kapso fait du WhatsApp de toute façon.

---

## 2. Le « Send SMS Hook » — et le point critique du fournisseur

### Ce qu'il fait

« The Send SMS Hook **replaces** Supabase's built-in SMS sending. » ([Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)). Cas d'usage documentés : fournisseur SMS régional, **canaux alternatifs tels que WhatsApp**, fallback entre providers, personnalisation du corps du message.

### Payload envoyé

Entrées documentées : `user` ([objet User](https://supabase.com/docs/guides/auth/users#the-user-object)) et `sms` (métadonnées, **inclut l'OTP**) ([Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)) :

```json
{
  "user": {
    "id": "6481a5c1-3d37-4a56-9f6a-bee08c554965",
    "phone": "+1333363128",
    "phone_confirmed_at": "2024-05-13T11:52:48.157306Z",
    "app_metadata": { "provider": "phone", "providers": ["phone"] },
    "user_metadata": {}
  },
  "sms": { "otp": "561166" }
}
```

Le schéma JSON complet (documenté) inclut aussi `aud`, `role`, `email`, `confirmation_sent_at`, `confirmed_at`, `phone_change_sent_at`, `last_sign_in_at`, `identities[]`, `created_at`, `updated_at`, `is_anonymous`.

Le code source confirme et **enrichit** cette structure ([internal/hooks/v0hooks/v0hooks.go](https://github.com/supabase/auth/blob/master/internal/hooks/v0hooks/v0hooks.go)) :

```go
type Metadata struct {
	UUID      uuid.UUID `json:"uuid"`
	Time      time.Time `json:"time"`
	Name      Name      `json:"name,omitempty"`
	IPAddress string    `json:"ip_address,omitempty"`
}

type SMS struct {
	OTP     string `json:"otp,omitempty"`
	SMSType string `json:"sms_type,omitempty"`
	Phone   string `json:"phone,omitempty"`
}

type SendSMSInput struct {
	Metadata *Metadata    `json:"metadata"`
	User     *models.User `json:"user,omitempty"`
	SMS      SMS          `json:"sms,omitempty"`
}
```

**Deux champs non documentés mais présents dans le code** — à utiliser avec prudence car absent de la doc officielle :
- `metadata` : `uuid`, `time`, `name` (nom du hook), `ip_address`.
- `sms.phone` : le numéro destinataire, et `sms.sms_type` qui vaut `confirmation` ou `phone_change` (constantes `phoneConfirmationOtp = "confirmation"` / `phoneReauthenticationOtp = "reauthentication"` dans [phone.go](https://github.com/supabase/auth/blob/master/internal/api/phone.go)).

C'est important pour Kapso : **le numéro destinataire est disponible directement dans `sms.phone`**, sans avoir à le dériver de `user.phone`. La doc officielle ne mentionne que `user.phone`, donc le code source montre deux exemples d'Edge Function qui utilisent `user.phone` comme destinataire — plus fragile si le flux est un changement de numéro.

### Format de sortie et signature

- **Sortie** : « No outputs are required. An empty response with a status code of 200 is taken as a successful response. » ([Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)).
- **Signature** : les HTTP Hooks suivent la [Standard Webhooks Specification](https://www.standardwebhooks.com/), avec trois en-têtes : `webhook-id`, `webhook-timestamp`, `webhook-signature`. Le secret a le format `v1,whsec_<base64-secret>` — `v1` = version du hook, `whsec_` = secret symétrique, `<base64-secret>` = secret encodé Base64 standard. Il faut vérifier avec les [bibliothèques Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/tree/main/libraries). ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks))
- **Rotation de clé** : plusieurs secrets séparés par `|` (`v1,whsec_new|v1,whsec_old`), auth signe avec tous les secrets configurés. Format asymétrique `v1a,whpk_...:v1a,whsk_...` supporté par le validateur, les hooks Postgres n'ont pas besoin de secret. ([Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks), [configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go))
- **Limite de taille** : « there is a 20KB payload limit to guard against payload stuffing attacks ». Les payloads sont envoyés non compressés pour mesurer correctement le Content-Length. ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks))

### Deux types de hook

1. **Postgres Function** (`pg-functions://postgres/<schema>/<function>`) — s'exécute dans la base, pas de secret, pas de réseau. Format d'URI : `pg-functions://postgres/<schema>/<function_name>` (le segment host n'est pas validé). ([Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks))
2. **HTTP Endpoint** (`http(s)://`) — typiquement une [Supabase Edge Function](https://supabase.com/docs/guides/functions/quickstart). `http://` n'est autorisé que pour `localhost`, `127.0.0.1`, `::1`, `host.docker.internal` ; tout le reste doit être en `https://`. ([configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go), [Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks))

**Kapso implique donc le type HTTP** (un endpoint `https://` appelant l'API Kapso).

### Comment l'activer

- **Dashboard** : `Authentication > Hooks` → choisir le type (SQL ou HTTP) ([Authentication > Hooks](https://supabase.com/dashboard/project/_/auth/hooks), [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)).
- **CLI `config.toml`** :
  ```toml
  [auth.hook.send_sms]
  enabled = true
  uri = "http://host.docker.internal:54321/functions/v1/send_sms"
  secrets = "env(SEND_SMS_HOOK_SECRETS)"
  ```
- **Self-hosted (env)** : `GOTRUE_HOOK_SEND_SMS_ENABLED`, `GOTRUE_HOOK_SEND_SMS_URI`, `GOTRUE_HOOK_SEND_SMS_SECRETS`. ([Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks))

⚠️ **Le hook ne se déclenche que si la confirmation par téléphone est réellement requise** : « The Send SMS hook only fires when Auth sends an OTP. Make sure phone auth is enabled (`GOTRUE_EXTERNAL_PHONE_ENABLED=true`) and automatic phone confirmation is off (`GOTRUE_SMS_AUTOCONFIRM=false`). When `GOTRUE_SMS_AUTOCONFIRM` is on, signups are confirmed without an OTP, so the hook never runs. » ([Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks)). C'est un piège classique : hook activé mais jamais appelé.

### 🎯 POINT CRITIQUE : faut-il configurer un fournisseur SMS ?

**Réponse : NON. Le hook remplace totalement le fournisseur à l'exécution.**

**Preuve 1 — la documentation.** Le titre de la page est sans ambiguïté : « The Send SMS Hook **replaces** Supabase's built-in SMS sending. » La doc self-hosting décrit le hook comme « Replace built-in SMS sending with a custom provider » et indique explicitement, pour un fournisseur SMS régional : « If you want to use a regional SMS Provider, you can implement the Send SMS Hook. » ([Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [Configure Phone Sign-in & MFA](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa))

**Preuve 2 — le message du dashboard.** Un rapport de bug Supabase reproduit le bandeau de l'interface : *« SMS provider settings are disabled while the SMS hook is enabled. The SMS hook will be used in place of the SMS provider configured »* ([issue #45198](https://github.com/supabase/supabase/issues/45198)). Le champ fournisseur est **grisé** quand le hook est actif.

**Preuve 3 — le code source (la plus décisive).** Dans `sendPhoneConfirmation`, c'est un `if/else` exclusif — quand le hook est activé, le code du provider n'est **jamais atteint** ([internal/api/phone.go](https://github.com/supabase/auth/blob/master/internal/api/phone.go)) :

```go
if config.Hook.SendSMS.Enabled {
    input := v0hooks.NewSendSMSInput(r, user, v0hooks.SMS{OTP: otp, Phone: phone})
    output := v0hooks.SendSMSOutput{}
    err := a.hooksMgr.InvokeHook(tx, r, input, &output)
    if err != nil {
        return "", err
    }
} else {
    smsProvider, err := sms_provider.GetSmsProvider(*config)
    // ... messageID, err := smsProvider.SendMessage(phone, message, channel, otp)
}
```

`GetSmsProvider` n'est appelé que dans la branche `else`. Aucun identifiant Twilio/MessageBird/Vonage/Textlocal n'est lu lorsque le hook est actif.

**⚠️ Le seul frottement réel (bug dashboard, corrigé).** Le même issue [#45198](https://github.com/supabase/supabase/issues/45198) documente un bug **frontend uniquement** : le fait de basculer « Enable Phone provider » sur ON déclenchait des erreurs de validation sur les champs Twilio *pourtant désactivés* (`Twilio Account SID is required`, etc.), empêchant l'enregistrement. Contournement alors nécessaire : désactiver le hook, saisir des valeurs factices valides en format (`AC…`/`MG…`), activer le provider, puis réactiver le hook. **L'issue est fermée** (`"state": "closed"`, `state_reason: "completed"`, label `pr-opened`, fermée le 2026-04-24). À vérifier dans votre version du dashboard, mais le problème est résolu côté plateforme.

**Subtilité importante** : le *provider/feature flag* « Phone provider » doit tout de même être **activé** (le chemin de code doit être atteint), mais **les identifiants du fournisseur SMS ne sont pas nécessaires** — c'est la distinction entre « activer la fonctionnalité téléphone » et « configurer un fournisseur ». C'est la confusion qui a généré le bug.

---

## 3. Plans sur lesquels les Auth Hooks sont disponibles

Tableau officiel ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)) :

| Hook | Disponible sur |
|---|---|
| Before User Created | Free, Pro |
| Custom Access Token | Free, Pro |
| **Send SMS** | **Free, Pro** |
| Send Email | Free, Pro |
| MFA Verification Attempt | Teams and Enterprise |
| Password Verification Attempt | Teams and Enterprise |

**Le Send SMS Hook est donc disponible dès le plan Free**, contrairement aux hooks MFA/password qui exigent Teams ou Enterprise.

### Limitations

- **Pas de mention « beta »** sur le Send SMS Hook dans la doc actuelle. En revanche, **le Manual Linking est explicitement étiqueté beta** : « Manual linking (beta) » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)) — à ne pas confondre.
- **Pas de limite de débit propre aux hooks documentée.** Ce qui est documenté, ce sont les **timeouts et budgets** (§7) et la limite de payload de 20 Ko.
- **Le rate limit d'envoi SMS s'applique toujours** : le contrôle `a.limiterOpts.Phone.Allow()` intervient *avant* la bifurcation hook/provider dans le code ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)), et le tableau des rate limits liste « SMS messages sent by Supabase Auth » avec « Customizable: Yes » ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Le hook n'exempte donc pas du rate limit d'envoi SMS de Supabase, mais le coût SMS n'est plus porté par Supabase.
- **Note sur le nom de variable d'environnement** : `example.env` utilise `GOTRUE_HOOK_CUSTOM_SMS_PROVIDER_*` (ancien nom) alors que la doc self-hosting et la structure `HookConfiguration` utilisent `GOTRUE_HOOK_SEND_SMS_*` / `config.Hook.SendSMS`. **Se fier à `GOTRUE_HOOK_SEND_SMS_*`** ([Configure Auth Hooks](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-hooks), [configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)). `example.env` est en retard sur le renommage.

---

## 4. Créer une session Supabase après un OTP validé hors Supabase

C'est le point le plus contraint. **Il n'existe aucune API officielle pour échanger un OTP vérifié par vous contre une session Supabase.** Voici ce qui est réellement supporté.

### ✅ Supporté : Admin API `createUser` avec `phone` + `phone_confirm`

`AdminUserAttributes` contient bien `phone_confirm?: boolean` (« Confirms the user's phone number if set to true. Only a service role can modify. ») et l'exemple officiel est explicite ([createUser reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)) :

```js
const { data, error } = await supabase.auth.admin.createUser({
  phone: '1234567890',
  phone_confirm: true,
})
```

→ Vous pouvez **créer un utilisateur avec un téléphone déjà confirmé**, sans passer par l'OTP de Supabase. Mais cela **ne crée pas de session** : `createUser` retourne un user, pas d'`access_token`/`refresh_token`.

### ✅ Supporté : `signInWithPassword` avec téléphone + mot de passe

Contrairement à une idée répandue, le téléphone **n'est pas réservé à l'OTP**. La doc a une section entière « With phone » : « You can use a user's mobile phone number as an identifier, instead of an email address, when they sign up with a password. » ([Password-based Auth](https://supabase.com/docs/guides/auth/passwords)) :

```js
await supabase.auth.signInWithPassword({ phone: '+13334445555', password: 'some-password' })
```
HTTP : `POST /auth/v1/token?grant_type=password` avec `{"phone": "...", "password": "..."}`.

Le type `PasswordCredentialsBase` est un union `{ email, password } | { phone, password }` ([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)).

**⚠️ Mais attention** : `signUp({ phone, password })` nécessite un provider SMS si la confirmation téléphone est activée (« If you want users to confirm their phone number on signup, you need to set up an SMS provider. »). Avec un hook, c'est le hook qui enverrait le code — donc **vous ne pouvez pas créer le mot de passe côté client sans déclencher votre hook**.

**La voie cohérente** : créer l'utilisateur côté serveur avec `admin.createUser({ phone, password, phone_confirm: true })` (après avoir validé votre OTP vous-même), puis le client se connecte avec `signInWithPassword({ phone, password })` et obtient une **vraie session Supabase**. Ça fonctionne sans jamais envoyer d'OTP Supabase. Le mot de passe doit vous être connu ou généré — d'où une limite UX (l'utilisateur ne connaît pas ce mot de passe).

`AdminUserAttributes` permet aussi de poser `password` et `password_hash` (bcrypt, scrypt, argon2 — utile pour migrer des hashs existants) et même de fixer l'`id` ([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)).

### ❌ Non supporté : `generateLink` pour le téléphone

`generateLink` est **email uniquement**. La doc le décrit comme « Generates **email** links and OTPs to be sent via a custom email provider. » Les types sont stricts ([generateLink reference](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)) :

```ts
export type GenerateLinkType =
  | 'signup' | 'invite' | 'magiclink' | 'recovery'
  | 'email_change_current' | 'email_change_new'

export type GenerateSignupLinkParams = { type: 'signup'; email: string; password: string; ... }
```

Aucun type téléphone n'existe, et tous les params exigent `email: string`. L'endpoint serveur est `POST /admin/generate_link` avec `email` / `new_email` ([Auth Server Reference](https://supabase.com/docs/reference/self-hosting-auth/start)). **Confirmé : email uniquement.**

### ❌ Non supporté : `verifyOtp` avec un token généré par nous

Aucune documentation ne décrit cette possibilité, et l'implémentation l'exclut : l'OTP est généré par le serveur (`otp = crypto.GenerateOtp(config.Sms.OtpLength)`) puis **haché et stocké** côté Supabase (`*token = crypto.GenerateTokenHash(phone, otp)`, persisté dans `confirmation_token` / `phone_change_token`) ([internal/api/phone.go](https://github.com/supabase/auth/blob/master/internal/api/phone.go)). `verifyOtp` compare le token fourni au hash stocké. Un OTP que vous générez n'a pas de hash correspondant dans `auth.users`.

Un champ `token_hash` existe dans `VerifyTokenHashParams`, mais il est **contraint aux types email** :
```ts
export interface VerifyTokenHashParams {
  token_hash: string
  type: EmailOtpType   // pas MobileOtpType
}
```
([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)). Donc **`token_hash` ne s'applique pas au téléphone**. C'est une impossibilité structurelle, pas seulement une absence de documentation.

Seule échappatoire théorique : écrire directement dans les colonnes `*_token` de `auth.users` en base. **Ce n'est documenté nulle part, ce n'est pas une API supportée**, et c'est fragile (schéma interne, hachage non contractuel). À ne pas considérer comme une option.

### ⚠️ Supporté mais ce n'est pas une session Supabase : Third-party auth

Supabase supporte nativement Clerk, Firebase Auth, Auth0, AWS Cognito, WorkOS : « the API will trust JWTs issued by the provider similar to how it trusts JWTs issued by Supabase Auth » ([Third-party auth](https://supabase.com/docs/guides/auth/third-party/overview)). **Contraintes** : le provider doit signer **asymétriquement** (JWT symétrique « is not possible at this time »), doit exposer un OIDC Issuer Discovery URL, et les JWT doivent avoir un header `kid`. Il n'est **pas possible de désactiver Supabase Auth**. Tarif : `$0.00325` par Third-Party MAU.

**Ce n'est pas « Kapso »** : Kapso est un fournisseur de messages WhatsApp, pas un fournisseur d'identité OIDC. Cette voie supposerait de faire de Kapso un IdP asymétrique, ce qui n'est pas son rôle.

### ✅ Supporté (techniquement) : minter ses propres JWT

La doc [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) explique comment créer vos propres JWT :

> « If you wish to make your own JWTs [...] you can create a new JWT signing key by importing a private key or setting a shared secret yourself. »

```bash
supabase gen signing-key --algorithm ES256
supabase gen bearer-jwt --role authenticated --sub ef0493c9-3582-425f-a362-aef909588df7
```

Claims requis : `sub` (UUID d'un utilisateur existant dans `auth.users`, optionnel), `role` (rôle Postgres existant), `exp`. Header : `alg: ES256`, `kid`, `typ: JWT`. Ensuite `Authorization: Bearer <JWT>` (+ un header `apikey` séparé avec une clé publishable/secret).

⚠️ **Deux réserves majeures** :
1. Un tel JWT **usurpe un utilisateur existant** (`sub`) — il faut donc quand même que l'utilisateur existe dans `auth.users`. Ce n'est pas une création de compte.
2. C'est un **JWT, pas une session**. Il n'y a **pas** de `refresh_token`, donc pas de rafraîchissement automatique ni de `signOut` géré par Supabase. Il faut gérer soi-même l'émission et l'expiration. La doc ne présente ce mécanisme que comme un outil d'impersonation/migration, jamais comme un moyen d'ouvrir une session utilisateur après une authentification tierce.
3. La doc met fortement en garde contre le secret partagé (HS256) — « Not recommended for production applications ».

### Synthèse du §4

| Option | Crée une session ? | Supporté ? |
|---|---|---|
| `verifyOtp` avec notre propre token | — | ❌ **Non** (structurellement impossible, cf. hash serveur) |
| `admin.createUser({ phone, phone_confirm: true })` | ❌ non (pas de tokens) | ✅ **Oui** (documenté) |
| `admin.generateLink` (téléphone) | — | ❌ **Non** (email uniquement) |
| `signInWithPassword({ phone, password })` | ✅ **Oui** | ✅ **Oui** (documenté) |
| `admin.createUser({ phone, password, phone_confirm: true })` puis `signInWithPassword({ phone, password })` | ✅ **Oui** | ✅ **Oui** — **voie recommandée** |
| Third-party auth (OIDC asymétrique) | ✅ (JWT externe) | ✅ Oui, mais Kapso n'est pas un IdP |
| JWT minter soi-même | ⚠️ JWT sans refresh token | ✅ Techniquement, mais usage détourné |

**Conclusion** : la seule voie réellement propre pour « OTP géré entièrement par Kapso + session Supabase » est **`admin.createUser({ phone, password, phone_confirm: true })` côté serveur, puis `signInWithPassword({ phone, password })` côté client**. Alternativement, le Send SMS Hook (§2) évite ce bricolage : Supabase garde la génération et la vérification de l'OTP, et Kapso ne fait que la livraison.

---

## 5. Rattachement / liaison de comptes

### `updateUser({ phone })` puis vérification

L'utilisateur doit être **connecté**. `updateUser({ phone })` envoie un code au nouveau numéro, à vérifier avec `type: 'phone_change'` ([Phone sign-in](https://supabase.com/docs/guides/auth/phone-login)) :

```js
await supabase.auth.updateUser({ phone: '123456789' })
await supabase.auth.verifyOtp({ phone: '123456789', token: '123456', type: 'phone_change' })
```

Côté serveur, le code stocke le nouveau numéro dans `user.PhoneChange` et le token dans `PhoneChangeToken` sans écraser le numéro courant avant vérification ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)).

### `linkIdentity`

Deux stratégies documentées : **Automatic Linking** et **Manual Linking (beta)** ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).

```js
const { data, error } = await supabase.auth.linkIdentity({ provider: 'google' })
```

`unlinkIdentity` existe aussi : l'utilisateur doit être connecté et avoir **au moins 2 identités liées** ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).

### 🔍 Rapprochement automatique : par email, **pas** par téléphone

C'est le point le plus important du §5. La doc est sans ambiguïté :

> « Supabase Auth **automatically links identities with the same email address** to a single user. [...] When a new user signs in with OAuth, Supabase Auth will attempt to look for an existing user that uses the same email address. If a match is found, the new identity is linked to the user. » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking))

**Il n'y a aucune mention d'un rapprochement automatique par numéro de téléphone.** La clé de rapprochement automatique est l'**email**, et uniquement l'email.

Conséquences concrètes pour un utilisateur qui se connecte d'abord par téléphone puis par Google :

- Un compte créé via `signInWithOtp({ phone })` a `email: ""` et une identité `provider: "phone"`. Le payload du hook le confirme : `"email": ""`, `app_metadata.provider: "phone"`, `identities[0].provider: "phone"` ([Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)).
- Si cet utilisateur se connecte ensuite avec Google, **il n'y a pas d'email à faire correspondre** côté compte téléphone → **aucun rapprochement automatique**. Un **second compte distinct** est créé.
- Le rapprochement automatique ne fonctionnera que si l'utilisateur a un email renseigné **et vérifié** sur les deux comptes.

**Garde-fou de sécurité documenté** : « To prevent this from happening, when a new identity can be linked to an existing user, Supabase Auth will **remove any other unconfirmed identities** linked to an existing user. » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). Cela protège contre les attaques de pré-takeover de compte.

**Cas SSO exclu** : « Users that signed up with SAML SSO will not be considered as targets for identity linking (automatic or manual) for security reasons. » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking))

**Astuce documentée sur le cas email-après-OAuth** : si vous tentez de créer un compte email après un signup OAuth avec le même email, « you'll receive an obfuscated user response with no verification email sent. This prevents user enumeration attacks. » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking))

### ⚠️ Détail non documenté mais présent dans le code : domaines de liaison

Le code source introduit un paramètre expérimental **absent de la documentation publique** ([configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)) :

```go
// Env: GOTRUE_EXPERIMENTAL_PROVIDER_LINKING_DOMAINS="custom:github=social,custom:google=social"
type ProviderLinkingDomains map[string]string
```

Ce mécanisme permet d'isoler des providers dans des « domaines » de liaison séparés du pool email par défaut et du SSO, avec `GOTRUE_EXPERIMENTAL_PROVIDERS_WITH_OWN_LINKING_DOMAIN` (déprécié) en repli. **À traiter comme expérimental et non supporté** : le commentaire du code dit explicitement que ces fonctionnalités « may change or be removed in future releases without prior notice ».

### « Allow manual linking »

- **Dashboard** : `Authentication > Providers`, options de configuration ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).
- **Self-hosted** : `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED: true` ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).
- **CLI** : `auth.enable_manual_linking` (défaut `false`) — « Allow testing manual linking of accounts » ([Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config)).
- Défaut dans le code : `ManualLinkingEnabled bool ... default:"false"` ([configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)). **Désactivé par défaut.**

**Il n'existe pas de paramètre « automatic linking » à activer/désactiver** — l'Automatic Linking par email est un comportement par défaut non optionnel décrit dans la doc, pas un toggle. La seule bascule documentée est celle du manual linking.

**Recommandation pratique** : pour un produit qui combine téléphone et Google, prévoir un **flux de rattachement explicite applicatif** (l'utilisateur connecté lie son second facteur via `linkIdentity` ou `updateUser({ phone })`), et ne pas compter sur un rapprochement magique par téléphone — il n'existe pas.

---

## 6. Tarification Supabase (USD, chiffres actuels)

Source principale : [Supabase Pricing](https://supabase.com/pricing).

### Plans

| Plan | Prix | MAU inclus | Au-delà |
|---|---|---|---|
| **Free** | **$0** / mois | **50 000** MAU | — (pas d'overage) |
| **Pro** | **à partir de $25** / mois (1er projet inclus ; projets additionnels à partir de $10/mois) | **100 000** MAU | **$0.00325 par MAU** |
| **Team** | à partir de **$599** / mois | 100 000 MAU | $0.00325 par MAU |
| **Enterprise** | Sur devis | Custom | Custom |

Free : « Unlimited API requests », 500 MB de base, 5 GB egress, 1 GB file storage, support communautaire. Les projets Free sont **mis en pause après 1 semaine d'inactivité** et limités à **2 projets actifs**.

Pro inclut : 8 GB disk/projet (puis $0.125/GB), 250 GB egress (puis $0.09/GB), 100 GB file storage (puis $0.0213/GB), support email, backups quotidiens 7 jours, rétention de logs 7 jours, log drains (+$60/drain/projet). **Les plans payants incluent $10/mois de crédits compute**, de quoi couvrir une instance Micro ([Supabase Pricing](https://supabase.com/pricing)).

Team ajoute : SOC2 & ISO 27001, accès project-scoped et read-only, HIPAA en add-on payant, SSO dashboard, support prioritaire & SLAs, backups 14 jours, rétention logs 28 jours.

### Comptage des MAU

Définition officielle ([Manage Monthly Active Users usage](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)) :

> « You are charged for the number of distinct users who sign in or refresh their token during the billing cycle (including social login with e.g. Google, Facebook, GitHub). Each unique user is counted only once per billing cycle, regardless of how many times they authenticate. »

- **Le rafraîchissement de token compte comme activité.** Un utilisateur qui reste connecté et dont le refresh token est utilisé est compté MAU.
- **Un utilisateur = 1 MAU par cycle**, quel que soit le nombre de connexions.
- **Le compteur se remet à zéro au début de chaque cycle de facturation.**
- Les logins sociaux (Google, Facebook, GitHub) sont **explicitement** comptés.

**Utilisateurs téléphone** : la doc du comptage MAU ne liste pas les utilisateurs téléphone de façon exhaustive, mais la définition est générique (« distinct users who sign in or refresh their token ») et le tableau des plans ne prévoit aucune exception par méthode d'authentification. **Un utilisateur téléphone est donc compté comme MAU** — la doc ne dit nulle part le contraire. (Point volontairement signalé comme déduction par continuité, pas comme citation littérale.)

**Utilisateurs anonymes** : `is_anonymous` existe comme attribut utilisateur, et `signInAnonymously` a son propre rate limit, mais **la doc du comptage MAU ne traite pas explicitement le cas anonyme**. Je n'ai pas trouvé de page qui tranche. → **Non documenté, à vérifier auprès du support si votre produit utilise les anonymes à grande échelle.**

**SSO et third-party** : ils ont leurs **propres compteurs et tarifs séparés** : [Monthly Active Third-Party Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party) et [Monthly Active SSO Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-sso). Le third-party MAU est aussi à **$0.00325 par MAU** ([Third-party auth](https://supabase.com/docs/guides/auth/third-party/overview)).

Exemple de facturation officiel (Pro, dépassement) : 160 000 MAU → $195 de MAU, sous-total $235, moins $10 de crédits compute → **$225** ([Manage Monthly Active Users usage](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)).

### Le coût du SMS lui-même

**Avec un hook (Kapso) : Supabase ne facture rien pour les SMS.** Les SMS sont envoyés par votre infrastructure vers votre fournisseur ; Supabase ne fait qu'invoquer votre hook. Aucune ligne de facturation SMS n'apparaît dans les pages de tarification liées aux hooks. Le seul coût côté Supabase est le **MAU** et, indirectement, l'invocation de l'Edge Function ([Edge Function Invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)).

**Avertissement de coût officiel** (inclus dans les guides phone-login et passwords) :

> « To keep SMS sending costs under control, make sure you adjust your project's rate limits and configure CAPTCHA. See the Production Checklist to learn more. Some countries have special regulations for services that send SMS messages to users, (e.g India's TRAI DLT regulations). » ([cost_warning.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/_partials/cost_warning.mdx))

⚠️ **Nuance importante** : cet avertissement de coût concerne les **fournisseurs SMS intégrés**, où le coût passe par votre compte Twilio/etc. Je n'ai trouvé **aucune page de tarification Supabase facturant les SMS au message** — Supabase ne se présente pas comme un revendeur de SMS. Utiliser un hook rend d'ailleurs ce coût totalement hors Supabase.

### Les Auth Hooks sont-ils payants ?

Le tableau des plans indique seulement **Free, Pro** pour le Send SMS Hook — **aucun tarif additionnel n'est mentionné**. Les hooks ne sont pas une ligne de facturation. Coût réel : l'exécution de votre endpoint (Edge Function ou serveur), plus les invocations d'Edge Functions si vous hébergez le hook chez Supabase.

---

## 7. Limitation de débit (rate limits)

Source : [Rate limits](https://supabase.com/docs/guides/auth/rate-limits). Algorithme : **token bucket**, capacité maximale de 30 requêtes pour la plupart des buckets, `429 Too Many Requests` en cas de dépassement. Configurable via `Authentication > Rate Limits` du dashboard ou la Management API.

### Rate limits applicables à l'OTP téléphone

| Opération | Chemin | Limité par | Personnalisable | Limite |
|---|---|---|---|---|
| **SMS envoyés par Supabase Auth** | Tous les endpoints d'envoi SMS | **Projet** | **Oui** | **30 SMS / heure** (défaut) |
| Sign-ups et sign-ins | `/auth/v1/signup`, `/recover`, `/resend`, `/magiclink`, `/otp`, `/user` | Adresse IP | Oui | 30 requêtes / 5 min, bursts jusqu'à 30 |
| **Envoi d'OTP ou magic links** | `/auth/v1/otp` | **Utilisateur** | Oui | fenêtre de **60 secondes** avant une nouvelle demande pour le même utilisateur |
| **Vérifications** | `/auth/v1/verify` | Adresse IP | Oui | 30 requêtes / 5 min, bursts jusqu'à 30 |
| Requêtes au token endpoint | `/auth/v1/token` | Adresse IP | Oui | 150 requêtes / 5 min, bursts jusqu'à 30 |
| Sign-ins anonymes | `/auth/v1/signup` | Adresse IP | Oui | 30 / heure, burst = limite configurée |

Variables : `rate_limit_sms_sent`, `rate_limit_otp`, `rate_limit_verify`, `rate_limit_sign_in_sign_ups`, `rate_limit_token_refresh`, `rate_limit_anonymous_users`, `rate_limit_email_sent`, `rate_limit_web3`. Côté CLI : `auth.rate_limit.sms_sent` (défaut 30, « Requires auth.sms to be enabled »), `auth.rate_limit.token_verifications` (30), `auth.rate_limit.sign_in_sign_ups` (30) ([Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config)).

**Point clé pour Kapso** : le rate limit **« SMS messages sent by Supabase Auth » (30/heure par projet par défaut) s'applique AVANT la bifurcation hook/provider**. Dans le code, `a.limiterOpts.Phone.Allow()` est vérifié avant le `if config.Hook.SendSMS.Enabled` ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)) — donc **activer le hook ne supprime pas cette limite de 30 SMS/heure**. Avec un hook, cette limite est purement artificielle (elle ne protège plus le coût Supabase) : **il faut la relever** dans `Authentication > Rate Limits`, sinon Kapso sera plafonné à 30 messages/heure par projet.

**Rate limiting par numéro** : la protection « par utilisateur » est la fenêtre de 60 s sur `/auth/v1/otp` + `GOTRUE_SMS_MAX_FREQUENCY` (défaut 1 min), vérifiée sur `sentAt` avant tout envoi ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)). **Il n'y a pas de rate limit documenté « par numéro de téléphone » distinct du rate limit « par utilisateur ».**

### Rate limits et comportement des hooks

La page [Rate limits](https://supabase.com/docs/guides/auth/rate-limits) ne liste **aucun rate limit propre aux hooks**. Ce qui est documenté sur les hooks relève du **timeout et du budget de retry** ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)) :

- **Timeout Postgres Hook** : `auth.hook_timeouts.postgres_hooks` secondes.
- **Timeout HTTP Hook** : `auth.hook_timeouts.http_hooks` secondes.
- **Budget global HTTP** : « We have a time budget of **5s** for the entire webhook invocation, including retry requests. »
- **Retries** : sur `429` ou `503` **avec un header `retry-after` non vide**, jusqu'à **3 tentatives** avec un back-off de **2 secondes**. Exemple officiel : tentative initiale à 00:00:00, échec à 00:00:02, retry #1 à 00:00:04, timeout à 00:00:05 (budget 5 s épuisé).
- Les erreurs `403` et `400` sont traitées comme des erreurs internes et renvoient un **500**.
- Les réponses, **y compris d'erreur, doivent avoir `Content-Type: application/json`** — sinon Supabase Auth renvoie une Internal Server Error.
- Les deux types de hooks tournent **dans une transaction**, pour limiter la durée d'exécution.
- Les erreurs d'un Postgres Hook ne sont **pas retry-ables**.

⚠️ **Le budget de 5 s inclut les retries** — c'est très serré pour un appel API WhatsApp externe (Kapso) avec latence réseau. Concevoir le hook pour répondre vite, idéalement en mettant l'envoi en file d'attente (la doc fournit justement un exemple « Queue SMS Messages » via `pg_cron`).

### IP address forwarding

Pour éviter d'être rate-limité sur l'IP du serveur plutôt que celle de l'utilisateur, Supabase permet d'envoyer l'IP de l'utilisateur via le header `Sb-Forwarded-For`, **avec une clé API secrète** (les clés publishable et `anon`/`service_role` legacy ne sont pas supportées). À activer explicitement : `security_sb_forwarded_for_enabled: true`. ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits))

---

## 8. Sécurité — bonnes pratiques OTP par téléphone

### Enumeration d'utilisateurs et `shouldCreateUser`

`shouldCreateUser` est documenté dans les types du SDK ([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)) :

```ts
options?: {
  /** If set to false, this method will not create a new user. Defaults to true. */
  shouldCreateUser?: boolean
  captchaToken?: string
}
```

**⚠️ Le défaut est `true`** : « Supabase `signInWithOtp` creates new users by default, even on the login page ». C'est un piège documenté par la communauté et cohérent avec les types du SDK. Sur une page de **connexion**, un appel `signInWithOtp` sans `shouldCreateUser: false` **crée silencieusement un compte** pour tout numéro inconnu. À toujours passer explicitement en fonction de l'intention (inscription vs connexion).

**Enumeration** : Supabase applique des protections documentées sur le flux email. Pour `resetPasswordForEmail` : « To prevent user enumeration, `resetPasswordForEmail()` doesn't reveal whether an account exists for the given email address. When no user is associated with the address, Supabase Auth won't send an email, though the method still returns without an error. » ([Password-based Auth](https://supabase.com/docs/guides/auth/passwords)). Idem pour le cas email-après-OAuth : « you'll receive an obfuscated user response with no verification email sent. This prevents user enumeration attacks. » ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking))

⚠️ **Sur le flux téléphone, je n'ai pas trouvé de déclaration équivalente dans la doc.** Le comportement de `signInWithOtp({ phone })` face à un numéro inexistant dépend de `shouldCreateUser` (création) et, si `false`, de la réponse d'erreur — qui peut révéler l'existence du compte. **Point non documenté explicitement.** Un issue ouvert du dépôt auth ([#1955 — signInWithOtp has a user enumeration vulnerability](https://github.com/supabase/auth/issues/1955)) traite précisément de ce sujet ; il n'est pas dans la doc officielle et je ne peux donc pas en tirer une garantie de comportement. **À traiter comme un risque à valider empiriquement**, avec un message d'erreur uniforme côté UI.

### CAPTCHA / Turnstile

Supporté : **hCaptcha** et **Cloudflare Turnstile** ([Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha)).

Activation : Dashboard → **Auth** → `Settings > Authentication > Bot and Abuse Protection > Enable CAPTCHA protection`, choisir le provider, saisir la **Secret key**, Save.

Côté client, passer le token dans les options :
```js
await supabase.auth.signUp({ email, password, options: { captchaToken } })
```
Composants : `@hcaptcha/react-hcaptcha` ou `@marsidev/react-turnstile`. Penser à `captcha.resetCaptcha()` après chaque appel. Pour tester en local, ajouter `localhost` à la domain allowlist (Turnstile) ou utiliser ngrok / une entrée hosts (hCaptcha). ([Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha))

Côté serveur : `GOTRUE_SECURITY_CAPTCHA_ENABLED`, `GOTRUE_SECURITY_CAPTCHA_PROVIDER` (`hcaptcha` ou `turnstile`), `GOTRUE_SECURITY_CAPTCHA_SECRET`, `GOTRUE_SECURITY_CAPTCHA_TIMEOUT` (défaut `10s`). Le provider est validé : `if c.Provider != "hcaptcha" && c.Provider != "turnstile"` → erreur, et un secret vide est refusé ([configuration.go](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go)).

⚠️ Sur `verifyOtp`, `options.captchaToken` est marqué **`@deprecated`** dans les types ([types.ts](https://github.com/supabase/auth-js/blob/master/src/lib/types.ts)) — le CAPTCHA se place donc sur la **demande** d'OTP, pas sur la vérification.

### Limitation de débit par numéro — recommandation officielle

Le `cost_warning` officiel, inséré dans les guides phone-login **et** passwords, est la recommandation de sécurité/coût de référence ([cost_warning.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/_partials/cost_warning.mdx)) :

> « To keep SMS sending costs under control, make sure you adjust your project's **rate limits** and **configure CAPTCHA**. See the Production Checklist to learn more. Some countries have special regulations for services that send SMS messages to users, (e.g India's TRAI DLT regulations). Remember to look up and follow the regulations of countries where you operate. »

Points réglementaires à ne pas négliger : **TRAI DLT en Inde**, et plus largement les règles locales sur l'envoi de SMS/WhatsApp transactionnels.

### Autres bonnes pratiques documentées

**Numéros recyclés — risque majeur.** La doc est explicite ([Password-based Auth](https://supabase.com/docs/guides/auth/passwords)) :

> « This practice is usually discouraged because **phone networks recycle mobile phone numbers**. Anyone receiving a recycled phone number gets access to the original user's account. To mitigate this risk, [implement MFA]. »

En encadré `danger` : « Protect users who use a phone number as a password-based auth identifier by enabling MFA. » **C'est l'avertissement le plus fort de la doc sur l'auth par téléphone.** Un numéro recyclé = prise de contrôle de compte. Pour un produit d'e-learning, prévoir un mécanisme de reprise (email de secours, MFA, reverification périodique).

**E.164 obligatoire.** Le serveur valide le format : `Invalid phone number format (E.164 required)`, avec le regex `^[1-9][0-9]{1,14}$` ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)). Toujours envoyer le numéro avec l'indicatif pays (`+33...`).

**Secrets et vérification de signature.** Toujours vérifier `wh.verify(payload, headers)` avant de traiter un payload de hook ; ne jamais désactiver la vérification. En self-hosted, lancer l'Edge Function avec `--no-verify-jwt` est **attendu** (le hook s'exécute avant l'émission du JWT), « Payload authenticity is instead protected via the appended security headers associated with the Standard Webhooks Standard » ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)).

**Gestion des erreurs du hook.** Retourner `429` ou `503` avec un header `retry-after` non vide pour un échec transitoire (permet le retry) ; `400`/`403` sont convertis en 500. Toujours renvoyer `Content-Type: application/json`.

**OTP : 6 chiffres, 60 s.** Un OTP à 6 chiffres avec 60 s de validité est la configuration par défaut. La doc self-hosting recommande d'**augmenter** la durée pour la production (« often too short »), ce qui est un compromis sécurité/UX à assumer explicitement.

**Test OTP.** `auth.sms.test_otp` / `GOTRUE_SMS_TEST_OTP` permet de mapper un numéro à un OTP fixe pour les tests, avec `test_otp_valid_until` ([Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config), [example.env](https://github.com/supabase/auth/blob/master/example.env)). ⚠️ À ne jamais laisser actif en production.

**Test OTP et rate limiting** : le code vérifie la fréquence (`sentAt + MaxFrequency`) **avant** les test OTP, « intentionally [...] so that the behavior of regular and test OTPs is similar » ([phone.go](https://github.com/supabase/auth/master/internal/api/phone.go)).

---

# Points de vigilance / ce qui pourrait bloquer

## 🔴 Bloquants ou à fort impact

1. **Aucune API pour échanger un OTP Kapso contre une session Supabase.** `verifyOtp` exige un OTP dont le hash est stocké côté Supabase (`crypto.GenerateTokenHash`). Un token généré par Kapso/vous n'a pas de hash correspondant. `generateLink` est email-only (types stricts). **Contournement** : `admin.createUser({ phone, password, phone_confirm: true })` puis `signInWithPassword({ phone, password })` — mais cela impose de gérer un mot de passe. **➜ La conception à privilégier est le Send SMS Hook, pas la vérification externe.**

2. **Pas de rapprochement automatique par téléphone.** L'automatic linking est **par email uniquement**. Un utilisateur téléphone (email vide) qui se connecte ensuite avec Google crée un **second compte distinct**. Il n'existe aucun toggle « automatic linking » pour changer cela. **➜ Prévoir un flux de liaison explicite (`linkIdentity` / `updateUser({ phone })`), ou exiger un email dès le départ.**

3. **Le rate limit SMS de 30/heure par projet s'applique même avec le hook.** Vérifié avant la bifurcation dans le code. Avec Kapso, cette limite ne protège plus de rien et **plafonnera votre production à 30 messages/heure**. **➜ À relever impérativement dans `Authentication > Rate Limits`.**

4. **Budget de 5 secondes pour l'invocation HTTP du hook, retries inclus.** Très serré pour un appel API externe (Kapso) avec latence réseau et éventuel cold start d'Edge Function. En cas de dépassement → échec d'authentification, l'utilisateur ne reçoit jamais son code. **➜ Design asynchrone (file d'attente, cf. l'exemple pg_cron de la doc) ou timeout court côté Kapso.**

5. **Le dashboard a eu un bug bloquant sur l'activation du Phone provider avec le hook** (issue [#45198](https://github.com/supabase/supabase/issues/45198)). Fermé/corrigé, mais **vérifiez votre version du dashboard**. Si vous rencontrez des erreurs `Twilio Account SID is required` sur des champs grisés : désactiver le hook → valeurs factices valides → activer le provider → réactiver le hook.

6. **Le hook ne se déclenche pas si l'autoconfirmation du téléphone est activée.** `GOTRUE_SMS_AUTOCONFIRM` doit être à `false` (« Enable phone confirmations »). Sinon les signups sont confirmés sans OTP et **le hook ne tourne jamais** — panne silencieuse difficile à diagnostiquer.

## 🟠 Pièges de configuration

7. **`example.env` du dépôt auth est trompeur** : `GOTRUE_SMS_OTP_EXP="6000"` (la vraie défaut est 60), et `GOTRUE_HOOK_CUSTOM_SMS_PROVIDER_*` au lieu de `GOTRUE_HOOK_SEND_SMS_*`. **➜ Se fier à la doc self-hosting et à `configuration.go`, pas à `example.env`.**

8. **Le template SMS Supabase est ignoré quand le hook est actif.** Le contenu du message est composé par votre Edge Function. Ne pas chercher à configurer le template côté dashboard pour changer le texte.

9. **`channel: 'whatsapp'` du SDK est inopérant avec le hook.** Ce paramètre est consommé par le provider Twilio intégré, qui n'est pas appelé. Sans impact fonctionnel avec Kapso (qui fait du WhatsApp), mais source de confusion au debug.

10. **Le numéro destinataire : `sms.phone` (code) vs `user.phone` (doc).** La doc ne documente que `user.phone`, et ses exemples l'utilisent. Le code expose `sms.phone`, plus fiable notamment en flux `phone_change`. **➜ Utiliser `sms.phone` avec un repli sur `user.phone`**, et surveiller une éventuelle évolution puisque `sms.phone` n'est pas contractuel.

11. **`shouldCreateUser` vaut `true` par défaut.** Sur une page de connexion, un numéro inconnu **crée un compte**. À passer explicitement à `false` en mode connexion.

12. **`sms.sms_type`** indique `confirmation` ou `phone_change` — utile pour router des messages différents (bienvenue vs changement de numéro), mais **non documenté**.

## 🟡 Incertitudes assumées (non documentées)

13. **Enumeration d'utilisateurs sur le flux téléphone : non documenté.** Supabase documente la protection anti-enumeration pour l'email (`resetPasswordForEmail`, email-après-OAuth) mais **pas pour `signInWithOtp({ phone })`**. Un issue communautaire ([#1955](https://github.com/supabase/auth/issues/1955)) allègue une vulnérabilité. **➜ À valider empiriquement et à Mitiger par un message d'erreur uniforme côté UI.**

14. **Comptage MAU des utilisateurs anonymes : non documenté.** La page MAU ne traite pas ce cas. Non pertinent si vous n'utilisez pas `signInAnonymously`.

15. **Comptage MAU des utilisateurs téléphone : déduit par continuité**, pas cité littéralement (la définition MAU est générique et aucune exception par méthode d'auth n'est listée). Risque de facturation faible mais réel à volume.

16. **`GOTRUE_EXPERIMENTAL_PROVIDER_LINKING_DOMAINS`** : mécanisme réel dans le code, **absent de la doc publique**, et explicitement susceptible d'être modifié ou supprimé sans préavis. **➜ Ne pas bâtir d'architecture dessus.**

17. **Statut « beta » du Send SMS Hook : non mentionné** dans la doc actuelle (contrairement au Manual Linking, explicitement beta). Le hook est listé simplement sur Free/Pro. Absence de mention ≠ garantie de stabilité de l'API du payload.

## 🟢 Recommandation d'architecture

**Utiliser le Send SMS Hook avec une Edge Function `https://` qui appelle l'API Kapso**, plutôt que de sortir la vérification d'OTP de Supabase :

- Supabase reste responsable de la génération, du hachage, du stockage et de la vérification de l'OTP → `verifyOtp({ type: 'sms' })` délivre une **vraie session** avec refresh token, sans bricolage.
- Le fournisseur SMS intégré est **totalement remplacé** (prouvé par le code : `if/else` exclusif, `GetSmsProvider` uniquement dans le `else`).
- Disponible **dès le plan Free**.
- Coût SMS entièrement chez Kapso ; Supabase ne facture que le MAU.

**À implémenter obligatoirement dans le hook** : vérification de signature Standard Webhooks, `sms.phone` comme destinataire, réponse `200` vide en succès, `Content-Type: application/json` sur toutes les réponses, gestion `429`/`503` + `retry-after` pour les erreurs Kapso transitoires, et réponse **sous 5 secondes** (idéalement par mise en file d'attente).

**À régler côté dashboard** : relever `rate_limit_sms_sent` (30/h est trop bas), activer le CAPTCHA (Turnstile conseillé), vérifier que « Enable phone confirmations » est bien actif, mettre `shouldCreateUser: false` sur l'écran de connexion, et prévoir un flux de liaison de compte explicite pour le cas téléphone ↔ Google.
