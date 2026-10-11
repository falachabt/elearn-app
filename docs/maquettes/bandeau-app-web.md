# Bandeau « application » sur le web et PWA

Maquette : `docs/maquettes/bandeau-app-web.html` (prototype : appareil, thème, mobile ou large ; mêmes états en clair et en sombre). Aperçu : https://claude.ai/artifact/7jLqC6JJ3jExhZhUWatpos. Demande de Benny, 7 octobre 2026. Règles générales : `docs/design-regles.md`.

## Quand il s'affiche
- Web seulement (`Platform.OS === 'web'`). Jamais dans l'application, ni dans le PWA installé (`display-mode: standalone`, `navigator.standalone`).
- Android : un seul bouton, Google Play. iPhone et iPad : un seul bouton, App Store. Ordinateur : les deux.
- Un bouton n'apparaît que si son lien de magasin est configuré. Tant que l'app n'est pas sur l'App Store (issue #19), seul Google Play s'affiche. Les liens sont fournis par Benny.
- Jamais sur les écrans plein cadre : appareil photo, épreuve chronométrée, paiement (E1 à E6).
- Fermé, il ne revient pas avant 7 jours (même règle que la proposition de notifications). Mémorisé en local ; sans stockage, il s'affiche à chaque visite.
- Pas collant : il défile avec la page.

## Dessin
- Fond jaune soleil, texte noir dans les deux thèmes, bordure basse 2 px. Tokens : `accent.soleil`, `texte.surCouleur`.
- Texte : « Profite d'une meilleure expérience Elearn Prépa sur l'application » (14 px gras).
- Boutons blancs, bordure 2 px, ombre dure 3 px, 48 px de haut : icône du magasin, « Disponible sur » / « Télécharger sur », nom du magasin. Pas de bouton vert (le bandeau ne prend pas l'action verte de la page).
- Croix de fermeture de 48 px, libellé « Fermer le bandeau ».
- Mobile (moins de 600 px) : texte, puis boutons côte à côte, croix en haut à droite. Large : une ligne, texte à gauche, boutons puis croix à droite, icône `Smartphone` dans une pastille blanche.
- Icônes Lucide ; logos des magasins aux formats officiels. Aucun emoji.

## Comportements
- Un bouton ouvre le magasin dans un nouvel onglet, sans fermer le bandeau.
- La croix ferme sans confirmation, fondu court (coupé si « réduire les animations »).
- Ordre au clavier : texte, boutons, croix. Rôle `region`, libellé « Application Elearn Prépa ».
- Texte système jusqu'à 130 % : les boutons passent sous le texte, jamais de défilement latéral.

## PWA et barre d'état du navigateur
- Manifeste : `name` « Elearn Prépa », `short_name` « Elearn », `display: standalone`, `start_url: /`, `lang: fr`, icônes 192 et 512 px plus une maskable 512 px. `theme_color` et `background_color` : `#FFF7E3` (`fond.app` clair).
- Deux balises `meta name="theme-color"` : `media="(prefers-color-scheme: light)"` à `#FFF7E3`, `dark` à `#141614` (`fond.app` sombre).
- Quand l'élève change le thème (Clair / Sombre / Système), la balise `theme-color` est mise à jour sans recharger.
- iOS : `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style` à `default`, `apple-touch-icon` 180 px, `viewport-fit=cover` et marges `env(safe-area-inset-*)`.
- Dans Expo : section `web` d'`app.json` pour le manifeste, `app/+html.tsx` pour les balises.

## PostHog
`web_app_banner_shown` {plateforme: android | ios | bureau}, `web_app_banner_clicked` {magasin: play | appstore}, `web_app_banner_dismissed`.

## Tests
Affichage par plateforme et selon les liens configurés ; absent dans l'app, le PWA installé et les écrans plein cadre ; fermeture, retour après 7 jours, stockage indisponible ; clair et sombre, mobile et large, texte à 130 %, lecteur d'écran ; `theme-color` à jour après un changement de thème.
