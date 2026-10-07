# Mémoire du Projet Elearn Prepa (Agents AI)

Ce fichier sert de cerveau collectif. Il doit être consulté pour comprendre le contexte global et doit être mis à jour par les agents à chaque fois qu'un chantier majeur est complété.

## 1. Architecture Globale
- **elearn-app** : Application mobile React Native (Expo).
- **elearn-site** : Site vitrine et web-app Next.js 15 (Tailwind).
- **elearn-supabase** : Backend Supabase (PostgreSQL, Edge Functions, RLS, RPC).

## 2. État d'avancement (Octobre 2026)
- **Paiement Parent (/p/[token])** : Fusionné sur site et backend. Permet aux parents de payer via Mobile Money (pawaPay). Liens enrichis dynamiquement pour WhatsApp.
- **Notifications Push (EAS)** : expo-notifications configuré avec Firebase (google-services.json via EAS Secrets). Routage actif en place dans src/services/rappels.ts pour rediriger les clics de notification.
- **Synchronisation Hors-Ligne** : Reprise de l'historique invité après inscription fonctionnelle.
- **En cours d'implémentation** : **Système de Parrainage (M15)**.
  - *Règles métier parrainage* : 3 étapes (1. Clic, 2. Création compte, 3. Achat Pass). Le parrain gagne à chaque étape + reçoit une notification. Le filleul gagne à l'étape 2.

### Mode hors ligne (issue #25 puis issue #13)

- **Fait, issue #25 (branche `claude/project-thread-kw792g`)** : `src/services/connectivite.ts` centralise l'état réseau. **Aucun module natif** : la détection repose sur une sonde du serveur (HEAD sur `/auth/v1/health`) toutes les 15 s au premier plan, plus `signalerEchec()` / `signalerSucces()` appelés selon le résultat réel d'une requête. `useReseau` pour l'interface, `EtatReseau` (indicateur, visible hors ligne seulement), `useGardeReseau` pour bloquer une action qui exige le serveur. Garde branchée sur la correction photo, publier/répondre dans Questions et le paiement de pass.
- **Incident évité (5 octobre 2026)** : `expo-network` avait d'abord été ajouté pour la détection réseau. C'est un module natif absent de l'APK de prévisualisation en circulation : `requireNativeModule` lève à l'évaluation du module, donc **l'app aurait planté au démarrage**, avant tout rendu, chez tous les testeurs — et `app.config.ts` ne définit pas de `runtimeVersion`, donc l'OTA aurait bien été servie. Aucun test ne le voit (Jest ne charge pas le natif) et le test en Expo Go ou en development build ne le révèle pas non plus. `expo-network` a été retiré, et le garde-fou `src/__tests__/garde-module-natif.test.ts` interdit désormais ce cas (voir AGENTS.md section 17).
- **Découverte utile** : l'échafaudage existait déjà en partie. `Composeur` acceptait une prop `horsLigne` jamais transmise, et les textes `questions.horsLigneQuestion`, `questions.horsLigneReponse`, `photo.horsLignePhrase` n'étaient utilisés nulle part. La file d'attente des réponses (`ajouterSortie` / `envoyerSortiesEnAttente` dans `src/services/questions.ts`) était déjà hors ligne.
- **Fait, issue #13 côté backend (PR #41 sur `elearn-supabase`)** : `depenser_credits` accepte un identifiant d'opération et devient idempotente (statut `replay`), avec la table `credit_operations` verrouillée. À merger avant tout envoi d'identifiant depuis l'app.
- **Reste à faire, issue #13 côté app** : solde local confirmé, file des dépenses hors ligne, réconciliation et état « à synchroniser ».
- **Piège à retenir** : remplacer une fonction PostgreSQL en ajoutant un paramètre par défaut ne supprime pas l'ancienne signature ; les deux surcharges coexistent et un appel à deux littéraux devient ambigu (`is not unique`). Il faut un `drop function if exists` explicite.

### Notifications : cloche, centre et réglages (issue #32)

