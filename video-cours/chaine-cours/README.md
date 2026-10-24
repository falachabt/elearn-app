# Chaîne vidéo de cours (Elearn Prépa)

La recette des vidéos de cours, telle qu'elle a été validée sur les suites numériques (cours 6290). Tout cours suit la même méthode : elle part des leçons en base, jamais du résumé ni de la description.

## La recette, en six étapes

1. **Lire les leçons en base.** `python lancer.py extraire <courseId>` lit `courses_content` (GET seulement), décode chaque leçon et écrit `sorties/<courseId>/lecons.txt` : le texte de chaque bloc, formules comprises. C'est le seul matériau du script.
2. **Rédiger le script** (`scripts/<courseId>.json`). C'est la seule étape faite à la main : une phrase parlée = un écran. Sélectionner l'essentiel de chaque leçon (définition, formules, méthode, un exemple chiffré résolu, récap), sans réciter. Viser 3 à 5 minutes, soit 20 à 35 phrases.
3. **Voix** : une génération OmniVoice par phrase, clonée sur `voix/ref-femme-4s.wav`, vitesse 0,92, 16 étapes de diffusion. Les clips déjà générés ne sont pas refaits (reprise).
4. **Chronologie** : pause de 0,7 à 1,1 s entre phrases selon la transition (`pause_apres`), chaque écran change 0,15 s avant la phrase qui le décrit, avec la durée mesurée du clip.
5. **Rendu** : Chromium capture un écran 16:9 par phrase (gabarit `gabarit/lecon-16x9.html`, design system), ffmpeg monte le MP4 (H.264, AAC, 1920×1080).
6. **Sorties** : `sorties/<courseId>/cours-<courseId>-16x9.mp4`, `voix.wav`, `sous-titres.vtt`.

## Une commande

```
python lancer.py <courseId>
```

Si les leçons n'ont pas encore été lues, la commande les lit. Si le script est absent, elle indique le fichier à rédiger et s'arrête. Le script est validé avant tout calcul (types d'écrans, identifiants, écrans référencés).

Pour lire les leçons, définir `CHAINE_SUPABASE_URL` et `CHAINE_SUPABASE_KEY` (clé publishable ou anon, lecture seule). La clé ne doit jamais être écrite dans un fichier.

## Règles d'écriture du script

- **Source** : les leçons (`lecons.txt`). Le résumé (`course_summaries`) est trop vague pour un cours ; la description du cours n'est pas une source.
- **Structure** : titre, introduction, définitions, formules clés, méthode étape par étape, au moins un exemple chiffré résolu, récap.
- **Une phrase, un écran.** Le texte parlé (`dit`) est écrit en toutes lettres : « u indice n », « dix puissance moins trois », « racine carrée de ». La ligne affichée (`texte`) peut garder les symboles (uₙ, ×, ≤).
- **Types d'écrans** : `titre`, `formule`, `etape`, `lignes`, `phrase`, `recap`. Un écran `formule` porte une formule ; `etape` et `lignes` listent plusieurs formules ; `phrase` ne porte que du texte ; `recap` liste des points.
- **Formules** : KaTeX uniquement. Pas de `\ce{...}` (mhchem n'est pas chargé) : écrire la formule chimique en `\mathrm{}` ou en texte. Pas de signe `!`, pas d'emoji, aucun emoji dans l'interface ni dans la vidéo.
- **Nombres** : décimales avec virgule dans le texte parlé (« zéro virgule cinq »).
- **Longueur** : une phrase dit au plus une idée. Une ligne de sous-titre tient en deux lignes ; le rendu signale tout texte qui déborde (« ATTENTION : texte qui déborde »), à corriger.
- **Sous-titres** : la bande jaune du gabarit affiche le `texte`. Aucune autre piste de sous-titres n'est ajoutée à la lecture (sinon deux sous-titres se superposent).

## Ce qui est automatique et ce qui ne l'est pas

| Étape | Automatique | Retouche humaine |
| --- | --- | --- |
| Lecture des leçons (GET) | oui | non |
| Validation du script | oui | corriger les erreurs signalées |
| Voix OmniVoice | oui (reprise) | écoute, prononciation des formules |
| Chronologie et sous-titres | oui | non |
| Rendu 16:9 et MP4 | oui | vérifier quelques images (débordement) |
| Choix des leçons et des formules | non | oui, c'est le script |

## Limites connues

- La voix n'est pas relue automatiquement : à écouter avant publication.
- Les formules sont lues par une table de règles (`dire_formule` dans `pipeline/mixte/chaine.py`) ; les formules complexes sont prononcées de façon maladroite. Les dites dans le script à la main, en français oral.
- Le calcul se fait en local (`/tmp/chaine-cours/<courseId>`) : le montage réseau ne gère ni les liens symboliques ni les fichiers lourds.
- Une génération de voix prend environ 7 fois la durée audio sur CPU (environ 15 minutes pour 3 min 40).

## Fichiers

- `lancer.py` : la chaîne.
- `gabarit/` : gabarit 16:9 et logo.
- `voix/ref-femme-4s.wav` : extrait de référence (4,5 s) de la voix validée.
- `scripts/<courseId>.json` : un script par cours. Exemples : `6290.json` (suites numériques), `7370.json` (acidité et basicité), `7367.json` (oscillations mécaniques).
- `sorties/<courseId>/` : leçons extraites (`lecons.txt`, `lecons/`), vidéo, voix, sous-titres.
