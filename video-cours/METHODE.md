# Vidéos de cours : de la leçon en base à la vidéo

Méthode validée sur les suites numériques (cours 6290), puis appliquée aux cours 7370 (acidité et basicité) et 7367 (oscillations mécaniques). Elle part des leçons enregistrées en base, jamais du résumé ni de la description du cours.

Dossiers :
- `chaine-cours/` : la chaîne (`lancer.py`), le gabarit 16:9, les scripts par cours, la voix de référence.
- `pipeline/` : décodage des leçons et règles de lecture des formules, repris tel quel.

## Étapes

1. **Lire les leçons en base.** `python chaine-cours/lancer.py extraire <courseId>` lit `courses_content` en lecture seule (requête GET), décode chaque leçon et écrit `sorties/<courseId>/lecons.txt`. Il faut `CHAINE_SUPABASE_URL` et `CHAINE_SUPABASE_KEY` (clé publishable ou anon). La clé n'est jamais écrite dans un fichier.
2. **Rédiger le script** `chaine-cours/scripts/<courseId>.json`. C'est la seule étape faite à la main. Une phrase parlée = un écran. Le script suit la structure : titre, introduction, définitions, formules, méthode, exemple chiffré résolu, récapitulatif. Environ 20 à 35 phrases, soit 3 à 5 minutes. Le champ `dit` est écrit en toutes lettres (« u indice n », « dix puissance moins trois »). Le champ `texte` (bande jaune) garde les symboles.
3. **Voix.** Une génération OmniVoice par phrase, clonée sur `voix/ref-femme-4s.wav`, vitesse 0,92, 16 étapes. Les clips déjà générés sont réutilisés (reprise).
4. **Chronologie.** Pause de 0,7 à 1,2 s entre phrases, chaque écran change 0,15 s avant la phrase qui le décrit.
5. **Rendu.** Chromium capture l'écran 16:9 du gabarit. Un écran `anim` est capturé plusieurs fois par phrase (12 images par seconde), puis ffmpeg monte le MP4 (H.264, AAC, 1920×1080, 30 i/s).
6. **Sorties.** `sorties/<courseId>/cours-<courseId>-16x9.mp4`, `voix.wav`, `sous-titres.vtt`. La piste de sous-titres n'est pas ajoutée à la lecture : la bande jaune du gabarit suffit.
7. **Page à regarder.** La vidéo est publiée comme artefact (MP4 et une page HTML avec `<video controls>`). Pas de `<track>` : elle doublerait la bande jaune.

## Écrans animés (type `anim`)

Un écran existant peut recevoir une animation sans changer son texte ni sa voix. Il suffit d'ajouter `"anim"` à sa définition dans le script :

```json
"loi": {"type": "formule", "kicker": "Loi fondamentale", "tex": "...", "anim": {"nom": "ressort"}}
```

