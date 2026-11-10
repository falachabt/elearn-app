# Rejet App Store du build 18 (28/10/2026) — prise du chantier

- Date : 28 octobre 2026, 09 h 25 (Europe/Paris)
- Auteur : Muse (Nobu)
- Sujet : corrections demandées par App Review sur Elearn Prepa 3.1.0, build 18, et audit des autres motifs de refus possibles
- État : pris
- Zones touchées : `app.json` (plugins natifs iOS), `src/i18n/fr.ts` et `src/i18n/en.ts` (clés `photo.*` et `travail.photos*` uniquement), `src/__tests__/app-json.test.ts`, routes `src/app/paiements.tsx` et `src/app/paiements/[id].tsx` (garde iOS), `docs/app-store.md`, `docs/app-store-notes-relecture.md`. Aucune zone TOEIC, aucun écran redessiné (seuls des libellés de boutons changent, comme demandé par Apple).

## Verdict Apple du 28/10/2026 (revue sur iPad Air 11-inch M3, build 18)

1. **Guideline 5.1.1(iv), accès caméra** : remplacer le bouton « Allow » par « Continue » ou « Next » dans le message d'accès à la caméra.
2. **Guideline 2.5.4, audio en arrière-plan** : justifier l'usage avec un enregistrement d'écran, ou retirer « audio » de `UIBackgroundModes`.

## Causes trouvées (vérifiées dans le code et par un prebuild réel)

### Caméra : deux écrans, pas un seul

- `src/components/photo/Camera.tsx` : en anglais, titre « Allow the camera » et bouton « Allow » (clés `photo.permissionTitre`, `photo.autoriser`).
- `src/components/annales/travail/PhotosTravail.tsx` : bouton « Allow the camera » (clé `travail.photosAutoriser`).
- Les autres textes « Allow them in your phone settings » sont des explications qui renvoient aux réglages du téléphone, pas des boutons qui déclenchent la demande système : hors du motif cité.

### Audio : `app.json` est propre, ce sont les plugins qui réinjectent « audio »

`app.json` ne déclare que `remote-notification` dans `UIBackgroundModes`, et la note de relecture du build 18 affirmait à Apple que le mode audio avait été retiré. C'est faux dans le binaire généré, preuve par `npx expo prebuild --platform ios` sur une copie du dépôt : l'`Info.plist` généré contient `remote-notification` **et** `audio`. Deux plugins l'ajoutent :

- `expo-audio` : son option `enableBackgroundPlayback` vaut `true` **par défaut** quand elle n'est pas précisée ; `app.json` ne précisait que `microphonePermission: false`. Le plugin ajoute alors « audio » à `UIBackgroundModes`.
- `expo-video` : `supportsPictureInPicture: true` implique aussi l'ajout de « audio » (la lecture en incrustation exige le mode audio en arrière-plan).

Or l'app ne joue **jamais** en arrière-plan : `LecteurAudio.tsx` et `retours.ts` règlent `shouldPlayInBackground: false`, `expo-video` est déjà à `supportsBackgroundPlayback: false`, et aucun code ne démarre le picture-in-picture. Le bon correctif est donc le retrait, pas la justification par enregistrement d'écran.

## Correctifs appliqués

1. `app.json` : `expo-audio` reçoit `enableBackgroundPlayback: false` et `enableBackgroundRecording: false` ; `expo-video` passe à `supportsPictureInPicture: false`.
2. Libellés caméra : bouton « Continuer » / « Continue » sur les deux écrans (Photo et Photos des annales), titres reformulés sans vocabulaire d'autorisation.
3. Test de garde dans `src/__tests__/app-json.test.ts` : les réglages qui réinjecteraient « audio » font échouer le test.
4. Durcissement iOS au passage : les routes `/paiements` et `/paiements/[id]` (historique Mobile Money) reçoivent la même garde `paiementPossible()` que `/offres/payer`, `/offres/parent` et `/offres/retour` — leur entrée dans Moi était déjà masquée sur iOS, mais la route restait ouvrable.

## Audit des autres motifs possibles (état au 28/10/2026)

- **3.1.1 paiements externes sur iOS** : masquage en place et testé (`plateforme.ts`, `iosSansPaiement`) ; offres iOS branchées sur RevenueCat avec restauration des achats.
- **5.1.1(v) suppression de compte** : présente dans l'app, mais effacement différé (30 jours) ; la suppression immédiate existe côté serveur (`delete_my_account_immediately`) et n'est exposée qu'en dev/preview. Risque résiduel à connaître, décision produit pour Benny.
- **1.2 contenu d'élèves (questions/entraide)** : signalement présent (`FeuilleSignalement`) ; pas de blocage d'un utilisateur trouvé dans le code. Risque résiduel, non cité par Apple sur les builds 17 et 18.
- **4.8 connexion** : Apple proposé partout où Google l'est.
- Question ouverte côté App Store Connect : le statut exact des 3 achats intégrés (vérification en cours, lecture seule).
