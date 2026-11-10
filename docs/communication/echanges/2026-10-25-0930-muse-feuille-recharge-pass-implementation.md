# Implémentation — Feuille « recharger le Pass » (issue #124, 25 octobre 2026, Muse)

Maquette validée par Benny le 25/10/2026 (« Implémente »), avec la règle de réaffichage de l'inventaire
(A + soupape C) et une précision ajoutée le même jour : **le contrôle de l'état du Pass et la feuille doivent
être présents quel que soit le parcours actif de l'élève — Concours, Certification ou Secondaire**. Livré en
commits locaux sur `claude/project-thread-kw792g`, aucun push (en attente du « Pousse » de Benny).

## Ce qui est livré

- **Nouveau service `src/services/rechargePass.ts`** — règle et persistance :
  - `situationPass(acces, derniereFin)` : accès actif (jours calendaires via `joursAvant`) ou « expiré »
    (dernière fin connue dépassée sans accès actif, patron symétrique de `BienvenuePass`), sinon rien.
  - Fenêtre d'entrée **J-3** (`FENETRE_RECHARGE_JOURS`) ; urgence = veille, dernier jour ou expiré.
  - `doitPresenter` : dans la fenêtre et pas déjà montrée **aujourd'hui** pour cette date de fin → « Plus tard »
    réarme au lendemain, au plus une fois par jour tant que le Pass n'est pas rechargé.
  - Drapeau `pass.recharge.affichee.<finISO>` posé **uniquement à l'affichage effectif** ; dernière fin connue
    par élève `pass.recharge.derniereFin.<userId>` (fin + offre). Rechargé = nouvelle fin = nouveau cycle,
    silence immédiat (fin hors fenêtre).
  - `lireSituation(client, userId)` : `lireAcces()` frais, repli sur la dernière fin connue ; note la fin
    connue à chaque accès actif lu.
  - `feuilleRechargePrioritaire(client, userId)` : pour le récap « Ma semaine » — vrai si une feuille urgente
    est due à cette ouverture.
  - Demande d'ouverture au toucher : `demanderFeuilleRecharge({ joursRestants })` / `sAbonnerFeuilleRecharge`
    (renvoie `false` si la feuille n'est montée nulle part → l'appelant navigue).
  - Coordination récap en mémoire de session : `noterRecapAutoPresente()` / `nombreRecapsAutoPresentes()`.
- **Nouveau composant `src/components/pass/FeuilleRechargePass.tsx`**, monté à la racine dans
  `src/app/_layout.tsx`, à côté de `BienvenuePass` (dans les providers Session/Credits/Notifications,
  au-dessus de la pile de navigation) :
  - Ouverture automatique sur le patron `useOuvertureRecapAuto` : session prête, compte non invité, pas de
    reprise invité en cours, `pathname === '/'`, démarrage à froid ou reprise > 30 min (`DELAI_REPRISE_MS`).
    Si le récap vient de s'ouvrir à cette ouverture, la feuille attend la suivante.
  - Ouverture au toucher via l'abonnement : état rel (serveur) d'abord ; à défaut (hors ligne, jamais vu),
    `days_left` de la charge utile ; repli final vers `/offres` (invité, reprise en cours, état illisible).
    Montrée au toucher = affichage effectif : le drapeau du jour est posé aussi dans ce cas.
  - Contenu (textes neufs `pass.recharge.*`, fr + en) : titre dynamique (« Dernier jour de ton Pass »,
    « Ton Pass expire demain », « Ton Pass expire dans {{n}} jours », « Ton Pass est expiré »), carte offre +
    date de fin quand elles sont connues (« Pass mois · jusqu'au mercredi 28 octobre » ; « terminé le … » à
    l'état expiré), pastille billet (alerte à l'état expiré), actions « Recharger mon Pass » (état expiré :
    « Voir les offres », comme le cadre 4 de la maquette) → `/offres` avec `declencheur: 'recharge-pass'`,
    « Plus tard » en secondaire, mention `offres.sansAbonnement`.
- **Routage** : `destinationDe` — branche `pass_ending` repointée vers `/offres`
  (`params: { declencheur: 'recharge-pass' }`) et placée **avant** le repli `data.screen` (le serveur envoie
  encore `screen: '/paiements'`, désormais inerte côté app) ; ancienne branche `/paiements` supprimée.
- **Interceptions au toucher** : `suivreOuvertures()` (`rappels.ts`) et `CentreNotifications.ouvrir()` —
  `pass_ending` intercepté avant toute navigation : demande d'ouverture de la feuille, `notification_opened`
  et `marquerLue` conservés ; si la feuille n'est pas montée, navigation vers les offres (jamais `/paiements`).
