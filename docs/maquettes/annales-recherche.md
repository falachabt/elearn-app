# Annales : recherche, retour en haut et temps de travail par défaut (21 octobre 2026)

Demandes de Benny du 21 octobre. Ajustement de l'existant (parcours D3), aucun nouvel écran.

## 1. Barre de recherche de l'onglet Annales
- Elle remplace le titre « Ma classe » au-dessus de la liste des dossiers (élève) et des concours (candidat). Même barre dans « Autres concours » et dans la page d'un concours.
- Champ pleine largeur : bordure 2, rayon 10, fond surface, icône Lucide `Search` à gauche, croix `X` à droite dès qu'il y a du texte (cible de 48 px, vide le champ et garde le clavier). Placeholder « Rechercher dans les annales ». Clair et sombre via les tokens du thème.
- Filtrage en direct, sans accents ni majuscules, tous les mots doivent se retrouver : dossiers de la classe (nom), concours (nom, sigle) et sujets (titre, matière, année, école, concours). Les sujets trouvés apparaissent sous un titre « Sujets ».
- Aucun résultat : bannière d'information « Aucun résultat pour « mot » » + « Essaie un autre mot, une matière ou une année. ».
- Clavier : le champ est dans `Ecran` (KeyboardAvoidingView) et se rend visible au focus.
- Limite connue : la recherche porte sur ce que l'écran a chargé (dossiers de premier niveau, concours, sujets). Les documents d'un dossier se cherchent dans le dossier.

## 2. Dossier ouvert
- Même barre de recherche en haut de la liste : elle filtre les sous-dossiers et les documents du dossier.
- Bouton « Revenir en haut » (celui d'`Ecran`) : il apparaît dès un demi-écran de défilement dans un dossier (1,5 écran ailleurs), car les listes de documents sont longues.

## 3. Temps de travail par défaut
Feuille « Temps de travail » d'un ancien sujet : « Compte à rebours » est présélectionné avec 90 minutes (1 h 30) dans « Mon temps » quand le sujet n'a pas de durée conseillée (avec une durée conseillée, c'est elle qui est proposée). L'élève peut changer de mode ou de durée ; son dernier choix est mémorisé. Passer de « Mesurer mon temps » à « Compte à rebours » préremplit aussi 90.

## 4. Tests
Service (accents, mots multiples, champs), Annales (dossiers, concours, sujets, vide, croix), dossier (recherche, vide, croix), `Ecran` (seuil du retour en haut), temps par défaut (90 min, 5400 s).
