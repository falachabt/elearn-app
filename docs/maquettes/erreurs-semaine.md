# Mes erreurs de la semaine (suite de « Ma semaine », 21 octobre 2026)

Demande de Benny : le bouton « Refaire mes erreurs » du rapport hebdomadaire ne menait nulle part d'utile (il rouvrait les erreurs du dernier quiz). Il doit montrer toutes les erreurs de la semaine et permettre de les refaire. Une entrée « Mon rapport hebdomadaire » est ajoutée dans Moi.

Ajustement de l'existant : aucun nouveau parcours, l'écran prolonge la carte 3 « À rattraper » de `ma-semaine.md` et reprend le quiz `MiniTest` de « Refaire mes erreurs ».

## 1. Entrées
- Carte 3 de Ma semaine, bouton « Refaire mes erreurs » : ouvre `/erreurs-semaine?semaine=AAAA-MM-JJ` (lundi de la semaine du rapport).
- Moi, groupe Progression / Documents / Parrainage : ligne « Mon rapport hebdomadaire » (icône Lucide CalendarDays, sous-titre « Revoir ta dernière semaine »), comptes connectés seulement. Ouvre Ma semaine (`source=inbox`), semaine précédente.

## 2. Écran « Mes erreurs de la semaine »
Conteneur `Ecran`, en-tête fixe : retour (chevron) + titre.
- Surtitre : « Semaine du 28 sept. au 4 oct. ».
- Titre h2 : « 12 erreurs à revoir » (« 1 erreur à revoir » au singulier).
- Une `Carte` par erreur (ombre dure 4, bordure 2) : ligne d'étiquette « Matière · Chapitre · jour », énoncé en texte fort, puis un encadré jaune doux « Bonne réponse : … » (le jaune désigne ce qui est à retenir).
- Pied fixe : un seul bouton vert « Refaire ces 12 erreurs » (« Refaire cette erreur » au singulier), icône RotateCw.
- Texte noir sur surface colorée, tokens du thème, clair et sombre.

## 3. Refaire
Le quiz `MiniTest` (mode mission : libellés « Terminer », « Fermer ») pose les erreurs, la plus récente d'abord. À la fin, retour à la liste : les erreurs réussies disparaissent, les autres restent, une bannière verte indique « N sur M corrigées ». La série, les XP de mission et les crédits ne bougent pas.

## 4. États
- Chargement : rien d'affiché le temps de la lecture locale (instantanée).
- Vide : « Aucune erreur enregistrée » + phrase qui explique que les erreurs d'avant cette mise à jour n'y sont pas, et, s'il existe un dernier quiz, bouton secondaire « Refaire les erreurs de mon dernier quiz » (ancien comportement).
- Hors ligne : identique, tout est local. Aucun appel serveur.
- Erreur de lecture : traitée comme vide.

## 5. Données
Journal local `erreurs.semaine` (AsyncStorage) : une entrée par question (identifiant de question), avec le jour de la première erreur. Alimenté à chaque `enregistrerCorrection` (mission, leçon, quiz libre, refaire) : une question ratée ou passée y entre, une question réussie en sort. Plafond de 150 entrées et 60 jours. Le serveur ne garde que des compteurs (`questions_ratees`), donc aucune migration. Limite connue : seules les erreurs faites après cette mise à jour sont listées, et un changement de téléphone repart de zéro.

## 6. Évènements PostHog
`week_errors_viewed { semaine, n }` à l'ouverture de la liste, `week_errors_retried { semaine, score, total }` en fin de quiz. `week_recap_cta` (`refaire_erreurs`) reste émis par la carte.

## 7. Tests
Service : entrée, sortie, jour d'origine conservé, bornes de semaine (lundi et dimanche inclus), expiration et plafond, journal illisible. Écran : liste de la semaine seulement, singulier et pluriel, refaire puis liste mise à jour, état vide avec et sans repli, clair et sombre. Moi : ligne présente pour un compte, absente pour l'invité, navigation.