- **Serveur (déjà en production, aucune migration côté app)** : migration `20261001192000_notifications_eleve` : table `notifications`, RPC `unread_notifications_count`, `mark_all_notifications_read`, `my_notification_preferences`, `set_notification_preferences`, `register_push_token`, Realtime sur la table.
- **App** : `src/services/notifications.ts` (lectures, marquage, réglages, temps réel, groupes, destinations), `src/session/NotificationsProvider.tsx` (un seul abonnement temps réel, monté dans `_layout`, réservé aux comptes : rien pour un invité), `src/components/notifications/` (`Cloche` dans l'en-tête de l'Accueil, `CentreNotifications` sur `/notifications`, `ReglagesNotifications` sur `/parametres/notifications`).
- **Règles à retenir** : la liste est gardée sur l'appareil pour le hors ligne (jamais celle d'un autre compte) ; la pastille est relue au serveur après chaque évènement temps réel, car la liste est tronquée à 50 ; le type d'une notification décide de l'écran ouvert (`destinationDe`), au toucher dans le centre comme sur un push (`suivreOuvertures` dans `rappels.ts`, qui marque aussi la notification lue) ; le jeton push était déjà enregistré par `SessionProvider`, rien n'a changé de ce côté. Aucun module natif ajouté.

## 3. Processus OTA et Build (canal preview)

Workflow : .github/workflows/eas-preview.yml (secret de depot EXPO_TOKEN requis).

- **OTA automatique** : un push sur main, wk, claude/project-thread-cvknuk ou claude/project-thread-kw792g publie une mise a jour OTA Android sur le canal preview, **a condition** que le job verifier passe (typage + ESLint + Jest + export Hermes non vide ; le meme job publie ensuite, un seul checkout et un seul npm ci). Pas de run si seuls docs/ ou des .md changent, ni sur une PR en brouillon ; une PR dont la branche est deja dans on.push.branches n est pas controlee deux fois ; un nouveau commit sur une PR annule le run precedent de cette PR (les push restent en file, jamais annules) ; typage, ESLint et Jest tournent en parallele dans le job ; sur un push, ils ne sont pas refaits si la PR dont le dernier commit est parent du commit de fusion a deja reussi (l export Hermes est toujours refait). verifier est une barriere : si un controle echoue, rien n'est publie.
- **Build APK a la demande** : commit contenant [build], ou Actions > EAS preview > Run workflow avec l'option build. Mise a jour obligatoire : commit contenant [obligatoire].
- **Branche de travail et de preview de reference** : claude/project-thread-kw792g.

### Pieges constates (incident du 5 octobre 2026)

Trois runs EAS preview en echec sur la branche wk :

| Run | Etape en echec | Cause |
| --- | --- | --- |
| 37275266609 | Tests Jest | 4 attentes de src/services/__tests__/compte.test.ts non mises a jour apres le passage au RPC apply_referral_on_signup |
| 37277616042 | Typage | TS2304: Cannot find name chemin dans src/services/parrainage.ts, constante perdue lors d'une resolution de conflit |
| 37283300684 | Tests Jest | Meme cause que le premier |

Enseignements a garder en tete :

1. **Les annulations de run expliquent les OTA qui ne partent plus.** L'ancien reglage concurrency group eas-preview-${{ github.ref }} avec cancel-in-progress true annulait le run en cours des qu'un nouveau push arrivait sur la meme branche (5 runs annules sur claude/project-thread-kw792g le 4 octobre). Le workflow est desormais en group eas-preview et cancel-in-progress false : les runs sont mis en file d'attente, jamais annules.
2. **Une branche de travail non declaree dans le workflow ne publie rien.** Les commits pousses sur wk n'ont produit aucune OTA automatique tant que wk n'etait pas dans on.push.branches ; seul un declenchement manuel publiait. La branche wk a ete supprimee et son travail unique rapatrie sur claude/project-thread-kw792g.
3. **Toujours lancer npm run typecheck et npm test avant de pousser** (regle AGENTS.md section 3). Le hook .githooks/pre-push le fait automatiquement : git config core.hooksPath .githooks une fois par clone.
4. **Les branches divergent vite.** Verifier avant de conclure qu'une branche est en avance : git rev-list --left-right --count origin/main...origin/wk.
5. **Les branches ne doivent pas cumuler les implementations concurrentes.** wk et kw792g avaient chacune leur version du bouton [DEV] de suppression de compte et du credit des actions quotidiennes ; sur wk, l'appel RPC add_reward_credits n'existe dans aucune migration, les credits des actions quotidiennes n'etaient donc pas verses. La fonction de reference est claim_daily_action (migration 20261004151140_daily_reward_claims.sql).

### Securite

Un fichier .env contenant des secrets (DATABASE_URL avec mot de passe Postgres, cles API NotchPay, Gemini, Qwen, PostHog) a ete committe par erreur dans un depot **public**. Il a ete retire du suivi git et ajoute au .gitignore, mais il reste dans l'historique : **toutes les cles concernees doivent etre revoquees et regenerees**, et le fichier ne doit plus jamais etre committe.