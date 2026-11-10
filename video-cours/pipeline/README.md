# Pipeline vidéo de cours (Elearn Prépa)

Une leçon de la base -> script -> voix OmniVoice phrase par phrase -> MP4 clair et sombre 9:16, sous-titres, extrait réseaux, statut « à relire ».

## Étapes
1. `decode_lecon.py` : décode `content_compressed` (gzip + clés courtes, codec du back-office) ou lit un export déjà décodé.
2. `lecon_vers_script.py` : blocs -> phrases. Un écran par phrase (titre, étape, phrase, formule). La phrase parlée traduit le LaTeX en français oral.
3. `generer_voix.py` : une génération OmniVoice par phrase, durée mesurée. Reprise après arrêt.
4. `monter.py` : chronologie d'après les durées mesurées, gabarit HTML (design system), Chromium pour les images, ffmpeg pour le MP4. Sortie clair et sombre, VTT, extrait de 22 s.
5. `run.py` : mode lot. Chaque étape se saute si son fichier existe (reprise).

## Lancer
    python run.py lecons.json config.json

`lecons.json` : `[{"id": "7266", "source": "exports/7266.json", "titre": "...", "matiere": "..."}]`
`config.json` : format, voix (modèle de référence), vitesse, pauses, extrait.

## Formats
- Cours pour l'app et YouTube : 16:9 (1920x1080), gabarit `gabarits/lecon-16x9.html`. Fichiers `lecon-16x9-clair.mp4` et `lecon-16x9-sombre.mp4`.
- Extrait réseaux : 9:16 (1080x1920), gabarit `gabarits/lecon.html`, coupé à `extrait_reseaux.duree_s` (22 s par défaut). Fichier `extrait-reseaux-9x16.mp4`. Désactivable dans `config.json` (`format.reseaux.activee`).
- Réglages dans `config.json`, section `format`.

## Sorties (dossier `sorties/<id>/`)
- `script.json` : à relire et corriger avant rendu (texte parlé, formules).
- `lecon-16x9-clair.mp4`, `lecon-16x9-sombre.mp4`, `sous-titres.vtt`, `extrait-reseaux-9x16.mp4`.
- `manifest.json` : statut `a_relire`, durée, fichiers.
- Après relecture : changer le statut à la main ; rien n'est publié automatiquement.

## Limites connues
- Le passage LaTeX -> français oral est une table de règles simple : à relire pour chaque leçon.
- Les écrans sont des gabarits fixes (formule, étape, phrase, cas, récap) : pas d'animation (les cas dynamiques sont dans `../dynamique/`).
- Le ton reste celui du moteur vocal (pas d'emphase mot par mot).
- Voix : OmniVoice, licence tranchée côté Benny ; génération sur CPU (environ 7 fois la durée) ou GPU.
- Aucune écriture en base : le pipeline lit une leçon exportée, il ne publie rien.

## Tests
- `tests/fixture-blocs.json` et `tests/lecons-test.json` : leçon de test (fixture écrite pour le pipeline, pas un cours de la base).
