# Chip changeur de profil sur l'accueil TOEIC — implémentation

- Date : 25 octobre 2026, 18 h 53 UTC
- Auteur : Muse
- État : fait (commits locaux, push en attente du « Pousse » de Benny)
- Zones touchées : `src/components/certification/AccueilToeic.tsx`, `src/components/certification/ui.tsx`, `src/components/mission/Accueil.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts`, tests (`src/components/certification/__tests__/accueil.test.tsx`, `src/components/profil/__tests__/changement.test.tsx`).
- Prise : `echanges/2026-10-25-1831-claude-chip-accueil-certification-prise.md`.

## Ce qui change

- L'en-tête de l'accueil certification n'affiche plus le titre « Accueil » : à sa place, en haut à gauche, le même chip que les accueils élève et concours (`SelecteurClasse`), qui ouvre `/profil/changer` — la page s'ouvre sur la famille active, donc l'onglet Certification. La cloche et les crédits, à droite, ne bougent pas ; aucune autre carte de l'accueil n'est touchée (séance du jour, compte à rebours, score, mots, « Série interrompue »).
- `SelecteurClasse` sait rendre la famille certification : libellé = sigle court de l'examen lu dans le profil local, c'est-à-dire le code `exam` en capitales (« TOEIC », comme le libellé court `profilChoix.toeicTitre` déjà utilisé dans l'app ; le nom complet de `cert_exams`, « TOEIC Listening and Reading », reste celui des listes A2). Icône `Award`, le repli de `LogoToeic`. Libellé d'accessibilité dédié (`classe.selecteurCertificationA11y`, fr/en) : « Certification : TOEIC. Appuyer pour changer. »
- `AccueilToeic` lit le profil (`lireProfil`) et le relit à chaque retour sur l'onglet : après un changement d'examen dans `/profil/changer`, le chip se met à jour sans relancer l'app. Tant que le profil n'est pas lu, l'emplacement reste vide (jamais un libellé d'une autre famille).
- `EnteteToeic` (ui.tsx) reçoit une prop optionnelle `gauche` qui remplace le texte du titre quand elle est fournie ; les autres écrans qui l'utilisent (~35) sont inchangés.

## Tests et validation

- Nouveau test d'écran (N1) : le chip est présent avec le libellé « TOEIC » et le libellé d'accessibilité de certification, le titre « Accueil » a disparu de l'en-tête, et un appui sur le chip appelle `router.push('/profil/changer')`.
- Nouveau test unitaire : `libelleProfil` rend « TOEIC » pour un profil certification (avec ou sans `exam` explicite, repli sur l'examen actuel).
- `npm run valider` complet vert (exit 0) : typage, ESLint, Jest 233 suites / 2 574 tests, export Android Hermes. Repassé une seconde fois (`npm test`) : vert également.

## Captures de recette

`~/workspace/captures-accueil-chip/` (script `capturer-accueil-chip.js`, démo certification `EXPO_PUBLIC_CERT_DEMO=1`, état après diagnostic proche de la capture de Benny : plan à +100 jours, série interrompue partie 1 à 0/5) :

- `accueil-toeic-chip-390-clair.png` et `accueil-toeic-chip-390-sombre.png`, vérifiées visuellement : chip [Award « TOEIC » + chevron] en haut à gauche dans les deux thèmes, reste de l'écran identique à l'existant.
- Note de lecture : sur le web de démonstration, le bloc de droite de l'en-tête se pose juste après l'élément de gauche (déjà le cas avant ce chantier, cf. captures #121 où le titre « Accueil » jouxtait la pastille crédits) ; sur l'appareil, la rangée prend toute la largeur et la cloche et les crédits restent en haut à droite, comme sur la capture de Benny.
