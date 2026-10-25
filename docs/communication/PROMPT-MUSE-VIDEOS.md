# Prompt pour Muse : génération des vidéos de cours et du contenu TOEIC

Document à donner en entier à Muse pour qu'il prenne en main la production des vidéos de cours. Ce document ne contient aucun secret : la clé de lecture de la base est fournie par Benny, en variable d'environnement, jamais dans un fichier.

---

## 1. Contexte

Benny veut une vidéo de cours (16:9, voix OmniVoice, design system Elearn Prépa) pour chaque cours de la base de données, produite par une chaîne reproductible. La méthode est validée : elle part des leçons en base, jamais du résumé ni de la description du cours. Le contenu déjà validé ne doit pas perdre de qualité en étant réécrit.

Benny a validé la méthode et les animations le 24 octobre 2026. Il veut que tu prennes la suite pour tous les cours. Lis d'abord `video-cours/METHODE.md` : c'est la référence complète, de la leçon à la vidéo.

## 2. Outils et où ça tourne

- **Chaîne** : dans `video-cours/` (dépôt `elearn-app`). `video-cours/chaine-cours/` contient `lancer.py`, le gabarit 16:9 (`gabarit/lecon-16x9.html`), les scripts par cours (`scripts/<courseId>.json`), la voix de référence (`voix/ref-femme-4s.wav`). `video-cours/pipeline/` contient le décodage des leçons et les règles de lecture des formules.
- **Branche** : la chaîne est aujourd'hui sur `claude/project-thread-epce3q`. Reprends-la sur `claude/project-thread-kw792g` (copie ou fusion, à valider avec Benny), puis travaille sur kw792g comme le protocole l'exige.
- **Voix** : OmniVoice, en local, sur CPU. Le modèle `k2-fsa/OmniVoice` se télécharge au premier lancement (réseau requis). Compter environ 7 fois la durée audio : une vidéo de 3 min 40 prend environ 15 min de génération de voix. Les clips déjà générés sont réutilisés (reprise).
- **Rendu** : Chromium (Playwright) à `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, puis ffmpeg (H.264, AAC, 1920×1080, 30 i/s).
- **Python** : paquets importés par `lancer.py` : `omnivoice`, `soundfile`, `torch`, `playwright`. Vérifie-les avant le premier lancement.
- **Machine** : la machine où tu lances la chaîne doit avoir Python, ffmpeg, Playwright avec Chromium, et le réseau pour la base et le modèle de voix. Benny a aussi un PC avec OmniVoice (fil « OmniVoice sur le PC de Benny ») : si ce PC est plus rapide, demande-lui avant de l'utiliser.

## 3. Accès à la base (lecture seule)

- Projet Supabase : `yhznbitjlzeslvudbsil`. Tables utiles : `courses` (colonnes `id`, `name`, `status`), `courses_content` (colonnes `"courseId"` et `content_compressed`, gzip et clés raccourcies).
- Variables d'environnement à définir dans le shell, sans les écrire dans un fichier ni dans un commit :
  - `CHAINE_SUPABASE_URL` : `https://yhznbitjlzeslvudbsil.supabase.co`
  - `CHAINE_SUPABASE_KEY` : la clé publishable que Benny te donne. Ne la copie dans aucun fichier, aucun commit, aucune page, aucun message.
- Tu ne fais que des lectures (GET). Ne modifie jamais la base depuis la chaîne.

## 4. Commande de la chaîne

```
cd video-cours/chaine-cours
python lancer.py extraire <courseId>     # lit les leçons, écrit sorties/<courseId>/lecons.txt
# étape manuelle : écrire scripts/<courseId>.json à partir de lecons.txt
python lancer.py <courseId>              # voix, chronologie, rendu, MP4, sous-titres
```

Sorties : `sorties/<courseId>/cours-<courseId>-16x9.mp4`, `voix.wav`, `sous-titres.vtt`, `lecons.txt`. Le dossier `sorties/` est ignoré par git : ne le committe jamais.

Lance une génération longue en arrière-plan avec un fichier journal (`nohup python lancer.py <id> > /tmp/chaine-<id>.log 2>&1 &`) et attends avec une boucle bornée. Le journal se termine par une ligne `vidéo ...`. Une ligne `ATTENTION : texte qui déborde` veut dire qu'un écran doit être corrigé.

