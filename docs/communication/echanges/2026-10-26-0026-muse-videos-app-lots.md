# Intégration des vidéos de cours dans l'app élève — lots 1 à 4

- Date : 26 octobre 2026
- Auteur : Muse
- État : fait (lots 1, 1bis, 2, 3, 4 livrés et poussés sur kw792g le 26/10/2026 ; CI verte sur chaque lot)
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

## Livraison (26/10/2026)

- Lot 1 — commit kw792g `fe5d30e` (CI verte). Correctif inclus au lot 2 : `course_videos.id` est un uuid, pas un entier.
- Lot 1bis (extension demandée par Benny à 00 h 49) — la « liste collée » devient le composant partagé `src/components/liste/ListeCollee.tsx` et s'applique aux pages Matière, S'entraîner (chapitres par matière), Annales (dossiers) et Entraînement d'un chapitre. Commit `dfa8441` (CI verte).
- Lot 2 — app : commit `b932e26` (CI verte) ; base : PR elearn-supabase #175 fusionnée, migration `20261026010000_video_progress.sql` déployée en production (run de déploiement vert sur main, `09bc8b5`).
- Lot 3 — commit `de03a7f` (CI verte).
- Lot 4 — commit `466bca3` (CI verte).

Choix notables : lecteur en 720p uniquement (forfaits limités, le 1080p viendra si besoin) ; route du lecteur dans le groupe (onglets) sans déclencheur pour garder header et barre d'onglets ; temps vidéo mesuré par segments de lecture réelle ; index des vidéos téléchargées traité comme un état (pas d'expiration), fichiers dans le dossier privé comme les documents.
