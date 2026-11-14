# Audio TOEIC (OmniVoice, GitHub Actions)

Génère les clips d'écoute TOEIC (parties 1 à 4) et les envoie sur R2, bucket `elearnprepa-public` (jamais `elearnprepa`).

**Règle : cette chaîne n'écrit jamais en base.** Les chemins audio sont posés par la migration de contenu.

## Fichiers
- `exporter_jobs.py <chemin elearn-supabase>` : relit le builder de contenu et réécrit `jobs/t4.json` à `t7.json` (transcription finale, après mélange des options) et `jobs/p2_t2_t3.json` (50 groupes de partie 2 à refaire, avec les deux textes corrigés, `t2_p2_30` en premier).
- `generer.py` : génération, assemblage, mp3 mono 64 kb/s, contrôle de durée, envoi R2, rapport JSON.
- `test_generer.py` : tests légers (`python -m unittest test_generer` dans ce dossier).

## Lancer
Essai (un seul groupe) :

    gh workflow run toeic-audio.yml --ref claude/project-thread-kw792g -f jobs=p2_t2_t3 -f essai=1

Tout le fichier : même commande sans `essai`. Entrées : `jobs` (p2_t2_t3, t4 à t7), `essai`, `forcer` (régénère même si présent), `etapes` (pas de diffusion, 16 par défaut).

## Vérifier
    curl -I https://pub-b05c9f45ef884ab2aa345a5763751590.r2.dev/toeic/t2/audio/t2_p2_30.mp3

Attendu : 200, `content-type: audio/mpeg`. Écouter le clip : voix de la question et des réponses différentes, lettres « A. », « B. », « C. » comprises, voix stable d'une réponse à l'autre. Le rapport (artefact `rapport-...`) donne durée, mots/s et statut (`ok`, `alerte` : débit hors cible, `echec` : partie 2 sous 6 s, rien n'est envoyé, `saute` : déjà présent, `erreur`).

## Reprise et coût
Un clip déjà sur R2 dont la durée (taille / 64 kb/s) est correcte est sauté : relancer suffit après un échec. Estimation indicative (8 s de CPU par seconde d'audio, à recaler après l'essai) : voir `python generer.py <jobs> --plan`. Un fichier au-delà de ~5 h estimées est coupé en tranches parallèles.
