# Publication sur l'App Store

Plan établi le 08/10/2026 à partir des App Review Guidelines d'Apple (developer.apple.com/app-store/review/guidelines) et de l'état du code. Android (Play Store) est déjà déployé et ne change pas.

## 1. Règles Apple qui nous concernent

| Règle | Exigence | État |
|---|---|---|
| 3.1.1 | Tout contenu ou accès numérique vendu dans l'app passe par l'achat intégré. Restauration des achats obligatoire. | Client RevenueCat écrit (`services/achatsIntegres.ts`, écran Offres). Produits, clé et webhook à faire (section 3). |
| 3.1.1(a) | Aucun bouton, lien ou appel à l'action vers un autre moyen de payer (Mobile Money, lien parent). | Déjà masqué sur iOS (`plateforme.ts`, tests `iosSansPaiement`). À revérifier à chaque nouvel écran. |
| 3.1.2 | Un abonnement renouvelable dure au moins 7 jours. Décrire ce qu'on obtient avant d'acheter. | Nos pass ne se renouvellent pas : produits « abonnement sans renouvellement » (semaine, mois, concours). |
| 3.1.3(b) | Un service multiplateforme peut donner accès à ce qui a été acheté ailleurs (Mobile Money sur Android) si les mêmes offres existent en achat intégré dans l'app iOS. | Respecté si les trois pass existent côté iOS. Le droit vient de `my_access`, quelle que soit la source. |
| 4.8 | Si l'app propose une connexion sociale (Google, Facebook), proposer aussi « Continuer avec Apple ». | Corrigé : Apple apparaît aussi dans la sauvegarde du score invité (avant, Google seul). |
| 5.1.1(v) | Création de compte dans l'app : suppression du compte dans l'app. | Présente (`profil/supprimer`). À tester avec un compte Apple (révocation du jeton Apple à la suppression, voir 3). |
| 5.1.1(i) | Politique de confidentialité liée dans l'app et dans App Store Connect. | Pages web `/confidentialite` et `/cgu` à vérifier. URL à saisir dans App Store Connect. |
| 5.1.2 | Pas de pistage entre apps sans la fenêtre ATT. | PostHog sert à l'analytique de l'app seule : pas de fenêtre ATT à prévoir tant qu'on ne croise pas avec d'autres apps ni publicité. À confirmer dans le questionnaire « confidentialité de l'app ». |
| 2.1 | App complète, compte de démonstration fourni, achats visibles et fonctionnels pour le relecteur. | À préparer : compte de test + note de relecture, achats Sandbox. |
| 2.3.10 | Aucune mention ni image d'une autre plateforme mobile dans l'app ou la fiche. | Aucun texte « Android » visible par l'utilisateur dans l'app. Les références du code sont techniques (canaux de notification). À garder vrai pour la fiche (captures sans barre Android). |
| 1.2 | Si contenu d'élèves visible par d'autres (questions, entraide, classement) : signalement, blocage, contact publié. | À vérifier avec le parcours G avant la soumission. |
| 5.1.4 | Public mineur : politique claire, pas d'analytique tierce intrusive. | À relire avec la politique de confidentialité. |

## 2. Fait dans cette branche
- Apple dans le parcours de sauvegarde du score invité (règle 4.8) et test.
- `services/achatsIntegres.ts` : configuration RevenueCat, prix lus chez Apple, achat, restauration, attente de l'accès créé par le serveur. Tests Jest.
- Écran Offres (E1) sur iOS : bouton « Prendre le pass … · prix Apple », « Restaurer mes achats », messages de résultat. Actif seulement si `EXPO_PUBLIC_REVENUECAT_IOS_KEY` est défini ; sinon l'écran garde « Tu pourras bientôt choisir ton pass… ». Rien ne change pour Android.
- `eas.json` : profils iOS et `submit.ios` (identifiants à renseigner).
- Dépendance `react-native-purchases`.

À valider par Benny : l'écran Offres iOS est une variante de E1 sans maquette (le guide la prévoit, ligne « variante achat intégré »). Même mise en page qu'aujourd'hui, un bouton et un lien texte en plus.

## 3. Reste à faire

### Par Benny (comptes et consoles)
1. Compte Apple Developer (99 USD par an), App Store Connect : créer l'app, bundle `com.ezadrive.elearn`, nom, catégorie Éducation.
2. Produits d'achat intégré : trois « abonnements sans renouvellement » `pass_week`, `pass_month`, `pass_contest`, avec grille de prix Apple (le prix en FCFA n'existe pas : Apple impose ses paliers).
3. Clé App Store Connect (API) pour EAS et pour RevenueCat.
4. RevenueCat : projet, app iOS, offre « default » avec packages `week`, `month`, `contest`, droit « pass ». Clé publique iOS dans EAS : `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. Secret du webhook.
5. `eas credentials` (iOS), puis renseigner `ascAppId` et `appleTeamId` dans `eas.json`.
6. Sign in with Apple : identifiant de service et clé dans Supabase (Authentication > Apple).
7. Fiche : textes, captures iPhone 6,9 pouces, URL de confidentialité et de support, questionnaire de confidentialité, classification d'âge, compte de démonstration.

### Backend (`elearn-supabase`, une PR, pgTAP avant push)
- Edge Function `revenuecat-webhook` : authentification par en-tête secret, idempotence par identifiant de transaction, création de l'accès (comme `record_deposit_result`) pour `INITIAL_PURCHASE` et `NON_RENEWING_PURCHASE`, gestion des remboursements (`CANCELLATION`). `app_user_id` = identifiant Supabase.
- Source de l'accès : `apple`. Durées lues dans `pass_products`, jamais en dur.
- Suppression de compte : appeler la révocation du jeton Apple (exigence Apple pour Sign in with Apple).
- Tests : pgTAP pour la base, Deno pour la fonction.

### Site (`elearn-site`)
- Pages légales et `/supprimer-mon-compte` à jour (Apple y renvoie).
- Si on veut les liens `https://app.elearnprepa.com/...` ouverts dans l'app iOS : fichier `apple-app-site-association` et `ios.associatedDomains` dans `app.json`.

### App
- Build de test : `eas build -p ios --profile preview`, TestFlight, achats Sandbox de bout en bout.
- Workflow GitHub Actions iOS (comme `eas-preview.yml`) une fois les identifiants posés.
- Revérifier à la main sur iPhone : aucun FCFA, Mobile Money, pawaPay, « payer » ni lien parent ; aucun mot « Android » ; Apple partout où Google est proposé.
- Relire les notes pour Apple (relecture) : où trouver les achats, compte de démo.

## 4. Retour arrière
Sans clé RevenueCat, l'app iOS retombe sur l'ancien comportement (pass présentés sans achat). Aucune migration n'est poussée par cette branche.
