# Chip changeur de profil sur l'accueil TOEIC — prise

- Date : 25 octobre 2026, 18 h 31 UTC
- Auteur : Muse
- État : pris
- Zones touchées : en-tête de l'accueil certification (`src/components/certification/AccueilToeic.tsx`, `src/components/certification/ui.tsx` — prop optionnelle de `EnteteToeic`), chip partagé (`src/components/mission/Accueil.tsx` — `SelecteurClasse`, `libelleProfil`), textes fr/en (`src/i18n/`), tests.

## Demande de Benny (25 octobre 2026, capture à l'appui)

Sur l'accueil TOEIC, le titre « Accueil » en haut à gauche doit être remplacé par le chip changeur de profil, comme sur les accueils Secondaire et Concours. C'est le point laissé hors périmètre de l'issue #125 (« pas de chip sur l'accueil TOEIC »), que Benny ouvre explicitement. Réassignation ponctuelle à Muse, comme les issues #79, #81, #121, #123 et #77 : le périmètre est strictement l'en-tête de l'accueil certification — aucun écran Tests, Réviser ou Statistiques, aucune autre carte de l'accueil (la carte « Reprendre / Série interrompue » ne bouge pas).

Pas de maquette préalable : le composant existe déjà sur les deux autres accueils, Benny demande sa réutilisation telle quelle ; la vérification visuelle se fait sur captures réelles après implémentation (clair et sombre), comme pour les chantiers précédents.

## Relevé de l'existant

- L'accueil élève et l'accueil concours sont le même écran (`src/components/mission/Accueil.tsx`, monté par `src/app/(onglets)/index.tsx` quand le profil n'est pas certification) : son en-tête pose `SelecteurClasse` en haut à gauche, avant la pastille série, les crédits, la cloche et l'avatar.
- `SelecteurClasse` : pastille bordée (fond surface, bordure forte, rayon s) avec icône (`GraduationCap` élève, `Trophy` concours), libellé court et `ChevronDown` ; un appui ouvre `/profil/changer` (page de l'issue #125, qui s'ouvre sur la famille active). Le libellé vient du profil local, sans réseau : `libelleProfil` donne la classe pour un élève (« Tle C ») et le sigle pour un concours (« ENS », « Médecine »).
- L'accueil certification (`AccueilToeic.tsx`) passe par `EnteteToeic` (ui.tsx) avec le titre texte `certification.accueilToeic.entete` (« Accueil ») à gauche et, à droite, la cloche puis les crédits — inchangés.
- Le profil certification (`Profil.type === 'certification'`) porte `exam`, le code de l'examen dans `cert_exams` (aujourd'hui `toeic`, seul examen). Le nom complet (« TOEIC Listening and Reading ») vient de `cert_exams` et sert aux listes (A2) ; le libellé court de l'app pour cet examen est « TOEIC » (`profilChoix.toeicTitre`, fr et en).

## Choix retenus

- Réutiliser `SelecteurClasse` tel quel, étendu à la famille certification : libellé = sigle court de l'examen, c'est-à-dire le code `exam` en capitales (« TOEIC »), lu dans le profil local — même source et même esprit que le sigle des concours, sans appel réseau ni nom complet trop long pour une pastille. Icône `Award`, le repli de `LogoToeic`, utilisée partout où le TOEIC apparaît sans logo officiel.
- Libellé d'accessibilité dédié (`classe.selecteurCertificationA11y`) : « Certification : TOEIC. Appuyer pour changer. »
- `EnteteToeic` reçoit une prop optionnelle `gauche` qui remplace le texte du titre quand elle est fournie ; les ~35 autres écrans qui l'utilisent ne changent pas.
- `AccueilToeic` lit le profil (`lireProfil`) et le relit à chaque retour sur l'onglet (retour de `/profil/changer`), comme `useProfilToeic` ; tant que le profil n'est pas lu, l'emplacement de gauche reste vide plutôt que d'afficher un libellé d'une autre famille.
