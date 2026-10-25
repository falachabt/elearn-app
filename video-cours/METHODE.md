# Vidéos de cours : de la leçon en base à la vidéo

Méthode validée sur les suites numériques (cours 6290), puis appliquée aux cours 7370 (acidité et basicité) et 7367 (oscillations mécaniques). Elle part des leçons enregistrées en base, jamais du résumé ni de la description du cours.

Dossiers :
- `chaine-cours/` : la chaîne (`lancer.py`), le gabarit 16:9, les scripts par cours, la voix de référence.
- `pipeline/` : décodage des leçons et règles de lecture des formules, repris tel quel.

## Étapes

1. **Lire les leçons en base.** `python chaine-cours/lancer.py extraire <courseId>` lit `courses_content` en lecture seule (requête GET), décode chaque leçon et écrit `sorties/<courseId>/lecons.txt`. Il faut `CHAINE_SUPABASE_URL` et `CHAINE_SUPABASE_KEY` (clé publishable ou anon). La clé n'est jamais écrite dans un fichier.
2. **Rédiger le script** `chaine-cours/scripts/<courseId>.json`. C'est la seule étape faite à la main. Une phrase parlée = un écran. Le script suit la structure : titre, introduction, définitions, formules, méthode, exemple chiffré résolu, récapitulatif. Environ 20 à 35 phrases ; la durée totale décide du nombre de parties (voir « Découpage en parties »). Le champ `dit` est écrit en toutes lettres (« u indice n », « dix puissance moins trois »). Le champ `texte` (bande jaune) garde les symboles.
3. **Voix.** Une génération OmniVoice par phrase, clonée sur `voix/ref-femme-4s.wav`, vitesse 0,92, 16 étapes. Les clips déjà générés sont réutilisés (reprise).
4. **Chronologie.** Pause de 0,7 à 1,2 s entre phrases, chaque écran change 0,15 s avant la phrase qui le décrit.
5. **Rendu.** Chromium capture l'écran 16:9 du gabarit. Un écran `anim` est capturé plusieurs fois par phrase (12 images par seconde), puis ffmpeg monte le MP4 (H.264, AAC, 1920×1080, 30 i/s).
6. **Sorties.** `sorties/<courseId>/cours-<courseId>-16x9.mp4`, `voix.wav`, `sous-titres.vtt` — ou, si le script déclare des parties, un MP4 et un VTT par partie (`cours-<courseId>-partie-<n>-16x9.mp4`, `sous-titres-partie-<n>.vtt`). La piste de sous-titres n'est pas ajoutée à la lecture : la bande jaune du gabarit suffit.
7. **Page à regarder.** La vidéo est publiée comme artefact (MP4 et une page HTML avec `<video controls>`). Pas de `<track>` : elle doublerait la bande jaune.

## Découpage en parties (décision de Benny, 25 octobre 2026)

Un cours ne sort pas forcément en une seule vidéo : selon sa durée **théorique estimée** (avant génération, à partir du script), il est découpé en parties nommées de façon cohérente — « Partie 1 », « Partie 2 », « Partie 3 » :

- **4 minutes ou moins → 1 partie** (pas de découpage).
- **Plus de 4 minutes → 2 parties.**
- **Plus de 7 minutes → 3 parties.**

Estimation de la durée : compter les caractères des champs `dit` et diviser par **17,65 caractères/seconde** (calibration mesurée sur le cours 5908 : 5 576 caractères pour 315,91 s de voix, voix de référence à vitesse 0,92). `lancer.py` affiche cette estimation et le nombre de parties attendu à la validation.

