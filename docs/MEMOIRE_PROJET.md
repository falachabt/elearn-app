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

## 3. Processus OTA et Build (canal preview)

Workflow : .github/workflows/eas-preview.yml (secret de depot EXPO_TOKEN requis).

- **OTA automatique** : un push sur main, wk, claude/project-thread-cvknuk ou claude/project-thread-kw792g publie une mise a jour OTA Android sur le canal preview, **a condition** que le job verifier passe (Jest + typage + export Hermes non vide). verifier est une barriere : si un controle echoue, rien n'est publie.
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