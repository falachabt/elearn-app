# Cohérence des formats de tests — écarts cosmétiques I-2, I-3, I-5 : implémentation

- Date : 25 octobre 2026, 22 h 50 UTC
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/ReglageMini.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts`, `src/services/certification/demo/apiDemo.ts`, `src/services/certification/demo/reglages.json`, tests (`tests.test.tsx`, `choixPartie.test.tsx`, nouveau `demoTirages.test.ts`). Prise : `2026-10-25-2227-claude-coherence-minis-i2-i3-i5-prise.md`. Source : audit `2026-10-25-2224-claude-audit-coherence-formats-tests.md`.

## I-2 — ReglageMini annonce la longueur servie

- `longueurBaseServie = longueurMiniServie(partie, reglages)` (10 par défaut, 12 pour les parties 3, 4 et 6 depuis le réglage serveur `test_mini_length_by_part`) ; `longueurAnnoncee` = cette longueur au palier de base, le palier demandé sinon (20 ou mixte inchangés).
- Le cube du palier de base du sélecteur affiche la longueur servie (grand nombre et libellé d'accessibilité « 12 questions ») ; la ligne Temps calcule `dureeMiniMin(longueurAnnoncee)` → « 12 minutes pour 12 questions, chrono visible » pour P3/P4/P6.
- Le départ envoie toujours le palier **demandé** (10) à `lancerMini` : le serveur convertit et débite l'action du palier (`cert_mock_mini_ten`), coût inchangé. Le minuteur réel, déjà figé sur le servi, correspond maintenant à l'annonce.

## I-3 — textes en fourchette (fr + en)

- `certification.tests.listes.choixPartie.intro` : fr « Chaque mini-test porte sur une seule partie : 10 ou 12 questions selon la partie. » ; en « Each mini-test covers one part: 10 or 12 questions depending on the part. »
- `certification.monPlan.miniAide` : fr « 10 ou 12 questions selon la partie, correction à la fin » ; en « 10 or 12 questions depending on the part, correction at the end ».
- **Point connu, non modifié** : `credits.actions.cert_mock_mini_ten` (« Mini-test de 10 questions ») reste le nom du produit débité, assumé par la migration supabase #172 (ni le prix ni le nom du palier de base ne changent) ; signalé dans l'échange de prise, comme demandé par l'audit.

## I-5 — démo web alignée sur le serveur

- `demo/reglages.json` : ajout de `mini_mixed_counts` {1:2, 2:2, 3:3, 4:3, 5:2, 6:4, 7:4} (extrait de la migration, comme les autres réglages). La démo ne lit plus `diag_blueprint` (la ligne reste dans le fichier, miroir du réglage serveur).
- `demo/apiDemo.ts` : nouveau `planMixte` lu depuis ce réglage ; `comptesMixtes(total)` met le plan à l'échelle par la méthode du plus fort reste (patron de `cert_mixed_counts`) ; `tirerMixte(total)` tire chaque partie par groupes entiers puis complète par appoint en unités entières jusqu'au total (patron de `cert_draw_mixed`) — à 20, la répartition est exactement {2,2,3,3,2,4,4} ; à 10, le total est tenu sans représenter forcément les sept parties (limite serveur documentée par #171).
- Les tirages à la volée passent par groupes entiers : mini par partie (`demarrerMini`), séries par partie ou par notion et séries mixtes (`lireSerie`). `tirerGroupesEntiers` accepte un ensemble d'exclusions (appoint du mixte) ; l'extraction des unités est factorisée (`unitesDe`).
- `tirer` (troncature du dernier groupe) ne sert plus qu'aux tests fixes de la démo — dont la répartition consomme la banque entière de chaque partie, donc sans troncature en pratique — et aux ancrages des fiches de notion (3 questions d'exemple, hors périmètre de l'audit).

## Tests et validation

- Nouveaux : T2 partie 6 → sélecteur « 12 questions » actif + « 12 minutes pour 12 questions », et départ toujours au palier 10 (`fausse.appels.minis = [{ partie: 6, longueur: 10 }]`) ; T2 partie 2 → annonce 10/10 inchangée ; choix de partie → intro en fourchette (chaîne littérale épinglée) ; `demoTirages.test.ts` (6 tests) : mixte 20 à la répartition du plan et groupes entiers, mixte 10 au total tenu, minis P3/P6 à 12 en groupes entiers, série P6 à 8 groupes entiers, série mixte à 10.
- `npm run valider` complet vert : typage, ESLint, Jest **234 suites / 2 588 tests** (2 579 + 9), export Android Hermes.
- Captures Playwright (démo web, Chromium du cache) dans `~/workspace/captures-coherence-minis/` : écran de réglage, Partie 6 choisie — sélecteur « 12 » actif et « 12 minutes pour 12 questions, chrono visible », clair (`reglage-mini-partie6-390-clair.png`) et sombre (`reglage-mini-partie6-390-sombre.png`), vérifiées visuellement.

## Reste

- I-1 (remboursement des minis à 12, bloquante) : côté supabase, hors de ce chantier.
- I-4 (séries par partie sous le budget annoncé) : décision produit en attente.
- Commits locaux uniquement, aucun push : ces correctifs partiront dans un push ultérieur décidé par Benny.
