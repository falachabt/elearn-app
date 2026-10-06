# Règles de design pour Claude Code

Ce document reprend ce que faisaient les agents design d'Elearn Prepa, pour que Claude Code (en local, avec le connecteur Figma et les plugins design) propose lui-même les maquettes. Il ne répète pas le guide : il dit **comment travailler** et **ce qu'il ne faut pas refaire**.

Sources de vérité, dans cet ordre :
1. Figma « Elearn Prepa 2 · Design System & App » : https://www.figma.com/design/GzCvMxp4YpqafQufUJ6xI8 (8 parcours A à H, 48 écrans, clair et sombre).
2. Guide de design (consignes, tokens, aperçus HTML de tout ce qui a été ajouté après) : https://claude.ai/artifact/WJ2imvM8cRF4t4uuVL9geN. Copie : `Design system Elearn Prepa.md` dans ce dossier, ou `design/guide-design-system.html` dans les fichiers du projet Claude.
3. Tokens du code : `src/theme/` (modèle d'origine : `design/theme.ts`). Les écrans n'utilisent QUE `theme.color.*`, jamais la palette brute.
4. Specs écran par écran : `design/revue-ecrans-2026-10-01/specs.md` (fichiers du projet Claude).

## 1. Processus

- **Aucun écran ni composant sans maquette.** Si rien n'existe dans Figma ou le guide, on dessine d'abord (ou on demande à Benny), puis on code.
- **Ajuster l'existant, ne pas redessiner.** Cette règle vient de Benny (01/10) après des écrans refaits de zéro qui s'éloignaient de la vision. Avant de dessiner, retrouver le parcours Figma concerné et ne modifier que ce que le besoin change :
  - A : onboarding et compte (A1, A6 feuille « Sauvegarder »)
  - B : photo et IA (B1 appareil photo à B6)
  - C : accueil, mission du jour, série
  - D : Réviser, annales (D3), résultats (D6), lecteur PDF
  - E : offres et paiement Mobile Money (E1 à E6)
  - F : page parent ou tuteur sur le web
  - G : questions et entraide
  - H : profil, réglages, classes, classement (H1 Moi, H2 paramètres, H12 classement)
  - Exemple de bon ajustement : les crédits ajoutent une puce de coût sur un bouton, un solde sur l'accueil et le profil, « Demander à quelqu'un de payer » dans le parcours E. Ils n'ajoutent pas un second parcours de paiement.
- **Un écran commencé est fini avant d'en commencer un autre** : clair, sombre, états (chargement en squelette, vide, erreur, hors ligne, succès), textes.
- **Chaque écran porte ses états testables** : le dev en a besoin pour ses tests.
- Les chiffres de crédits (5 invité, 40 bienvenue, 25 par lundi, coûts 1 / 2 / 3 / 5 / 5, pass 500 / 2 500 / 7 500 FCFA) viennent de la configuration serveur : sur une maquette, ce sont des exemples, pas des valeurs à figer.
- Les décisions de design se prennent sans attendre Benny, puis se signalent. Seules les **dépenses** (passer Figma en Pro) et les **suppressions** (fichiers ou projets Figma) demandent son accord écrit.

## 2. Règles visuelles

- **Style** : néo-brutal doux. Bordure 2 px, ombre dure 4 px sans flou (3 px sur les cartes de liste), rayons 6 / 10 / 14. Sur Android, `elevation` floute : dessiner l'ombre par une vue décalée.
- **Pas d'emojis**, ni dans l'interface ni dans les maquettes. Icônes **Lucide**, trait 2, 18 à 20 px. Une icône qui désigne un type de contenu va dans une pastille de 34 px.
- **Tokens clair et sombre** : toute couleur vient de `theme.color`. Chaque écran est livré dans les deux thèmes. L'appareil photo et l'épreuve chronométrée restent sombres dans les deux.
- **Sens des couleurs** : vert = action et réussite, jaune = à retenir (corrigé), orange = attention (et exercice), corail = erreur, bleu = information (et quiz). Couleurs de matière pour les matières seulement. Une seule action verte par écran ; les autres boutons sont blancs ou en texte.
- **Texte noir sur toute surface colorée** (émeraude, jaune, matières). Jamais de blanc sur l'émeraude. Sur surface colorée, formules en noir ; le bleu `#1455C7` (clair) ou `#7FB0FF` (sombre) seulement sur carte blanche (le bleu `#1A75FF` sur émeraude ne fait que 1,65:1).
- **Contrastes AA** : ne pas inventer de nouveaux couples de couleurs, mesurer ceux qu'on ajoute. Cibles tactiles de 48 px minimum, espacées de 8 px. La couleur ne porte jamais seule une information (juste, faux, sélectionné). Texte qui suit la taille système jusqu'à 130 %. « Réduire les animations » coupe les glissements.
- **Cartes de liste** : hauteur fixe 78 px, texte centré, titre de 2 lignes au plus. Onglets segmentés : rayon 10 (conteneur) et 6 (segment). Titres de la base passés par `formatTitle`.
- **Formules** : LaTeX en base, rendues sans défilement latéral (retour à la ligne ou réduction, jamais de scroll horizontal).
- **Texte** : tutoiement pour l'élève, vouvoiement pour le parent. Espace insécable avant `?` `!` `:`. Pas de faux compte à rebours, pas de fausse progression, pas de culpabilisation.
- **Barres système** (status bar, navigation) colorées selon le thème. Clavier géré (`KeyboardAvoidingView` ou le composant `Ecran`). Retours sons et vibrations (M16) passés par le service unique, jamais jouer un son en direct dans un écran.

## 3. Écrans de référence à connaître

- **Crédits épuisés** : feuille du bas qui s'ouvre **sur la même page** (l'élève reste où il est), avec trois choix : **Recharger** (pass ou crédits), **Plus tard**, **Gagner** (page des actions pour gagner des crédits : visiter le site, Facebook…). L'invité voit en plus « Crée ton compte et reçois 40 crédits ». Demande de Benny du 06/10 ; voir K3, K3b, K3c, K3d du guide (§20).
- **Solde de crédits** visible sur l'accueil (avec cloche) et dans Moi ; bouton payant avec son coût (« Envoyer · 5 crédits »).
- **Écran de résultats commun** à tous les quiz : score, grille colorée des questions (vert juste, rouge faux, orange à revoir), boutons dans l'ordre « Refaire mes erreurs », « Revoir la correction », « Revoir les leçons ratées ».
- **Corrigé** : carte jaune doux (`theme.corrige`), pastille « Corrigé » jaune vif.
- **Parcours Photo (B)** : B1 appareil photo (reste sombre), B2 envoi, B6 feuille « Il te faut 5 crédits ».
- **Paiement (E)** : E1 offres, E2 Mobile Money (pawaPay), E3 validation, E6 lien parent ; « Demander à quelqu'un de payer » à chaque étape. Page parent F1 à F4 inchangée.
- **Profil (H)** : H1 Moi (avec ou sans pass, invité), H2 paramètres (Sons et vibrations H2b), H12 classement masqué par défaut.

