# Reprise : aide par photo, 2 octobre 2026 (07 h 50)

Écart entre l'état où l'agent de développement s'était arrêté (`c2eba02`) et le code actuel. Changements demandés par Benny après un essai sur son téléphone. Aucun autre fichier n'a été touché.

## Ce qui a changé et pourquoi

### 1. Formules LaTeX dans le titre d'une étape (écran Correction)
- **Constat :** « Équation 1 : $x^2 - 5x + 6 = 0$ » s'affichait tel quel. Le détail des étapes passait par `Blocs` (qui convertit le LaTeX), pas le titre, rendu dans un `Text` brut.
- **Changement :** `Photo.tsx`, le titre passe par `texteAvecFormules` (`services/blocs.ts`), la fonction déjà utilisée pour les énoncés de quiz. Résultat : « Équation 1 : x² - 5x + 6 = 0 ».
- **Choix :** conversion en texte Unicode, dans le même `Text` gras. Les formules du titre ne sont donc pas colorées en vert comme celles du détail. Pour les colorer, il faudrait rendre le titre avec `Blocs`.
- **Reste :** les autres champs affichés (énoncé, méthode, résultat, à retenir) passaient déjà par `blocsDepuisTexte`. `notion` n'est pas affiché.

### 2. Boutons « Pas compris » / « C'est clair » trop hauts
- **Constat :** le pied flottait loin du bas de l'écran.
- **Cause :** `Ecran` ajoute `insets.bottom` au pied par défaut (`insetBas = true`). L'écran Photo est dans les onglets, dont la barre ajoute déjà cet inset : il était compté deux fois.
- **Changement :** `insetBas={false}` sur tous les `<Ecran>` de `Photo.tsx`, comme `Reviser`, `Accueil`, `EcranMoi` et `LecteurPdf`.
- **À savoir :** tout nouvel écran de l'onglet Photo doit faire de même.

### 3. Écran d'attente : spinner, coche verte, 4e étape
- **Avant :** une étape devenait « cochée » dès que le serveur la signalait, c'est-à-dire quand l'IA commençait à l'écrire. Les trois étaient donc cochées pendant les ~5 s d'écriture des étapes, puis rien ne bougeait.
- **Maintenant :** une étape tourne (spinner) quand elle est en cours et devient verte quand la suivante démarre. La première tourne dès l'envoi. Une 4e étape, « Mise en forme du résultat », tourne jusqu'à l'arrivée de la correction.
- **Code :**
  - `services/photo.ts` : `Progression` gagne `'resultat'` ; nouvelle fonction pure `etatsEtapes(recues)` qui renvoie `attente | en_cours | fait` pour chaque étape.
  - `Photo.tsx` : `ActivityIndicator` dans le rond de la coche, étapes en attente à 55 % d'opacité, libellé d'accessibilité « terminé » ou « en cours ».
  - `i18n` (fr et en) : libellés passés à la forme « Lecture de l'énoncé », « Choix de la méthode », « Rédaction des étapes », « Mise en forme du résultat », plus `etapeFaite` et `etapeEnCours`.
- **Serveur (dépôt `elearn-supabase`) :** la fonction Edge `photo-correction` signale maintenant `resultat`, quand les étapes sont écrites et que l'IA passe au résultat (`progression()` dans `logique.ts`, test ajouté). **Avec l'ancienne version de la fonction, la 4e étape reste simplement « en attente » : rien ne casse.**

## Vérifications
- `tsc`, `expo lint` et toute la suite Jest passent (70 suites, 737 tests). Tests ajoutés dans `services/__tests__/photo.test.ts`.
- Tests Deno de `logique_test.ts` : 9 passent.
- **Non testé sur téléphone :** le rendu du spinner dans le rond et l'espacement du pied sont à vérifier sur Android.

## Autres points constatés (non traités)
- Connexion Google : pour un ancien compte, l'app tente d'abord de lier Google à l'invité (refusé par Supabase), puis relance une 2e connexion. Voir `connecterOAuth` dans `services/compte.ts`. Correctif possible : connexion directe depuis l'écran « Se connecter ».
- `(onglets)/_layout.tsx` lit le profil local une seule fois : après une reconnexion, il peut renvoyer vers « Bienvenue » avant que les réglages du compte soient restaurés.

---

# Suite, 2 octobre 2026 (08 h 40) : bouton caméra, historique, rappel de fin

