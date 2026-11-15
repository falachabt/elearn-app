# Retouches TOEIC de novembre 2026 : maquettes en image

Planches dans `toeic/maquettes-retouches/` (clair en haut, sombre en bas, 390 px). Chaque « Avant » est une capture réelle de l'app (Expo web, démo CERT_DEMO) ; chaque « Après » est cette même capture retouchée directement dans la page, avec les composants et les jetons du thème. Valeurs d'exemple (score 410 sur 800) pour montrer la barre.

1. Grilles de cartes (`01-grilles-choix-partie.png`, `01-grilles-cours-grammaire.png`) : maquette A, cartes avec écart, même hauteur, place du badge Conseillé réservée, plus d'espace interne, étiquette en haut à droite ; maquette B, cartes collées en un bloc avec séparateurs fins.
2. Réviser > Parcours (`02-parcours.png`) : plus de bandeau vert ni de phrase du plan de l'appareil ; « Aujourd'hui · date » en simple ligne discrète ; la frise domine ; une étape faite reste visible avec l'état Fait (coche).
3. Accueil TOEIC (`03-accueil-toeic.png`) : compteur gardé, texte sous le compteur et deux cartes du bas retirés, remplacés par le parcours du jour.
4. Moi (`04-moi-progression.png`) : un seul chiffre (score moyen), barre avec repères verticaux vers l'objectif, sans les trois petites cartes ni la phrase.
5. Barre du bas (`05-barre-du-bas.png`) : le bouton Tests rendu comme les autres onglets, trophée gardé, état actif par la couleur.
6. Écran d'une partie (`06-partie-notions.png`) : icône et couleur de la partie sur chaque ligne, lignes collées.
7. Option correcte (`07-bonne-reponse.png`) : plus de libellé « Bonne réponse », coche dans la pastille vert foncé.

Synthèse : `synthese-retouches.png`. En attente de la validation de Benny ; rien n'est codé (§21 d'AGENTS.md).
