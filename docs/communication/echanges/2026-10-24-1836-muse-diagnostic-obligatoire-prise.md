# Prise du chantier « diagnostic TOEIC obligatoire » — verrouillage des onglets avant diagnostic

- Date : 24 octobre 2026, 18:36 UTC
- Auteur : Muse
- Sujet : inventaire et maquette de parcours pour rendre le diagnostic obligatoire avant l'accès aux autres menus du profil TOEIC
- État : pris
- Zones touchées : à ce stade, aucune ligne de code. Maquette uniquement (hors dépôt : `~/workspace/maquettes-a4-79/maquette-parcours-a4.html`, planche de référence du parcours « Première arrivée »). Si Benny valide la maquette, l'implémentation visera `src/app/(onglets)/_layout.tsx` et `src/components/Onglet.tsx` (interception de l'appui sur les onglets verrouillés), avec lecture de l'état du diagnostic depuis `src/services/certification/etat.ts` / `accueil.ts` — sans toucher aux écrans Tests, Réviser, Statistiques ni au moteur d'exercice.

## Cadre

Benny réassigne ponctuellement ce chantier à Muse, dans son seul périmètre (même cadre que la réassignation de l'issue #79 le même jour). La zone TOEIC reste la propriété du dev TOEIC ; cette prise est limitée au verrouillage avant diagnostic, et suit la séquence de Benny : **inventaire de l'existant, maquette de parcours, validation par Benny, code ensuite**. Aucune implémentation n'est commencée.

## Besoin exprimé par Benny (24 octobre 2026, capture à l'appui)

Après le choix du temps (A4), l'élève arrive sur l'accueil du profil TOEIC (écran « Commence par le diagnostic ») et peut déjà naviguer ailleurs : les onglets Réviser, Tests, Statistiques et Moi sont libres. Benny veut le diagnostic comme **étape obligatoire** : tant que l'élève ne l'a pas fait, il ne peut pas accéder aux autres menus.

## Inventaire (état réel du code, branche `claude/project-thread-kw792g` à `85f1f4a`)

### État « diagnostic fait / pas fait »

- Source de vérité locale : `EtatDiagnostic` (AsyncStorage, clé `cert.diagnostic`, `src/services/certification/etat.ts`) — `tentative`, `reponses`, `index`, `termine` (fin locale : les 20 réponses sont gardées) et `fin: FinTentative | null` (résultat du diagnostic).
- Drapeau consommé par l'interface : `DonneesAccueil.diagnosticFait` (`src/services/certification/accueil.ts`, `chargerAccueil()`) = `!!lireDiagnostic()?.fin`. Commentaire du champ : « Diagnostic terminé : sans lui, l'accueil reste la préparation (maquette TOEIC-S7), sans cartes. »
- Machine à états de l'arrivée : `etapeCertification()` (`src/services/certification/reprise.ts`) — `fin` → `/certification/resultat` (A7) ; `termine` → `/certification/fin` (A8) ; tentative avec réponses → `/certification/diagnostic` (A6) ; plan avec minutes → `/certification/arrivee` (A5) ; sinon objectif (A3) ou choix de la certification (A2).
- Le profil (`src/services/profil.ts`) porte en plus `termine`, posé à « Voir mon plan » (A7) ; `profilToeicActif()` (`accueil.ts`) teste `type === 'certification'`.

### Où l'arrivée A5 décide ce qu'elle affiche

- A5 plein écran : `ArriveeToeic.tsx` (route `/certification/arrivee`) affiche `PreparationDiagnostic` en version complète ; le pied propose « Commencer le diagnostic » (ou « Reprendre le diagnostic » si un état existe sans `fin`) et pousse vers `/certification/diagnostic` (évènement `cert_diagnostic_started`).
- Onglet Accueil : `AccueilToeic.tsx` (N1) — si `!diagnosticFait`, le contenu est `PreparationDiagnostic` en variante S7 (`complet={false}`, sans « Ce que ça donne ») et le bouton « Commencer le diagnostic » est fixé en pied, au-dessus de la barre d'onglets. **C'est l'écran de la capture de Benny.** Sinon : séance du jour, compte à rebours, score, mots, reprise de série.

### Navigation par onglets et point d'accroche du verrouillage

- Barre définie dans `src/app/(onglets)/_layout.tsx` (`expo-router/ui` : `Tabs`, `TabTrigger`, composant `Onglet`). La barre TOEIC (Accueil · Réviser · Tests central · Statistiques · Moi) s'affiche quand `barreToeic = drapeau cert_profile_enabled ouvert && profilToeicActif()`.
- Le comportement actuel est un choix documenté dans le layout : « Les onglets TOEIC s'ouvrent dès l'arrivée (objectif et temps) : diagnostic commencé ou en cours compris. Le résultat reste une étape obligatoire tant que "Voir mon plan" n'a pas été pressé. » La garde d'arrivée laisse donc passer dès l'étape `/certification/arrivee` ou `/certification/diagnostic` : les cinq onglets sont libres avant le diagnostic — c'est ce que Benny demande de changer.
- Les écrans d'onglets choisissent leur version via `useProfilToeic()` (`index.tsx`, `reviser.tsx`, `moi.tsx`) ; `tests.tsx` et `statistiques.tsx` sont TOEIC uniquement. Un verrouillage conditionné par `barreToeic && !diagnosticFait` ne touche donc **ni le profil secondaire, ni le profil concours**.
- Point d'accroche réaliste : le composant `Onglet` (`src/components/Onglet.tsx`) est un `Pressable` qui reçoit le `onPress` du `TabTrigger` et sait déjà intercepter un appui (le bouton central Photo déclenche l'obturateur au lieu de naviguer quand l'appareil est affiché). Même patron ici : dans le layout, quand le verrouillage est actif, passer aux onglets verrouillés un `onPress` qui ouvre la feuille du bas au lieu de naviguer, et marquer l'onglet `accessibilityState={{ disabled: true }}` avec l'état visuel atténué. La feuille (`src/components/Feuille.tsx`) se rend en modale au-dessus de la barre d'onglets : le layout peut la déclarer. Le layout lit déjà le profil et l'étape de reprise à chaque changement d'écran ; il peut y ajouter la lecture du diagnostic (`lireDiagnostic()`).

### Ce que disent le cahier et les issues

- Cahier TOEIC v1.35, §5.A, fiche A5 : « proposer le diagnostic en premier » ; les rangées de l'écran A5 sont « non cliquables tant qu'elles sont vides » (AC-A5-3) — dans l'écran seulement. **Aucune règle du cahier ne verrouille la barre d'onglets**, et rien n'y parle de diagnostic obligatoire côté navigation : le besoin est nouveau, il faudra la décision de Benny et une inscription au cahier (décision ou écart) quand il validera.
- Écart E-07 (cahier) : doublon A5/S7 — déjà résolu dans le code (S7 est l'état avant diagnostic de l'accueil N1, même composant `PreparationDiagnostic`).
- Issues ouvertes d'`elearn-app` (43, relues le 24 octobre) : **aucune ne couvre ce besoin**. Les plus proches sont les écrans eux-mêmes (#81 A6, #82 A7, #100 N3, #108 T1 à T7) et #117 (états transverses : vide, erreur, hors ligne, squelette — pas le verrouillage). Une issue dédiée sera à créer (chef de projet) une fois la maquette validée.

## Proposition (maquette, en attente de validation)

Planche de référence du parcours « Première arrivée (A1 → A7) » mise à jour (`~/workspace/maquettes-a4-79/maquette-parcours-a4.html`, aperçu PNG régénéré) : deux cadres ajoutés près de A5 dans chaque rangée (clair et sombre), marqués PROPOSITION, reliés par un connecteur « + » (ce sont des états de A5, pas des étapes du flux) :

- **6 bis · A5 — Accueil du profil, onglets verrouillés** : l'écran de la capture (variante S7) avec la barre du bas — Accueil courant ; Réviser, Tests et Statistiques verrouillés (icône et libellé atténués à 0,45, mini-cadenas en pastille au coin de l'icône sur le patron du badge de nouveautés du composant `Onglet`, bouton central Tests en fond creux au lieu d'émeraude) ; Moi dessiné accessible.
- **6 ter · Feuille du bas — onglet verrouillé touché** : composant `Feuille` sur fond voilé à 0,45 (règle de Benny : un blocage se dit par une feuille du bas, jamais une bannière — AGENTS.md §21). Pastille soleil à cadenas, titre « Commence par le diagnostic », texte « Fais d'abord le diagnostic : il sert à composer ta séance. » (phrase du cahier pour S7), bouton « Commencer le diagnostic » (ou « Reprendre le diagnostic » si un diagnostic est en cours) qui ferme la feuille et pousse vers `/certification/diagnostic`. Titre et bouton sont les libellés existants `certification.arrivee.*` de `src/i18n/fr.ts`. Feuille non bloquante : toucher le fond la ferme, rien n'est écrit.

## Choix ouverts (à trancher par Benny avant tout code)

1. **Onglets verrouillés visibles** (dessiné : atténués + cadenas) ou **masqués** ? Masquer déplace le bouton central Tests et change la géométrie de la barre ; la proposition garde la barre stable.
2. **Périmètre** : Réviser, Tests, Statistiques verrouillés ; Accueil toujours libre. **Moi** : dessiné libre (porte de sortie : changer de profil, réglages — dont « Temps par jour » en mode modifier —, déconnexion). Le verrouiller aussi enfermerait l'élève dans le profil TOEIC.
3. **Moment du déverrouillage** : dès la fin du diagnostic (A8, résultat calculé — `fin` posée, c'est le drapeau `diagnosticFait` actuel) ou seulement après « Voir mon plan » (A7, `profil.termine`) ? La proposition retient la fin du diagnostic : A7 fait déjà partie du flux forcé par la garde de reprise.
4. **Signal visuel** : atténuation + cadenas (dessiné) ou atténuation seule ?

## Reste à faire dans cette prise

- Validation de la maquette par Benny (et réponses aux choix ci-dessus).
- Ensuite seulement : issue dédiée, inscription au cahier, implémentation (test qui échoue, correctif, `npm run valider`, captures clair/sombre comparées à la maquette), commit `muse:` selon le protocole.

## Correction — décision de Benny (24 octobre 2026, après présentation de la maquette)

Benny a écarté la proposition de verrouillage et tranché pour le **masquage** : pas d'onglets grisés, pas de cadenas — on masque les menus, l'élève ne voit que le diagnostic à faire, donc il se sent un peu obligé de le faire (sa raison, en substance). Conséquences sur ce qui précède :

- **Le cadre 6 ter (feuille du bas) disparaît**, et avec lui le point d'accroche « interception de l'appui sur les onglets verrouillés » décrit dans l'inventaire : il n'y a plus rien à toucher, donc rien à expliquer par une feuille. Si Benny valide la planche corrigée, l'implémentation visera le seul layout (`src/app/(onglets)/_layout.tsx`) : ne pas rendre la barre TOEIC tant que `diagnosticFait` est faux — l'accueil reste affiché, sans barre — et la faire apparaître dès la fin du diagnostic.
- **Les choix ouverts sont tranchés par la décision** : le n° 1 (visibles ou masqués) → masqués ; le n° 2 (périmètre) tombe de lui-même — la barre entière est masquée, donc **Moi aussi**, il n'y a plus de « porte de sortie » visible avant le diagnostic ; le n° 3 → la barre apparaît **dès la fin du diagnostic** (drapeau `diagnosticFait` actuel) ; le n° 4 (signal visuel) n'a plus d'objet.
- **Planche corrigée le même jour** (`~/workspace/maquettes-a4-79/maquette-parcours-a4.html`, aperçu PNG régénéré) : dans les deux rangées, les anciens cadres 6 bis (onglets verrouillés) et 6 ter (feuille du bas) sont remplacés par un seul cadre **6 bis « A5 — Accueil du profil, menus masqués (choix de Benny) »** : l'accueil en variante S7 (en-tête « Accueil », compteur « 15 · INVITÉ », carte « Commence par le diagnostic ») dessiné **sans aucune barre d'onglets** — l'écran se termine sur le bouton « Commencer le diagnostic ». Sous-titre de la planche, cartouche « Comment lire ce parcours » et notes de sources mis à jour en conséquence ; le CSS propre au verrouillage (barre atténuée, cadenas, feuille) a été retiré de la planche.
- Reste à faire, inchangé : validation de la planche corrigée par Benny, puis issue dédiée, inscription au cahier et implémentation.