- **Priorité au démarrage** : `useOuvertureRecapAuto` consulte `feuilleRechargePrioritaire` avant de pousser
  le récap et signale son ouverture par `noterRecapAutoPresente()`. Le reste de l'ordre de l'inventaire tient
  par construction : `GardeAppareilActif`/`MiseAJour` sont des gardes au-dessus de la pile ; la reprise de
  paiement en attente quitte `/` (le gate `pathname` bloque la feuille) ; `BienvenuePass` est mutuellement
  exclusive (transition vers un Pass actif contre fenêtre d'expiration) ; les feuilles #123 sont locales à
  l'écran Diagnostic et #121 est un masquage, aucun conflit.
- **Analytics** : aucun événement nouveau (précédent #123) ; `notification_opened` inchangé. La valeur
  `declencheur: 'recharge-pass'` est ajoutée à l'union de `paywall_viewed` (`evenements.ts`, `Offres.tsx`,
  dictionnaire `docs/analytics/`) — c'est le seul paramétrage ajouté.
- **Aucun changement serveur** ; aucun écran TOEIC touché (la feuille est à la racine, hors `(onglets)`).

## Tous parcours (précision de Benny du 25/10/2026)

Vérifié dans le code, rien n'est lié à un parcours :
- Le profil actif (`src/services/profil.ts`) vaut `'eleve'` (Secondaire), `'concours'` ou `'certification'`,
  mais **aucun point d'accroche ne le lit** : le pilote est `lireAcces()` (RPC `my_access`, niveau compte) et
  la session, pas le profil.
- La feuille est montée dans le layout **racine**, au-dessus du groupe `(onglets)` : elle peut se présenter
  dans les trois contextes, y compris quand la barre d'onglets TOEIC remplace celle de l'élève.
- Le gate `pathname === '/'` désigne l'accueil, qui est la **même route** pour les trois parcours
  (`(onglets)/index.tsx` rend `AccueilToeic` en certification, `Accueil` en élève/concours).
- Destination `/offres` : route racine, joignable depuis les trois contextes. `Offres.tsx` ne lit le profil
  que pour le **pays** (catalogue par pays) : les trois offres (semaine, mois, concours) sont présentées à
  tous, et la carte de la feuille nomme l'offre **en cours de l'élève** (semaine/mois/concours) avec sa date —
  la destination est donc la bonne pour chaque parcours.
- Couverture de test : le test composant présente la feuille à J-3 avec chacun des trois profils actifs
  rangés sur l'appareil (`it.each` élève / concours / certification).

## Tests

- Nouveau `src/services/__tests__/rechargePass.test.ts` (17 tests) : situation, fenêtre J-3, urgence,
  réaffichage (une fois par jour, clé date de fin, rechargé = nouveau cycle), dernière fin par élève,
  priorité récap, demande d'ouverture au toucher.
- Nouveau `src/components/pass/__tests__/feuilleRechargePass.test.tsx` (14 tests) : ouverture J-3 dans les
  trois parcours, J-4 rien, déjà montrée aujourd'hui, expiré, gratuit de toujours, invité, « Plus tard »,
  « Recharger mon Pass » → `/offres`, thème sombre, report après récap + ouverture suivante (reprise
  > 30 min), toucher J-8 par la charge utile, repli invité au toucher.
- Mis à jour : `notifications.test.ts` (destination `pass_ending` → `/offres`, `data.screen` serveur inerte),
  `ouverturesNotifications.test.ts` (repli offres sans feuille montée ; demande de feuille sans navigation
  quand elle est montée), `useOuvertureRecapAuto.test.tsx` (priorité #124 et signalement de l'ouverture).
- `npm run valider` complet : vert (voir le rapport de livraison ; typecheck + ESLint + Jest + export
  Android Hermes).

## Captures de recette

Non produites, explicitement : aucun harnais ne permet de simuler un état Pass côté web — la démo
`EXPO_PUBLIC_CERT_DEMO` ne couvre que le profil TOEIC (sans session ni accès Pass), le solde simulé de la page
développeur force `illimite: false` sans date de fin, et `my_access` exige une session réelle (le compte de
Benny est en limite d'appareils jusqu'au 01/11/2026). La recette s'appuie donc sur les tests ci-dessus, qui
rendent la feuille dans ses deux états (J-3 et expiré) et les deux thèmes (clair/sombre). La vérification sur
appareil se fera après le push : Benny est lui-même à J-3 de son Pass (fin le 28/10/2026), c'est le cas réel
du test du 25/10 au matin.

## Reste à faire

- Push sur le « Pousse » de Benny, puis commentaire de livraison sur l'issue #124 (fermeture = revue qualité).
- Nettoyage serveur optionnel, hors périmètre : le `screen: '/paiements'` encore envoyé dans la charge utile
  `pass_ending` est désormais inerte côté app.