Demandé par Benny après un essai sur téléphone. Nouveaux fichiers : `services/obturateur.ts`, `services/photoHistorique.ts`, `services/photoNotification.ts`, `components/photo/HistoriquePhoto.tsx` (+ 3 fichiers de tests).

## 1. Un seul bouton caméra
- **Constat :** l'écran caméra affichait son déclencheur au-dessus du bouton Photo central de la barre d'onglets : deux boutons caméra.
- **Choix :** le bouton de la barre devient le déclencheur. `services/obturateur.ts` est un petit store (même principe que `useSyncExternalStore` ailleurs) : `Camera.tsx` y enregistre sa prise de vue quand l'appareil est prêt et la retire en quittant l'écran (`useFocusEffect`). `Onglet.tsx` : tant que le déclencheur est actif, le rond central est masqué (`opacity: 0`, la place et le libellé « Photo » restent) et toucher le bouton prend la photo.
- **Le déclencheur de l'écran reste** dans la rangée galerie / retournement : c'est lui que l'élève voit « monter » à la place du rond de la barre. Il n'a pas été déplacé dans la barre, parce qu'Android ne délivre pas les touches aux enfants d'un `Pressable` qui dépassent de son parent : un rond remonté de ~100 px au-dessus de la barre ne serait pas cliquable. Si on veut le vrai rond animé qui monte, il faudra un calque plein écran au niveau du layout des onglets.
- **À vérifier sur téléphone :** alignement visuel, et que toucher « Photo » dans la barre prend bien la photo.

## 2. Historique des corrections
- **Données :** rien de neuf côté serveur. `photo_corrections` garde déjà chaque correction réussie (résultat, avis, chemin de la photo) et sa RLS limite aux lignes de l'élève. `lireHistorique` lit les corrections `status = 'done'`, 20 par page, la plus récente d'abord, et signe les photos (`createSignedUrls`, 1 h) avec la politique de lecture existante du bucket privé.
- **Écran :** `HistoriquePhoto.tsx`, état `historique` de `Photo.tsx`. Accès par le bouton horloge de l'en-tête de la caméra. Toucher une ligne rouvre l'écran Correction (état `depuis: 'historique'`, retour vers la liste) avec la photo envoyée en tête (`urlPhoto`).
- **Limites :** l'historique demande le réseau (pas de copie locale). Les photos sont **effacées après 30 jours** par la fonction Edge (`photo_images_to_purge`) : la correction reste, la photo non. Le texte de la liste le dit.

## 3. Notification de fin de correction
- **Constat :** la phrase « on te prévient » de l'écran d'attente n'était pas tenue. Côté serveur, tout est prêt pour un push (`notify_student`, `register_push_token`, chaîne `feed-notification-push`), mais **l'app n'enregistre jamais de jeton push** et **le projet n'a pas de `google-services.json`** : sans Firebase, Android ne reçoit aucune notification envoyée par le serveur.
- **Ce qui est fait maintenant (sans Firebase) :** `photoNotification.ts` programme une **notification locale** à l'envoi (+ 35 s, « Ta correction devrait être prête »), annulée dès que la correction arrive devant l'élève (application active). Si la correction arrive pendant que l'application est en arrière-plan, une notification immédiate (« Ta correction est prête ») la remplace. La permission est demandée au premier envoi seulement ; un refus est retenu. Toucher la notification ouvre l'historique (`/photo?historique=1`, géré dans `suivreOuvertures` de `rappels.ts` et dans `Photo.tsx`).
- **Limites connues :** le rappel programmé part même si la correction a échoué (les crédits sont rendus) ; pas de reprise au démarrage à froid depuis la notification ; si l'élève est dans l'application sur un autre onglet, rien ne s'affiche (la notification est annulée, la correction est dans l'historique).
- **Pour un vrai push (reste à faire) :** configurer Firebase (clé FCM v1 dans EAS, `google-services.json`, `android.googleServicesFile`), faire un build natif, appeler `register_push_token` après permission, ajouter le type `photo_ready` à `notifications_type_check` et à `notification_category`, et appeler `notify_student` depuis `photo-correction` quand le flux est fermé. Le rappel local pourra alors être retiré.

