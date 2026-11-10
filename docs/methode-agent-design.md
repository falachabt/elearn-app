# Méthode de l'agent design

Mode d'emploi du travail de design sur Elearn Prepa, tel que l'agent design l'a pratiqué du 1er octobre au 22 octobre 2026. Il sert à celui qui reprend le travail : agent design, Muse, ou Claude en local. Benny apprécie ce travail ; on le garde.

## 1. Ce qu'on livre

Une maquette, c'est trois choses, toujours dans cet ordre de dépôt :

1. **Un aperçu HTML cliquable**, clair et sombre, au format téléphone (360 px et 390 px de large pour le profil TOEIC, cadre de 360 x 780 ou 360 x 800 selon l'écran). Il s'ouvre dans un navigateur, sans serveur.
2. **Une spec `.md`** du même nom, dans `docs/maquettes/`. Elle contient les écrans, leurs états, les textes exacts, les tokens, les conditions d'ouverture, la navigation, les données et les évènements d'analyse (PostHog). C'est elle que le dev suit.
3. **Une entrée au journal** : la maquette est citée dans le cahier du périmètre concerné (cahier TOEIC pour le profil TOEIC, cahier de référence pour le reste), avec son identifiant d'écran.

Une maquette n'est pas livrée tant que ces trois éléments ne sont pas en place.

## 2. Les sources de vérité, dans l'ordre

1. **Le cahier** du périmètre (`docs/cahiers/`). Il dit ce qui doit exister.
2. **Le guide de design** : https://claude.ai/artifact/WJ2imvM8cRF4t4uuVL9geN (aperçus de tout ce qui a été ajouté après, sur plusieurs révisions). Copie locale : `docs/Design system Elearn Prepa.md`.
3. **Figma**, « Elearn Prepa 2 · Design System & App », 8 parcours A à H (https://www.figma.com/design/GzCvMxp4YpqafQufUJ6xI8). Plan Starter : 20 appels `use_figma` par mois, 3 pages par fichier. Vérifier le quota avec un petit appel avant de planifier un gros lot. Le quota ne suit pas le 1er du mois civil.
4. **Les tokens du code** : `src/theme/` (modèle : `design/theme.ts`). Les écrans n'utilisent que `theme.color.*`.
5. **Les règles de travail** : `docs/design-regles.md`.

Quand la source est en conflit, on suit l'ordre ci-dessus et on signale l'écart à Benny.

## 3. Processus pas à pas

### 3.1 Avant de dessiner
- **Retrouver le parcours existant** (A à H, ou le parcours TOEIC). Ajuster ce qui change, ne pas refaire l'écran. Benny l'a demandé le 1er octobre après des écrans refaits de zéro qui s'éloignaient de la vision.
- Exemples de bon ajustement : une puce de coût sur un bouton, un solde sur l'accueil, « Demander à quelqu'un de payer » dans le parcours de paiement. Pas un second parcours de paiement.
- Lire le cahier du périmètre et la section qui concerne l'écran. Repérer les identifiants (par exemple `TOEIC-A1`) et les garder : ils ne sont jamais renommés.

### 3.2 Dessiner
- **Un écran commencé est fini avant d'en commencer un autre** : clair, sombre, tous les états, textes.
- **Un écran à la fois.** Le travail se propose dans l'ordre à Benny (un fil ou un message), il est validé écran par écran, puis on passe au suivant.
- Les décisions de design de détail se prennent sans attendre Benny, puis se signalent en une ligne. Exception : ce qui change le but du produit.
- Sens des couleurs : vert = action et réussite, jaune = à retenir (corrigé), orange = attention (et exercice), corail = erreur, bleu = information (et quiz). Une seule action verte par écran ; les autres boutons sont blancs ou en texte.
- Texte noir sur toute surface colorée. Jamais de blanc sur l'émeraude.
- Pas d'emojis. Icônes Lucide, trait 2, 18 à 20 px. Une icône qui désigne un type de contenu va dans une pastille de 34 px.
- Cibles tactiles de 48 px minimum, espacées de 8 px.
- Contrastes AA : ne pas inventer de nouveaux couples de couleurs sans les mesurer.
- La couleur ne porte jamais seule une information (juste, faux, sélectionné).
- Texte qui suit la taille système jusqu'à 130 %.
- Tutoiement pour l'élève, vouvoiement pour le parent. Espace insécable avant `?`, `!`, `:`.
- Pas de faux compte à rebours, pas de fausse progression, pas de culpabilisation.
- Formules : LaTeX en base, rendu sans défilement latéral.
- Style néo-brutal doux : bordure 2 px, ombre dure 4 px sans flou (3 px sur les cartes de liste), rayons 6 / 10 / 14. Sur Android, `elevation` floute : dessiner l'ombre par une vue décalée.
- Cartes de liste : hauteur fixe 78 px, texte centré, titre de deux lignes au plus.

### 3.3 Les états à dessiner (obligatoires)
- Clair **et** sombre.
- Chargement (squelette), vide, erreur, hors ligne (avec et sans copie locale), succès.
- Les états métier : crédits épuisés, Pass illimité, accès refusé, expiré, première fois.
- Pour un écran de quiz : état de fin commun (score, grille colorée, « Refaire mes erreurs » en premier).
- L'appareil photo et l'épreuve chronométrée restent sombres dans les deux thèmes.

### 3.4 Livrer
- Fichier HTML : une seule page autonome, sans dépendance réseau si possible.
- **Un lien d'artifact ne change pas.** Une nouvelle version est une nouvelle révision du même lien, jamais un nouvel artifact. Exemples : guide `WJ2imvM8cRF4t4uuVL9geN`, aperçus TOEIC `T8NEW4RyZ2G7FDzk5quHjU`.
- Numérotation : les maquettes TOEIC sont numérotées par version (`v1`, `v2`, ...). Le cahier TOEIC 1.35 cite jusqu'à la v33 et le dernier commit de maquette, `ccf5c89`, porte la mention v39 : la v39 fait foi pour l'état actuel. Chaque écran garde son identifiant (`TOEIC-V33-TESTS-SUIVI`), qui ne change pas d'une version à l'autre.
- Publier dans `docs/maquettes/` (`nom.html` et `nom.md`) sur la branche de travail, en commit direct (pas de PR, décision du 7 octobre).
- Prévenir Benny avec un aperçu (lien d'artifact) et la liste des points à trancher, en trois lignes au plus.
- Le dev ne code que ce qui est livré et reporté dans le cahier.

### 3.5 Quand Figma est épuisé
- Maquetter en HTML dans le guide (nouvelle révision du même artifact), puis reporter dans Figma quand le quota revient.
- Les retouches Figma en attente sont listées dans le fil du manager design (B1 appareil photo noir en sombre, E1 « 0 FCFA », espaces insécables des parcours A et B, lien CGU sous « En continuant, tu acceptes… »). Le script `design/figma-scripts/tache-1-retouches.js` est prêt.
- Le MCP Figma ne supprime rien. Aucune suppression sans accord écrit de Benny.

## 4. Exemples récents (à imiter)

- **Ma semaine** (7 octobre) : récap façon fin d'année, 4 cartes, une couleur par sens, ton encourageant (« Belle régularité », « Un bon début »), jamais de comparaison. Invité : pas de récap (les chiffres viennent du serveur). Carte à zéro : sautée. Spec : `docs/maquettes/ma-semaine.md`.
- **Code promo du Pass** (7 octobre) : saisie dès la liste des Pass, code repris sur le paiement, prix toujours calculé par le serveur, 14 états. Spec : `docs/maquettes/code-promo.md`.
- **Bandeau application web** : web seulement, jamais dans l'app ni dans la PWA installée, fermable (7 jours avant de revenir). Spec : `docs/maquettes/bandeau-app-web.md`.
- **Parcours d'arrivée TOEIC et revue complète** (15 octobre) : 43 écrans dans `docs/maquettes/toeic-revue-complete.md` et `.html`. Le parcours d'arrivée a été validé avant le reste : profil, puis certification, puis objectif et date.

## 5. Ce que le manager qualité vérifie

Le contrôle se fait contre la maquette, jamais contre une impression :
- Expo web en clair et en sombre, largeurs 360 et 390 px, captures Playwright.
- Chaque écran de la maquette est présent, avec ses états. Aucun écran ajouté sans maquette.
- Textes exacts, couleurs par sens, tokens, cibles de 48 px, pas d'emoji.
- Une ligne du tableau `toeic/revue-ecrans.md` ne passe à « oui » que si l'écran est vérifié.

## 6. Ce qu'un agent design ne fait pas

- Il ne dessine pas à grande échelle sans demande.
- Il ne code pas. Le code est confié au dev.
- Il ne touche pas à Figma sans demande et sans quota.
- Il ne supprime rien (fichier, projet, artifact).
- Il ne décide pas seul d'un changement de but du produit : il pose la question à Benny, avec une recommandation.

## 7. Passation

Quand un agent design s'arrête (contexte saturé), il écrit un fichier de passation dans `docs/communication/echanges/` : écrans livrés (identifiants et liens), écrans en cours, points à trancher, prochaine étape. Il met à jour `docs/communication/EN-COURS.md`.
