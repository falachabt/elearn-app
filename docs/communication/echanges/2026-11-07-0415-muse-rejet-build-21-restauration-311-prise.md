# Rejet App Store du build 21 (3.1.1) : retrait de la restauration via le compte Apple — prise

- Date : 7 novembre 2026, 04 h 15
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/pass/Offres.tsx`, `src/services/achatsIntegres.ts`, `src/services/__tests__/achatsIntegres.test.ts`, `src/i18n/fr.ts`, `src/i18n/en.ts`, `docs/app-store.md`. Hors TOEIC. La zone « écrans hors TOEIC (paiement) » d'`EN-COURS.md` est libre ; `EN-COURS.md` n'est pas modifié ici car il porte du travail non commité d'un autre agent.

## Contexte

Build 21 (3.1.0) refusé le 06/11/2026, motif unique **3.1.1** : le bouton « Restaurer mes achats » de l'écran des offres appelle `restorePurchases()` de RevenueCat, qui demande le compte Apple. Nos trois pass (`pass_weeks`, `pass_month`, `pass_contest`) sont des produits **consommables** chez Apple : la restauration via le compte Apple leur est interdite. Apple demande notre mécanisme propre si on veut une restauration.

Notre mécanisme propre existe déjà : le droit vient du serveur (`my_access`), RevenueCat est connecté au compte Elearn (`logIn`/`logOut`, identifiant Supabase). L'accès suit le compte, pas l'appareil : se reconnecter avec le même compte suffit, sur n'importe quel appareil.

## Fait ici

- Retrait du bouton « Restaurer mes achats » (iOS) et du flux `restaurerAchats` / `restorePurchases` (service, SDK simulé, type `SdkAchats`).
- Test « restaurer les achats » retiré ; chaînes i18n `offres.restaurer`, `offres.restaureOk`, `offres.restaureVide` retirées (fr et en, devenues sans usage — vérifié par grep).
- Achat, connexion/déconnexion des achats et Android (pawaPay) inchangés.
- `docs/app-store.md` mis à jour (rejet build 21 consigné, comme celui du build 18).
- Audit complet des consignes Apple applicables mené dans la foulée (voir l'échange de clôture) avant le build 22 et la resoumission, sur demande expresse de Benny.