Règles de coupe :
- Couper aux **frontières naturelles** des notions (fin d'un chapitre, d'une méthode, d'un exemple complet) — jamais au milieu d'une notion ou d'un exemple. Exemple de Benny pour 5908 (5 min 20 → 2 parties) : la partie 1 s'arrête au prisme, les lentilles ouvrent la partie 2.
- Équilibrer les parties (durées voisines) à frontière comparable.
- Chaque partie est **autonome** : son écran-titre (« <Titre du cours> — Partie N » + sous-titre du bloc), sa barre de progression, sa clôture. Les parties 2+ ouvrent par une courte **phrase-pont** parlée qui situe le bloc (« Partie deux : les lentilles et les instruments d'optique. »).

Technique : le script déclare `"parties": [{"debut": "<id de la première phrase>", "sous_titre": "…", "pont": {"texte": "…", "dit": "…"}}]` (le `pont` ne concerne que les parties 2+). La chaîne génère les voix une seule fois pour tout le cours, puis monte et rend chaque partie séparément : `cours-<id>-partie-<n>-16x9.mp4` et `sous-titres-partie-<n>.vtt`. Sans champ `parties`, le comportement historique (une seule vidéo) s'applique. Certains cours auront plus tard, en plus, une vidéo **Exercices** (exemples traités pas à pas) — format à cadrer séparément.

## Écrans animés (type `anim`)

Un écran existant peut recevoir une animation sans changer son texte ni sa voix. Il suffit d'ajouter `"anim"` à sa définition dans le script :

```json
"loi": {"type": "formule", "kicker": "Loi fondamentale", "tex": "...", "anim": {"nom": "ressort"}}
```

Animations disponibles (`gabarit/lecon-16x9.html`, objet `ANIMS`) :
- `ressort` : masse et ressort horizontal. Options : `decal` (décalage de l'équilibre, pour le pendule vertical), `amorti` (oscillation amortie).
- `torsion` : pendule de torsion, un fil et une tige qui tourne.
- `ph` : échelle de pH avec un curseur qui glisse de `debut` à `cible`, et la valeur affichée.

Figures (schémas) disponibles (même objet `ANIMS`, registre `FIG` du gabarit) — les rayons se dessinent progressivement pendant les deux premières secondes de l'écran, puis la figure reste en place :
- `chambre` : chambre noire — objet, petit trou, image renversée sur la paroi opposée.
- `reflexion` : miroir plan — rayon incident, rayon réfléchi, normale, angles i et r.
- `refraction` : rayon qui se plie à la surface air-eau (angles θ₁ et θ₂) + verre d'eau avec la paille qui semble brisée.
- `prisme` : lumière blanche qui entre dans un prisme et ressort en spectre de couleurs.
- `lentilles` : convergente (rayons parallèles qui se rejoignent en F′) et divergente (rayons qui s'écartent, prolongements pointillés vers F′) côte à côte.
- `rayons` : construction complète — objet, lentille convergente, les trois rayons particuliers, image renversée. C'est la figure d'examen du chapitre.
- `oeil` : œil réduit — objet, cristallin, image formée sur la rétine.
- `fibre` : rayon qui zigzague dans une fibre par réflexions totales successives.
- Option `hauteur` (ex. `"anim": {"nom": "rayons", "hauteur": 175}`) : réduit la hauteur de la figure (260 px par défaut) pour les écrans déjà chargés, comme un récapitulatif en étapes.

Règles :
- Un écran animé doit tenir sous la bande jaune. La vérification de débordement (« texte qui déborde ») est lancée à l'écran animé, une fois la première image posée. Un débordement se règle en retirant l'animation de l'écran, pas en réduisant le texte validé.
- Une animation ne lit pas le texte : elle illustre l'objet dont on parle.
- **Visuel obligatoire (décision de Benny, 25 octobre 2026)** : une vidéo ne doit pas rester en pur texte. Chaque fois qu'une notion peut se montrer — un phénomène, un dispositif, un trajet de rayon, un montage — l'écran qui en parle reçoit une figure ou une animation, de préférence la figure type qui revient à l'examen, pour que l'élève puisse s'en rappeler visuellement. Si aucune figure du gabarit ne convient, en dessiner une nouvelle dans le registre `FIG` (SVG, encre du thème + couleurs Elearn) plutôt que laisser l'écran en texte seul.

## Production via GitHub Actions (depuis le 25 octobre 2026)

La génération peut tourner sur GitHub Actions plutôt que sur une machine locale : dépôt public, minutes gratuites, machines plus fortes et réseau propre (plus de téléchargement de modèle cassé par un proxy, plus de cache perdu au redémarrage). Workflow `.github/workflows/video-cours.yml`, lancement manuel (`workflow_dispatch`) avec l'identifiant du cours ; le script du cours doit être commité sur la branche choisie avant de lancer.

- Job `voix` : les phrases sont réparties entre 4 machines en parallèle (`lancer.py voix <cours> <partie> 4`) ; le modèle OmniVoice est mis en cache d'un run à l'autre (`actions/cache`), les clips partent en artefacts.
- Job `montage` : récupère les clips, relance `lancer.py <cours>` (la phase voix ne refait rien, les clips sont là), rend la vidéo, produit la 720p et une planche de contact ; le tout est publié en artefact `video-<cours>` (90 jours) sur la page du run.
- La clé publique Supabase vit dans le secret du dépôt `CHAINE_SUPABASE_KEY` (créé le 25 octobre 2026 par Muse, sur délégation explicite de Benny) ; l'URL du projet est en clair dans le workflow, elle est publique par conception.
- Dépendances épinglées : `chaine-cours/requirements-voix.txt` (torch CPU, OmniVoice) et `requirements-rendu.txt` (Playwright, SoundFile) — le job montage n'installe pas torch.
- Le dossier de travail se règle par `CHAINE_TRAVAIL` (défaut inchangé : `/tmp/chaine-cours`).
- Pièges CI rencontrés au premier test (25 octobre 2026) : `voix()` ne doit importer torch/OmniVoice que s'il manque des clips (le job montage tourne sans torch) ; **ffmpeg n'est pas dans l'image du runner**, le job montage l'installe par apt.

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

## Exemples validés (dans le dépôt)

Les trois cours validés sont dans `video-cours/exemples/`, en 720p pour rester légers (environ 3 à 4 Mo chacun) :
- `cours-6290-720p.mp4` : suites numériques
- `cours-7370-720p.mp4` : acidité et basicité (avec les formules corrigées)
- `cours-7367-720p.mp4` : oscillations mécaniques (avec les écrans animés)

`page-modele.html` est le modèle de page à regarder : la vidéo lue en ligne, sans piste de sous-titres, au ratio 16:9, avec les variables de couleur du design. Pour une nouvelle page, copier ce modèle à côté de la vidéo et remplacer le titre, la description et le nom du fichier.

Les versions 1080p de référence restent dans `sorties/` (non suivies par git) : elles se régénèrent avec `lancer.py`, et la version 720p est une compression de cette sortie (`ffmpeg -vf scale=1280:720 -c:v libx264 -crf 27 -c:a aac -b:a 96k`).