## 5. Écrire le script (l'étape manuelle)

Le script est un JSON avec : `cours`, `lecons` (les identifiants de leçon lus), `titre`, `matiere` (par exemple « Chimie · Terminale », seulement si la leçon le dit), `phrases` (une par écran), `ecrans` (le dictionnaire des écrans).

- Source : les leçons (`lecons.txt`). Jamais le résumé, jamais la description du cours.
- Structure : titre, introduction, définitions, formules clés, méthode, un exemple chiffré résolu si la leçon en donne un, récapitulatif. Environ 20 à 35 phrases, 3 à 5 minutes. Ne récite pas la leçon : sélectionne l'essentiel.
- Une phrase = un écran. Le champ `dit` est le texte parlé, écrit en toutes lettres : « racine carrée de », « dix puissance moins trois », « zéro virgule cinq ». Le champ `texte` (bande jaune) garde les symboles.
- Types d'écrans : `titre`, `formule` (une formule), `etape` et `lignes` (plusieurs formules), `phrase` (texte seul), `recap` (liste de points).
- KaTeX uniquement. Pas de `\ce{}` (mhchem n'est pas chargé). Unités : `\text{N}\,\text{m}^{-1}`, jamais `\text{N·m}` (le point médian s'affiche en rouge).
- Pas de point d'exclamation, pas d'emoji, aucun emoji dans l'interface ni la vidéo.
- Une formule trop large déborde à droite : la raccourcir ou la couper en deux lignes. Un `\varphi` peut sortir de la carte : passer la ligne sur deux écrans ou deux lignes.

## 6. Règles de qualité validées par Benny

1. Textes courts : une phrase dit une seule idée. Pas de débordement (vérifie le journal et les images).
2. Sous-titres seulement dans la bande jaune du gabarit. Aucune autre piste de sous-titres dans la page ou la vidéo.
3. Même voix pour tous les cours : `voix/ref-femme-4s.wav`, vitesse 0,92, 16 étapes. Ne change pas ces réglages sans accord de Benny.
4. Le contenu vient des leçons en base. Ne réécris pas le texte d'un cours déjà validé (6290, 7370, 7367, 5942) sans accord de Benny.
5. Animations pour les cours visuels : ajouter `"anim"` à un écran existant, sans toucher au texte ni à la voix. Animations disponibles : `ressort` (options `decal`, `amorti`), `torsion`, `ph` (options `debut`, `cible`). Figures (schémas) disponibles, même mécanisme : `chambre`, `reflexion`, `refraction`, `prisme`, `lentilles`, `rayons`, `oeil`, `fibre` (option `hauteur` pour réduire la figure sur un écran chargé). Exemple : `"loi": {..., "anim": {"nom": "ressort"}}`. Un écran animé doit tenir sous la bande jaune : si la vérification signale un débordement, retire l'animation de cet écran plutôt que de réduire un texte validé.
9. **Visuel obligatoire (décision de Benny, 25 octobre 2026)** : pas de vidéo en pur texte. Toute notion qui peut se montrer (phénomène, dispositif, trajet de rayon, montage) reçoit une figure ou une animation sur l'écran qui en parle — de préférence la figure type qui revient à l'examen. Si le gabarit n'a pas la figure qu'il faut, la dessiner dans le registre `FIG` du gabarit (voir `video-cours/METHODE.md`, section « Écrans animés »).
6. Écouter la voix avant publication. Vérifier la prononciation des formules, qui est la faiblesse connue.
7. Vérifier quelques images : planche de contact (`ffmpeg -pattern_type glob ... tile=5x5`), en particulier les écrans de formules et les écrans animés.
8. Les nombres se lisent en toutes lettres dans `dit`, avec une virgule décimale.

## 7. Éviter les doublons