## 4. Photos : où elles sont stockées
Dans **Supabase Storage** (bucket privé `photo-corrections`, JPEG, 2 Mo max, dossier par élève, lecture limitée à son propriétaire), **pas dans R2**. La fonction Edge `photo-correction` les y envoie. Aucun changement fait : le choix est à confirmer par Benny.

## Vérifications
`tsc`, `expo lint` et toute la suite Jest passent (73 suites, 751 tests). Rien n'a été testé sur téléphone.

---

# Suite, 2 octobre 2026 (09 h 30) : espace de la caméra, push, R2

## Caméra : le déclencheur collé à la barre
Retour de Benny sur photo : trop d'espace noir sous le déclencheur. Même cause que l'écran Correction : `Camera.tsx` ajoutait l'inset du bas du téléphone alors que la barre d'onglets le porte déjà. Il est retiré (`paddingBottom: espace[3]`) : le déclencheur est tout en bas, juste au-dessus du libellé « Photo », à la place visuelle du rond de la barre (masqué tant que la caméra est prête).

## Push Android (préparé, pas actif)
- `app.config.ts` : `android.googleServicesFile` est lu dans la variable EAS **de type fichier** `GOOGLE_SERVICES_JSON` (jamais committé : ce dépôt est public). Absente, rien n'est ajouté. C'est une config **native** : elle ne prend effet qu'avec un **nouveau build**, jamais par OTA.
- `services/push.ts` : après permission, `getExpoPushTokenAsync` puis `register_push_token`. Appelé au démarrage de session (`SessionProvider`) et au premier envoi d'une photo. Tant que le build n'a pas Firebase, l'appel échoue sans bruit et les rappels locaux de `photoNotification.ts` restent la seule voie. Un jeton enregistré (flag `push.jetonEnregistre`) désactive le rappel local programmé.
- Côté serveur (dépôt `elearn-supabase`) : migration `20261002020000_photo_notification` (type `photo_ready`) et appel de `notify_student` par `photo-correction` quand l'élève a quitté le flux.
- **Reste à faire :** la variable EAS `GOOGLE_SERVICES_JSON` (fichier du projet Firebase `elearn5`, package `com.ezadrive.elearn`), la clé FCM v1 dans les identifiants EAS, puis un build (`[build]` dans le message du commit).
- **Sécurité :** le dépôt `elearn_mobile` contient `fcm.json` et `gs.json` (clés privées de comptes de service Firebase `elearn5`) et `elear-445209-*.json` : à révoquer et à ne jamais réutiliser.

## Photos dans R2 (code prêt, pas actif)
- `elearn-supabase`, `photo-correction/r2.ts` : bucket R2 **privé** par l'API S3 (`aws4fetch`), clés `photos/{élève}/{id}.jpg`, secrets `R2_ENDPOINT`, `R2_PHOTOS_BUCKET`, `R2_PHOTOS_ACCESS_KEY_ID`, `R2_PHOTOS_SECRET_ACCESS_KEY` (noms propres aux photos : le bucket du back-office est public). **Sans ces secrets, la fonction continue d'écrire dans Supabase Storage.** Un préfixe `photos/` distingue R2 de l'ancien stockage.
- La fonction répond aussi à `POST {action:'urls', ids}` (adresses signées de lecture, R2 ou ancien stockage) ; la purge de 30 jours efface dans les deux.
- **Changement d'app volontairement à part** (branche `ccr-c5a410c9-uqry2j`) : `photoHistorique.ts` demande les adresses signées à cette fonction au lieu du stockage Supabase. À fusionner **après** le redéploiement de la fonction, sinon l'historique perd ses miniatures.

---

# Suite, 2 octobre 2026 (fin de matinée) : mise en production

