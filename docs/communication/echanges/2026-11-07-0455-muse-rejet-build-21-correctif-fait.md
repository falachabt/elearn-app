# Rejet App Store du build 21 (3.1.1) : correctif livré, build 22 envoyé — clôture

- Date : 7 novembre 2026, 04 h 55
- Auteur : Muse
- État : fait
- Suite de : `2026-11-07-0415-muse-rejet-build-21-restauration-311-prise.md`
- Commit distant : `d2d3d41` sur `claude/project-thread-kw792g` (poussé par l'API, la branche locale a une histoire reconstruite qui diverge de la distante, état préexistant).

## Correctif 3.1.1

Bouton « Restaurer mes achats » et flux `restorePurchases()` de RevenueCat retirés du binaire (`Offres.tsx`, `achatsIntegres.ts`, type `SdkAchats`, SDK simulé, test dédié, chaînes i18n fr/en). Achat, `logIn`/`logOut` RevenueCat et Android inchangés. Notre restauration propre est le compte Elearn : le droit vient du serveur (`my_access`), l'élève retrouve son pass en se reconnectant avec le même compte, sur n'importe quel appareil.

## Audit complet des consignes (demande de Benny : tout, pas seulement le motif)

Vérifié dans le code, la config et par `npx expo prebuild --platform ios` (Info.plist généré inspecté, puis dossier `ios/` supprimé) :

- 2.1 : manifeste de scènes présent dans l'Info.plist généré (correctif du build 21 intact).
- 2.5.4 : `UIBackgroundModes` = `remote-notification` seul ; `expo-audio` et `expo-video` sans lecture en arrière-plan ni picture-in-picture.
- 3.1.1 : prix iOS = prix Apple uniquement ; toutes les routes Mobile Money (`/offres/payer`, `/offres/parent`, `/offres/retour`, `/paiements`, `/paiements/[id]`) redirigent sur iOS via `paiementPossible()` ; aucun prix FCFA, aucun lien parent, aucun code promo visible sur iOS ; crédits jamais vendus contre de l'argent.
- 4.8 : Apple toujours proposé avec Google (et Facebook quand actif) — `appleAffiche = true`, y compris dans le parcours invité. Connexion e-mail coupée (`CONNEXION_EMAIL = false`).
- 5.1.1 : textes de permission caméra et photos présents, ni micro ni pistage déclarés ni utilisés ; suppression de compte dans l'app (demande en deux appuis, effacement serveur sous 30 jours, annulable) ; politique de confidentialité et CGU liées dans l'app ; support joignable (e-mail et FAQ).
- 5.1.2 : aucun SDK de pistage inter-apps (PostHog seul, analytique de l'app, désactivable, sans donnée personnelle) ; pas de fenêtre ATT requise.
- 5.2 : mention « TOEIC est une marque d'ETS. Elearn Prépa n'est pas affilié à ETS. » présente dans l'app (fr et en).
- 1.1/1.2 : aucun contenu publié par les élèves visible par d'autres dans l'app ; 4.2 : aucune WebView, interface native.
- Reste côté App Store Connect (non modifiable d'ici) : étiquettes de confidentialité à aligner sur les SDK (Supabase, RevenueCat, PostHog), captures et métadonnées, compte de démonstration, et côté backend la révocation du jeton Apple à la suppression de compte (à confirmer dans `elearn-supabase`).

## Tests

`npm run valider` dans un worktree propre au niveau du correctif : typage OK, lint OK, **234 suites / 2 611 tests, tous verts**, export Android + Hermes OK. La CI distante du commit (`Contrôles et EAS preview`) est aussi verte.

## Build 22 et envoi

- Workflow `ios-production.yml` déclenché manuellement (`etape=build-submit`), run **42334134876** : succès complet. EAS a incrémenté le build number **21 → 22** (source distante), build iOS production OK, `eas submit` OK : binaire téléversé sur App Store Connect (version 3.1.0).
- **Reste une étape manuelle dans App Store Connect** (interface web) : rattacher le build 22 à la version, répondre dans le Resolution Center (texte préparé : produits consommables, flux de restauration par le compte Apple retiré, restauration par le compte Elearn en se reconnectant) et cliquer « Submit for Review ». `eas submit` téléverse le binaire, il ne crée pas la soumission de revue.
