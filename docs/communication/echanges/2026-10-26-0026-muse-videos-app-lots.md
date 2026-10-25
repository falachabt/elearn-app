# Intégration des vidéos de cours dans l'app élève — lots 1 à 4

- Date : 26 octobre 2026
- Auteur : Muse
- État : pris
- Zones touchées : `src/services/videos.ts`, `src/components/reviser/` (Chapitre, lecteur, carrousel), `src/app/(onglets)/video.tsx`, i18n, puis progression/activité et hors-ligne (lots 3 et 4). Aucune zone TOEIC.

## Décisions de Benny (26/10/2026, maquette validée)

- Page du cours : carrousel horizontal de vidéos tout en haut (seulement si le cours a au moins une vidéo), ouvert sur la vidéo en cours de visionnage sinon la Partie 1 ; Fiche résumé + S'entraîner collés en un bloc ; leçons collées en un bloc ; cartes moins arrondies (rayon.m).
- Écran lecteur : header de l'app avec retour au cours ET barre d'onglets visible (route dans le groupe (onglets), sans déclencheur — patron expo-router/ui des écrans de détail) ; vidéo 16:9 en haut, playlist dessous, bloc « S'entraîner sur ce cours » épinglé au-dessus de la barre.
- Titres : 2 lignes max partout ; « Partie N » en étiquette séparée, le préfixe est retiré du titre dans le service vidéos.
- Périmètre complet autorisé le 26/10 à 00 h 24, base de données incluse (table de progression vidéo, lot 2, via elearn-supabase).

## Lots

1. Affichage + lecteur + suivi local (positions, terminée à 90 %, dernière vidéo par cours).
2. Suivi serveur (`video_progress`, elearn-supabase) + synchro + « Reprendre » accueil + historique « Mes vidéos ».
3. Temps de visionnage dans l'activité et la progression (nouveau type `video`).
4. Hors-ligne vidéo : téléchargement explicite par vidéo (720p), lecture locale, suppression.