- **Base de production :** migration `20261002020000_photo_notification` appliquée (type `photo_ready` accepté), historique de migrations aligné.
- **Fonction `photo-correction` v3 déployée** (`verify_jwt` désactivé, authentification interne) : stockage R2 si les secrets existent, action `urls`, notification `photo_ready` quand l'élève a quitté l'écran.
- **App :** la branche d'historique via la fonction est fusionnée (`photoHistorique.ts` demande les adresses signées à `photo-correction`).
- **Pas encore actif :** R2 (bucket privé, jeton limité au bucket et 4 secrets Supabase `R2_*` à créer : tant qu'ils manquent, les photos restent dans Supabase Storage) ; push Android (variable EAS `GOOGLE_SERVICES_JSON`, clé FCM v1, nouveau build).

---

# Suite, 2 octobre 2026 (matin, 09 h 30 et après) : crédits selon le guide de design (§20, §23)

- **Moi (H1/H1b/H1c) :** fusion de la branche `claude/project-thread-qfj767` (profil selon le guide v27, Aide et contact, Ma progression). Elle est déjà dans cette branche.
- **Pastille de crédits (K1/K1c) :** `CompteurCredits` à côté de la série sur l'accueil. Jaune (texte noir), corail à 5 crédits ou moins, verte « ∞ » avec un pass, « 5 · Invité » pour un invité, squelette pendant le chargement. Un appui ouvre le détail **dans une feuille du bas** (`FeuilleDetailCredits`, K1b), comme la carte « Mes crédits » de Moi. La page `/credits` reste pour les liens existants.
- **Explications de quiz (K2b) :** pendant le quiz (`MiniTest`) et dans « Revoir » (`RevoirCorrection`), les questions du serveur n'embarquent plus l'explication : le bouton « Voir l'explication » avec la puce du coût (`BoutonCredits`) la remplace. Le texte ouvert est gardé pour l'écran de correction. Hors ligne : « Aucun crédit n'a été retiré ».
- **Invité sans crédits (K3b) :** `FeuilleEpuise` devient « Tes crédits d'essai sont épuisés » pour un invité : carte « Crée ton compte : +40 crédits tout de suite », « Créer mon compte », pass semaine, « Plus tard ». Le 40 vient de `credit_settings` (lu par `lireReglages`), pas du code.
- **Bonus de bienvenue (K3c) :** `BienvenueCredits`, à la racine : écran « Tu as gagné N crédits » une seule fois (clé `credits.bienvenueVue.<id>`), si le registre serveur contient un bonus de moins de 24 h. Couvre la création d'un compte et la liaison d'un ancien compte.
- **Serveur :** migration `20261002030000_credits_bienvenue_notification` (trigger sur `credit_ledger` qui appelle `notify_student` au bonus de bienvenue). **Pas encore appliquée en production** : sans elle, l'écran K3c marche mais aucune notification n'est envoyée.
- **Pas fait :** K3d (bonus déjà pris sur ce téléphone), « Gagner des crédits » (la page Parrainage n'existe pas), la pastille en haut de Réviser, la cloche N0.

---

# Suite, 2 octobre 2026 (midi) : paiement des pass par Mobile Money (pawaPay), Android seulement

## Architecture (on passe par le back-office, pas par les Edge Functions Supabase)
- **Pourquoi :** les jetons pawaPay (`PAWAPAY_API_TOKEN`, `PAWAPAY_SANDBOX_API_TOKEN`) sont dans les variables d'environnement du back-office (projet Vercel `elearn`, domaine `staff.elearnprepa.com`, dépôt `falachabt/elearn`). Il n'y en a aucun dans Supabase. Les cinq Edge Functions `payment-*` / `pawapay-webhook` du dépôt `elearn-supabase` ne sont **pas déployées** et ne servent pas (code gardé, utile pour la page web du parent F1 plus tard).
- **Base (Supabase prod) :** migration `20261002000000_paiements_pawapay` appliquée : `create_order` (prix du pays via `pass_offers`, conversion de devise), `record_deposit_result` (accès, reçu `EP-XXXX-0000`, notification « Paiement confirmé », idempotent), `expire_pending_orders` (cron chaque minute, 10 min), `cancel_my_order`, `refund_order`.
- **Back-office (branche `ccr-c5a410c9-uqry2j`, à fusionner dans `main` pour être en ligne) :**
  - `GET /api/pass/pawapay/methods?country=CM&locale=fr&sandbox=true` : sans `country`, les pays où pawaPay marche (config active, drapeaux) ; avec, les offres au prix dans la devise du pays et les opérateurs avec **leurs vrais logos** (venus de pawaPay), `available:false` pour un opérateur fermé ou exclu.
  - `POST /api/pass/pawapay/pay` (Bearer jeton Supabase de l'élève) : **direct charge**. Crée la commande, vérifie que l'opérateur accepte la **devise** du prix (sinon `INVALID_CURRENCY`) et les bornes, met le numéro au format international (le 0 de tête essayé avec et sans, confirmé par `predict-provider`), appelle `POST /v2/deposits`. Gère `PREAUTH` (code d'autorisation) et renvoie `authorizationUrl` pour `REDIRECT_AUTH`.
  - `GET /api/pass/pawapay/status/{orderId}` : relit le dépôt chez pawaPay, enregistre le résultat, renvoie le statut, le reçu et la fin du pass.
  - **Rappel pawaPay (`/api/payments/pawapay/callback`) :** une seule ligne ajoutée au début : si le dépôt est une de nos commandes de pass (`orders`), on l'enregistre et on s'arrête. Sinon le chemin d'avant est **inchangé** (paiements existants, puis transmission à **Mining Connect** via `MINING_CONNECT_PAWAPAY_WEBHOOK_URL`). Ne pas casser ça.
  - Variables : `PAWAPAY_SANDBOX_TESTERS` (e-mails autorisés à payer en sandbox, défaut : les deux comptes de Benny ; sans ça n'importe qui aurait un pass gratuit), `PAWAPAY_PASS_EXCLUDED_PROVIDERS` (défaut `ORANGE_CMR`, géré à part par GeniusPay).
- **App :** `services/paiementPass.ts` (client du back-office), `components/pass/PayerPass.tsx` (route `/offres/payer`), bouton « Payer » des offres. Suit les maquettes E2 à E5 : récapitulatif du pass, opérateurs (indisponible grisé en pointillé + bandeau), numéro avec indicatif, attente en trois étapes avec compte à rebours 10 min, annulation confirmée, reçu (montant, opérateur, validité, référence), échec par motif (solde, refus, délai, numéro, opérateur, autre). « Demander à quelqu'un de payer » est visible à chaque étape.
- **Sandbox :** l'app envoie `sandbox: true` en développement et sur le canal EAS `preview`. Numéros de test pawaPay : MTN Cameroun `237653456789` (réussi), `237653456129` (en attente). Config active du compte sandbox : BEN, BFA, CIV, CMR, COD, COG, GHA, KEN, MOZ, MWI, RWA, SEN, SLE, TZA, UGA, ZMB (pas de Gabon ni de Togo). La config de production peut différer.

## iOS : aucune référence à pawaPay, au Mobile Money ni à un paiement externe
- **Règle (précisée par Benny) :** ce n'est pas « aucun pass », c'est **aucune trace du prestataire pawaPay**. Apple ne l'accepte pas ; Apple accepte l'**achat intégré**. `services/plateforme.ts` → `paiementPossible()` n'est vrai que sur **Android** (Mobile Money, prix en FCFA, lien de paiement pour un parent).
- **Sur iOS, ce qui reste visible :** les pass (écran des offres avec leurs noms et durées, « Voir les pass », « Prendre le pass semaine », « Avec le pass, tout est illimité »). **Ce qui est masqué :** les prix en monnaie locale, le bouton « Payer », « Demander à quelqu'un de payer » (paiement externe, écran `/offres/parent` redirigé), l'écran `/offres/payer` (redirigé), les mentions Mobile Money, la note de paiement de l'aide, « t'aide à payer » du parent. L'écran des offres iOS dit « Tu pourras bientôt choisir ton pass directement dans l'application. »
- Tests : `credits/__tests__/iosSansPaiement.test.tsx` et `pass/__tests__/pass.test.tsx` (aucun FCFA, payer, paiement, Mobile Money, pawaPay sur iOS).
- **Chantier Apple à part (non fait, pour l'autre agent) :** achats intégrés (StoreKit / RevenueCat) pour vendre les pass sur iOS : produits, prix de l'App Store, validation des reçus côté serveur et création de l'`entitlement` (comme `record_deposit_result` le fait pour pawaPay), restauration des achats, textes de la fiche App Store. Brancher le bouton d'achat dans `Offres.tsx` (aujourd'hui masqué sur iOS) et réutiliser `my_access`.

## Pas encore fait
- E7 (feuille « Paiement en cours » à la réouverture de l'app), code promo, parrainage (−15 %), reçu par SMS, page web du parent F1 à brancher sur le back-office, « Renvoyer la demande » = annuler puis relancer (nouvelle commande), animation de succès au-delà du rebond.
- Orange Cameroun reste indisponible (GeniusPay).
- Test réel bout en bout : impossible avant la fusion du back-office dans `main` (la préversion Vercel n'a pas la même base).