- Avant de commencer un cours, ajoute une ligne « Vidéo de cours <id> » dans `docs/communication/EN-COURS.md` (sur kw792g), avec la date et l'état. Un cours déjà présent dans cette table n'est pas repris par un autre agent.
- Cours déjà faits, ne pas les refaire : 6290 (suites numériques), 7370 (acidité et basicité), 7367 (oscillations mécaniques), 5942 (mélanges et corps purs, partiel : chapitres 1 à 3).
- Cours en attente de script : 5908 (optique, leçons extraites, script non écrit). À prendre avec accord de Benny, car il y a des formules et des animations à choisir.
- Le choix du cours suivant appartient à Benny. Liste les cours de la base avec `courses` et `courses_content` (lecture seule), et propose-lui une sélection par matière avant de lancer une série.

## 8. Où poser les vidéos

- Une page à regarder par cours, publiée comme artefact : un `index.html` avec `<video controls playsinline preload="metadata">` au ratio 16/9, la vidéo MP4 dans les fichiers de l'artefact, et une marge latérale responsive. Pas de `<track>` (il doublerait la bande jaune). Garde le même modèle que les pages de 6290, 7370, 7367 et 5942 (titre, matière, description courte).
- Note le lien de chaque page dans la ligne de suivi d'`EN-COURS.md`.
- Ne partage la page qu'avec les personnes que Benny désigne.

## 9. Garde-fous

- **Licence de la voix** : le modèle OmniVoice est sous licence CC-BY-NC. Un usage commercial n'est pas validé (issue #64, juriste). Ne publie aucune vidéo auprès des élèves sans décision écrite de Benny. Les pages artefact sont privées : elles restent des tests tant que Benny ne les a pas partagées.
- **Dépenses** : aucune dépense externe sans accord de Benny (pas de service payant, pas de crédits ElevenLabs pour ces vidéos). Dis-le avant tout coût.
- **Secrets** : aucune clé dans le dépôt, un commit, une page, une issue ou un message. Pas de `.env` suivi par git.
- **Git** : commit direct sur la branche de travail, `git pull` avant chaque push, jamais sur `main`. Pas d'identifiant de modèle dans les commits ni les documents.
- **Suppression** : ne supprime rien en base ni dans le dépôt sans accord de Benny.

## 10. Contenu TOEIC

Le document de passation de la production du contenu TOEIC est sur la branche `claude/project-thread-kw792g` de `elearn-app` : `docs/communication/production-contenu-toeic.md` (commit da92a08). Lis-le avant de toucher au contenu TOEIC. Il dit où vit le contenu (tables `cert_*` en base, bucket R2 `elearnprepa-public`), comment une question est rédigée, relue et publiée (migration dans `elearn-supabase`, une branche, une PR), comment l'audio est généré et contrôlé, et les règles de qualité.

Points à retenir pour toi :
- Accès : l'API ElevenLabs et l'écriture R2 ne sont pas disponibles aujourd'hui. Ne lance aucune génération audio et ne téléverse rien sans que Benny ait déclaré les accès dans l'environnement. Travaille sur les textes et les lots en attendant.
- Partie 2 des tests 2 et 3 : 50 clips sont trop courts (1,5 à 4,1 s). Ils se régénèrent avec le texte complet, l'ordre des options de l'audio, un débit naturel (réglage de vitesse 1,05 à 1,1, par l'API directe) et une durée minimale de 4 s. Le clip t2_p2_30 est prioritaire.
- Banque : environ 800 questions nouvelles (écoute et lecture) à rédiger par lots de 50, relues mot à mot contre leur transcription ou leur texte avant « prêt ». L'ordre des options suit toujours l'audio. Les voix variées sont gardées.
- Aucune écriture directe en base hors migration. Pas de suppression en production sans comptage et sauvegarde préalables. Une question pour Benny se pose une fois, avec le choix recommandé.
- Chaque lot se rapporte à Benny : nombre de questions, relecture faite, audios contrôlés, coût par rapport au budget, risques.

## 11. Premier lot proposé

1. Lire ce document et `video-cours/METHODE.md`.
2. Vérifier que la chaîne tourne sur un cours déjà fait (par exemple 5942) : la vidéo doit être identique à la version validée, au texte et à la voix près.
3. Demander à Benny la clé de lecture et la liste de matières à traiter.
4. Produire deux cours de plus, puis rapporter à Benny : automatique, retouché, temps de génération, problèmes.
