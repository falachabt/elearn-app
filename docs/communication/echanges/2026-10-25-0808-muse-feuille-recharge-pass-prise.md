# Prise — Feuille « recharger le Pass » depuis la notification d'expiration (25 octobre 2026, Muse)

Demande de Benny (25/10/2026, après le test réel de l'alerte J-3 reçu à 9 h) : aujourd'hui, toucher la
notification d'expiration du Pass amène à « Mes paiements ». Voulu :

1. Toucher la notification d'expiration ouvre une **feuille du bas « recharger le Pass »** (Pass qui expire
   bientôt ou expiré, bouton vers les **offres Pass**).
2. **Sans toucher la notification**, à la **prochaine ouverture de l'app**, la même feuille s'ouvre
   automatiquement.

Mission du jour : inventaire + issue + maquette. Aucune implémentation.

## 1. Pourquoi « Mes paiements » aujourd'hui (cause racine, vérifiée)

- Le type serveur est **`pass_ending`** (catégorie de réglage : `null`, toujours envoyée —
  `categorieDe('pass_ending') === null`, `src/services/notifications.ts`). Cadence serveur des alertes :
  J-8, J-5, J-3, J-2, J-1 (producteur elearn-supabase, chantier #34 fermé). La charge utile de la
  notification porte **`days_left`** et **`screen: '/paiements'`** (miroir dans les tests :
  `src/services/__tests__/notifications.test.ts:236`, `ouverturesNotifications.test.ts:66`), plus
  `notificationId` côté push.
- **Un seul routeur pour les deux entrées** : `destinationDe(type, data, origine)` dans
  `src/services/notifications.ts`. Deux chemins convergent vers `/paiements` :
  - le repli générique `data.screen` (`if (ecran && ecran !== '/') return { pathname: ecran }`), placé
    **avant** la branche du type ;
  - la branche explicite en fin de fonction : `if (type === 'pass_ending') return { pathname: '/paiements' };`
    (commentaire d'origine : « Fin de Pass : la page des paiements (retour vers Moi) »).
- Appelants : le push, par `suivreOuvertures()` (`src/services/rappels.ts:117`, listener
  `addNotificationResponseReceivedListener` monté une fois dans `src/app/_layout.tsx`) — `pass_ending`
  tombe dans la branche générique, navigation + `marquerLue(notificationId)` ; la cloche, par
  `CentreNotifications.ouvrir()` (`src/components/notifications/CentreNotifications.tsx`) —
  `suivre('notification_opened')`, `marquerLue(n.id)`, puis `router.push(destinationDe(..., 'inbox'))`.
- Tests qui verrouillent l'ancien comportement et seront à mettre à jour :
  `notifications.test.ts:236-237` (destination `/paiements`) et `ouverturesNotifications.test.ts:66`
  (toucher push `pass_ending`).

**Conséquence pour le correctif** : caser `pass_ending` **avant** le repli `data.screen` dans
`destinationDe`, ou l'intercepter dans les deux appelants. Le `screen: '/paiements'` envoyé par le serveur
devient alors inerte (nettoyage serveur optionnel, hors périmètre app).

## 2. La cloche et le statut lu/non lu

- `CentreNotifications` : ligne non lue = fond `accent.soleilDoux`, point rouge, pastille d'icône
  « paiement » (BadgeCheck) pour `pass_ending`. Le toucher **marque lu d'abord**, navigue ensuite.
  « Tout lire » (`mark_all_notifications_read`) éteint tout sans navigation.
- `NotificationsProvider` (`src/session/NotificationsProvider.tsx`) : liste + compteur de non lues,
  abonnement temps réel, rafraîchissement au retour au premier plan ; réservé aux comptes (invité : rien).
- **Le statut lu ne peut pas piloter la réouverture automatique** : Benny demande la feuille « que tu aies
  appuyé dessus ou pas ». Si la feuille marquait la notification lue ou dépendait d'une non lue, « tout
  lire » ou un toucher dans la cloche éteindrait le rappel sans rechargement. Le pilote recommandé est
  l'**état du Pass** (§4), pas la notification.

## 3. Le parcours Pass existant

- État du Pass déjà disponible partout : `lireAcces()` (`src/services/pass.ts`, RPC `my_access` →
  `{ offre, fin, source } | null`) et le solde du `CreditsProvider` (`solde.illimite`,
  `solde.illimiteJusqua`), consommés par `EcranMoi` : `finPass = solde?.illimiteJusqua ?? acces?.fin`,
  `jours = joursAvant(finPass)` (`src/services/quand.ts`). Textes existants réutilisables :
  `profil.passBientot` (« Plus que {{n}} jours »), `profil.passDernierJour` (« Dernier jour »),
  `profil.passDetail` (« Jusqu'au {{date}} · crédits illimités »).
- Écran des offres : route **`/offres`** (`src/app/offres/index.tsx` → `src/components/pass/Offres.tsx`).
  Navigation canonique depuis ailleurs : la carte Pass de Moi pousse
  `{ pathname: '/offres', params: { declencheur: 'moi' } }`. Textes : `offres.titre` « Choisis ton pass »,
  offres semaine / mois / concours, `offres.sansAbonnement` « Pas d'abonnement caché : le pass s'arrête
  tout seul à la fin. », `offres.actif` « Ton {{offre}} est actif jusqu'au {{date}}. »
- État « expiré » : aucun accès actif (`lireAcces` → null, `avecPass` faux dans Moi). Pour savoir qu'un
  Pass **vient** d'expirer (et pas que l'élève est gratuit de toujours), le patron existe déjà :
  `BienvenuePass` garde la dernière fin connue par utilisateur (`CLE_ETAT_PASS = 'pass.etat'`, transitions
  inactif → actif). Le symétrique (actif → inactif avec fin dépassée) donne l'état « Pass expiré ».

## 4. Point d'entrée « ouverture de l'app » et règle de réaffichage

Patrons existants, tous montés dans `src/app/_layout.tsx` :

- `Navigation()` : effet sur `statut === 'pret'` + listener `AppState 'active'` — c'est là que vit déjà le
  contrôle de reprise de paiement (`lirePaiementAttente()` → redirection `/offres/payer`).
- `useOuvertureRecapAuto()` (`src/components/maSemaine/`) : ouverture automatique **uniquement sur
  l'accueil** (`pathname === '/'`), au démarrage à froid ou à la reprise après > 30 min
  (`DELAI_REPRISE_MS`), jamais pour un invité, jamais pendant une reprise de compte.
- Feuilles globales montées à la racine : `BienvenuePass`, `BienvenueCredits`, `MiseAJour`,
  `GardeAppareilActif`, `BandeauApplication` ; le composant **`Feuille`** (gorhom, `BottomSheetModal`)
  est l'habillage réglementaire (pastille, titre, texte, actions, `bloquante` optionnel) — exemples
  `FeuilleRappel`, `FeuilleCompte`, `FeuilleMiseAJour`, et les feuilles du tour diagnostic #123.
- Report « plus tard » : patrons `PropositionNotifications`/`proposerNotifications` (7 jours) et
  `rappels.ts` (`DELAI_REPROPOSER_JOURS = 3`, compteurs et dates en AsyncStorage par clé dédiée).

**Proposition de branchement** : un composant `FeuilleRechargePass` monté à la racine (à côté de
`BienvenuePass`, dans l'arbre des providers Session/Credits/Notifications) + un hook de contrôle sur le
modèle de `useOuvertureRecapAuto` : session prête, compte non invité, `pathname === '/'`, démarrage à
froid ou reprise > 30 min, et aucune feuille prioritaire présentée (§5).

**Règle de réaffichage — options** :

- **A. Une fois par cycle d'expiration** : la feuille s'ouvre à la première ouverture où le Pass entre
  dans la fenêtre d'alerte ; drapeau local clé par la **date de fin** du Pass
  (`pass.rechargeFeuille.<finISO>`). Rechargé = nouvelle date de fin = nouveau cycle. Simple, hors ligne
  OK (solde connu), mais un « Plus tard » à J-3 éteint le rappel jusqu'à l'expiration.
- **B. Pilotée par la notification non lue** : écartée (§2) — contredit la demande de Benny.
- **C. Insistante bornée** : à chaque ouverture tant que le Pass n'est pas rechargé, avec report de
  24 h à chaque fermeture par « Plus tard » (patrons de report existants).

**Recommandation : A + soupape C.** Fenêtre d'entrée : `joursAvant(fin) <= 3` (les alertes J-8/J-5
restent de simples notifications ; la feuille arrive quand l'échéance devient concrète, alignée sur
l'alerte J-3 testée par Benny). Première ouverture dans la fenêtre → feuille. Fermeture par « Plus
tard » → réouverture au plus **une fois par jour** tant que le Pass n'est pas rechargé. Fermeture par le
bouton → navigation `/offres` (param `declencheur: 'recharge-pass'`). Dès que `lireAcces` montre une
nouvelle date de fin, le cycle est clos. État expiré : même feuille, titre/texte « expiré », même
cadence journalière, jusqu'à rechargement. Le drapeau n'est posé qu'à l'**affichage effectif** (jamais à
la simple détection), pour ne pas perdre le rappel si une feuille prioritaire occupe l'écran.

**Contenu de la feuille** (textes neufs `pass.recharge.*`, fr + en) :
- Jours restants : titre dynamique — `jours === 0` « Dernier jour de ton Pass », `1` « Ton Pass expire
  demain », sinon « Ton Pass expire dans {{n}} jours » ; texte « Recharge-le maintenant pour garder tes
  corrections et tes contenus illimités, sans interruption. »
- Expiré : titre « Ton Pass est expiré », texte « Tu es repassé en gratuit : tes corrections sont
  limitées chaque jour. Recharge un pass pour retrouver l'illimité. »
- Actions : principal « Recharger mon Pass » → `/offres` ; secondaire « Plus tard » ; mention
  `offres.sansAbonnement` réutilisée.

**Routage au toucher** : `suivreOuvertures` et `CentreNotifications.ouvrir` interceptent `pass_ending`
**avant** `destinationDe` et demandent l'ouverture de la feuille (service d'ouverture partagé, la feuille
étant montée à la racine), en gardant `notification_opened` + `marquerLue`. `days_left` de la charge
utile peut alimenter le titre immédiatement ; à défaut, recalcul par `joursAvant(finPass)`. Repli si la
feuille ne peut pas s'ouvrir (invité, reprise en cours) : `/offres`. `destinationDe` garde une branche
`pass_ending` → `/offres` comme filet (et ses tests sont mis à jour en conséquence).

## 5. Conflits de feuilles au démarrage et priorité proposée

1. `GardeAppareilActif` (bloquant, compte/appareil) — toujours premier.
2. `MiseAJour` (feuille de mise à jour forcée/conseillée).
3. Reprise de paiement en attente (`Navigation` → `/offres/payer`) : un paiement déjà engagé ne doit
   pas être doublé d'une incitation à recharger.
4. `BienvenuePass` : mutuellement exclusive par construction (elle célèbre une transition vers un Pass
   actif ; la feuille recharge suppose l'inverse).
5. **Feuille recharge Pass (proposée)** — uniquement sur l'accueil, session prête.
6. Récap « Ma semaine » automatique : ouvre un **écran** (push), pas une feuille. Si les deux se
   déclenchent à la même ouverture : feuille Pass d'abord quand `jours <= 1` ou Pass expiré (urgence),
   sinon récap d'abord et feuille à l'ouverture suivante (le drapeau n'étant posé qu'à l'affichage).
7. Tour diagnostic #123 : feuilles **locales** à l'écran Diagnostic, aucun conflit au démarrage ;
   diagnostic obligatoire (#121) = masquage d'onglets, pas une feuille — un élève en arrivée TOEIC
   n'est pas sur `/`, le gate `pathname` suffit. `PropositionNotifications` ne s'affiche qu'en fin
   d'activité, jamais au démarrage. Rappel invité (`FeuilleCompte`) : la feuille recharge exige un
   compte, invité exclu.

## 6. Issue et maquette

- Aucune issue existante sur ce sujet (recherche dans les 40 ouvertes et les fermées « pass / notif » :
  #32 et #34 sont le centre et ses types, fermées ; rien sur le routage `pass_ending` ni la feuille de
  rechargement). Issue dédiée créée : **#124** — « [M9-Pass] Notification d'expiration du Pass :
  feuille « recharger le Pass » au toucher et à la prochaine ouverture » (P1, ecran, fonction,
  status:todo).
- Maquette : parcours « Notification d'expiration du Pass » ajouté à la planche vivante
  `~/workspace/maquettes-a4-79/maquette-parcours-a4.html` (5 cadres × clair/sombre) : notification et
  cloche → feuille J-3 au toucher → même feuille à l'ouverture suivante → feuille « Pass expiré » →
  offres Pass. Aperçu : `~/workspace/maquettes-a4-79/maquette-parcours-pass-apercu.png`.

## Périmètre d'implémentation proposé (pour l'issue)

Nouveau service `src/services/rechargePass.ts` (règle, drapeaux par date de fin, report 24 h) ; nouveau
composant `src/components/pass/FeuilleRechargePass.tsx` (habillage `Feuille`) monté dans
`src/app/_layout.tsx` ; hook de contrôle sur le modèle `useOuvertureRecapAuto` ; interception
`pass_ending` dans `suivreOuvertures` (rappels.ts) et `CentreNotifications.ouvrir` ; branche
`pass_ending` de `destinationDe` repointée vers `/offres` avant le repli `data.screen` ; textes
`pass.recharge.*` fr/en ; événement analytics à déclarer si suivi de l'ouverture de la feuille
(dictionnaire `docs/analytics/`) ; tests : service de règle, destination, ouvertures push, centre.
Aucun changement serveur requis ; aucun écran TOEIC touché.