Animations disponibles (`gabarit/lecon-16x9.html`, objet `ANIMS`) :
- `ressort` : masse et ressort horizontal. Options : `decal` (décalage de l'équilibre, pour le pendule vertical), `amorti` (oscillation amortie).
- `torsion` : pendule de torsion, un fil et une tige qui tourne.
- `ph` : échelle de pH avec un curseur qui glisse de `debut` à `cible`, et la valeur affichée.

Règles :
- Un écran animé doit tenir sous la bande jaune. La vérification de débordement (« texte qui déborde ») est lancée à l'écran animé, une fois la première image posée. Un débordement se règle en retirant l'animation de l'écran, pas en réduisant le texte validé.
- Une animation ne lit pas le texte : elle illustre l'objet dont on parle.

## Automatique et manuel

| Étape | Automatique | Manuel |
| --- | --- | --- |
| Lecture des leçons | oui | non |
| Validation du script | oui | corriger les erreurs signalées |
| Voix OmniVoice | oui (reprise) | écouter, vérifier la prononciation des formules |
| Chronologie et sous-titres | oui | non |
| Rendu 16:9, MP4 et animations | oui | regarder quelques images (débordements, unités) |
| Choix des leçons, des formules, des animations | non | oui, c'est le script |

## Pièges rencontrés

- Le point médian `·` dans `\text{}` s'affiche en rouge avec KaTeX. Écrire les unités en `\text{N}\,\text{m}`.
- Une formule trop large déborde à droite sans être détectée : la découper ou la raccourcir.
- Un `\varphi` peut sortir de la carte si la ligne est trop longue : la passer sur deux lignes.
- Les liens symboliques ne passent pas sur le montage réseau : la chaîne travaille dans `/tmp/chaine-cours/<courseId>` et copie les modules.
- Une génération de voix prend environ 7 fois la durée audio sur CPU (environ 15 min pour 3 min 40).

## Limites

- La voix n'est pas relue automatiquement : à écouter avant publication.
- Le choix pédagogique (quelles formules, quels exemples, quelles animations) reste manuel.
- Le pipeline lit les formules par une table de règles (`dire_formule`). Les formules complexes sont dites à la main dans le script, en français oral.

## Environnement (pour installer sans deviner)

Ce qui est nécessaire, tel que lu dans `chaine-cours/lancer.py` et `pipeline/` :

| Élément | Où | Rôle |
| --- | --- | --- |
| Python 3.12 | système | exécute `lancer.py` et `pipeline/` |
| `omnivoice` (paquet Python du projet k2-fsa/OmniVoice) | pip | génération de la voix, importé dans `lancer.py` (fonction `voix`) |
| modèle `k2-fsa/OmniVoice` | téléchargé par le paquet au premier lancement (Hugging Face, réseau requis) | poids de la voix, chargés sur CPU (`device_map="cpu"`, `float32`) |
| `torch` | pip | moteur du modèle OmniVoice, CPU suffit |
| `soundfile` | pip | lecture et écriture des WAV (voix de référence, `voix.wav`) |
| `playwright` (paquet Python) | pip | pilote Chromium pour capturer les écrans |
| Chromium | par défaut `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` | rendu des écrans 16:9 ; sur une autre machine, indiquer le chemin dans `CHAINE_CHROME` (par exemple `~/.cache/ms-playwright/chromium-.../chrome-linux/chrome`) |
| `ffmpeg` et `ffprobe` | système | concaténation des images, encodage H.264 et AAC |
| `chaine-cours/gabarit/`, `chaine-cours/voix/ref-femme-4s.wav` | dépôt | gabarit 16:9, voix de référence |
| `pipeline/gabarits/ressources/node_modules/` | dépôt | KaTeX et polices Archivo Black et Space Grotesk, copiés dans le dossier de travail |
| `CHAINE_SUPABASE_URL`, `CHAINE_SUPABASE_KEY` | variables d'environnement | lecture seule des leçons (`extraire`) |
| `CHAINE_CHROME` (facultatif) | variable d'environnement | chemin de Chromium si différent du défaut |

Installation (à adapter à la machine) :

```
python3 -m pip install omnivoice soundfile torch playwright
python3 -m playwright install chromium   # seulement si Chromium n'est pas déjà présent
```

Ne pas lancer `playwright install` si `/opt/pw-browsers/` existe déjà : une autre version ne serait pas trouvée (règle de l'environnement cloud).

Versions : celles qui ont produit les vidéos validées n'ont pas été notées. Au premier lancement, noter `python3 -m pip freeze` dans `chaine-cours/sorties/ENVIRONNEMENT.txt` (dossier ignoré par git) et le joindre à la première vidéo produite.

Vérification sans voix ni réseau (à faire après chaque clone) :

```
cd video-cours/chaine-cours
python3 -c "import importlib.util,json; s=importlib.util.spec_from_file_location('l','lancer.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.valider(json.load(open('scripts/5942.json',encoding='utf-8'))) or 'OK')"
```

Le dossier de travail est `/tmp/chaine-cours/<courseId>` (Linux). Sur un autre système, le chemin `/tmp/chaine-cours` de la fonction `rendre` dans `lancer.py` est à adapter. Le montage réseau ne gère pas les liens symboliques : ne pas faire le travail dedans.