## 4. Figma : limites et manière de travailler

- Plan **Starter** de Benny : 20 appels `use_figma` par mois, 3 pages par fichier, 1 mode de variable par collection. Le quota ne suit pas le 1er du mois civil (refusé les 01/10 à 00:20, 03:30 et 08:35 UTC) : vérifier avec un petit appel avant de planifier un gros lot, et grouper le travail en gros appels. `whoami` et `create_new_file` ne comptent pas.
- Quand le quota est atteint : maquetter en HTML dans le guide (nouvelle révision du même artifact, jamais un nouvel artifact), puis reporter dans Figma.
- Retouches Figma en attente : B1 appareil photo noir en sombre, E1 « 0 FCFA », espaces insécables parcours A et B, lien CGU et confidentialité sous « En continuant, tu acceptes… » (A1, A6). Un script est prêt : `design/figma-scripts/tache-1-retouches.js`.
- Le MCP Figma ne supprime pas de fichiers ; aucune suppression sans accord écrit de Benny. L'agent design du projet Claude surveille le Figma de temps en temps et signale les écarts entre Figma, guide et app.

## 5. Avant de livrer une maquette (ou de coder un écran)

1. Le parcours Figma d'origine a été retrouvé et ajusté, pas redessiné.
2. Clair et sombre, tous les états, aucun emoji, icônes Lucide.
3. Tokens du thème uniquement, contrastes AA, cibles de 48 px.
4. Textes en français, tutoiement, espaces insécables.
5. Le guide (ou Figma) est mis à jour, et ce document si une règle change.
