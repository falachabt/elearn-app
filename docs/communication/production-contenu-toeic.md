# Production du contenu TOEIC : mode d'emploi et état au 24 octobre 2026

Document de passation pour toute personne ou tout agent qui reprend la production du contenu TOEIC (questions, notions, mots, audios). Il dit comment le contenu est fait, validé, mis en base et sur R2, ce qui est fait, ce qui bloque, et les règles de qualité. Il ne contient ni secret, ni budget.

Sources à lire avec ce document : `docs/cahiers/cahier-des-charges-toeic-v1.35.md` (cahier de référence), `supabase/tests/certification/` et `docs/cert-demo.md` dans le dépôt `elearn-supabase`, et `docs/communication/PROMPT-MUSE.md`.

## 1. Où vit le contenu

Le contenu est en base Supabase (projet de production du dépôt `elearn-supabase`, schéma public, préfixe `cert_`). Les tables qui comptent :

- `cert_notions` : les notions (grammaire, vocabulaire, pièges, méthode). Colonnes utiles : `code` (minuscules, chiffres, underscore), `family`, `title`, `parts` (tableau d'entiers, par exemple `{6}`), `course_md` (fiche de cours), `status` (`draft` ou `reviewed`). Seules les fiches `reviewed` sont servies.
- `cert_questions` : une question par ligne. Colonnes utiles : `part` (1 à 7), `number`, `stem`, `options` (tableau JSON de 3 ou 4 textes, dans l'ordre de l'audio pour les parties d'écoute), `correct` (index de la bonne réponse, à partir de 0), `trap`, `explanation`, `main_notion_id` (notion principale), `group_id`, `status`.
- `cert_question_notions` : liens question vers notion, avec un rôle. C'est la voie prévue pour rattacher une question à plusieurs notions.
- `cert_groups` : les supports partagés par plusieurs questions. Pour l'écoute, `audio_path` (chemin R2), `image_path` pour la partie 1, `transcript` (JSON : une paire `[libellé, texte]` par ligne, la question puis les réponses A, B, C dans l'ordre audio). Pour la lecture, `passage`.
- `cert_words` : le vocabulaire (mot, définition, thème, `audio_path`).
- `cert_tests` et `cert_test_questions` : les tests (demi-tests, test complet, mini-tests) et leur ordre de questions.
- `credit_actions` : les coûts en crédits des actions de révision et de test. Les montants ne se codent jamais en dur.

Les fonctions d'application utiles à connaître : `cert_tests_list` (liste des tests relus), `cert_test_start` (démarrage d'un demi-test ou du test complet, débit des crédits, idempotent), `cert_notions_list`, `cert_words_list`, `cert_session_compose`.

## 2. Les médias : R2

- Bucket public : `elearnprepa-public`, servi par le domaine public `pub-b05c9f45ef884ab2aa345a5763751590.r2.dev`. Les chemins en base sont relatifs à ce domaine, sans hôte (par exemple `toeic/t2/audio/t2_p2_30.mp3`). L'application préfixe l'hôte avec la variable `EXPO_PUBLIC_CERT_MEDIA_BASE` (valeur par défaut dans `src/services/certification/media.ts`).
- Ne jamais utiliser le bucket `elearnprepa` : il contient les sauvegardes et les journaux.
- Arborescence : `toeic/audio/` pour le test de démonstration, `toeic/t2/audio/` et `toeic/t3/audio/` pour les tests 2 et 3, `toeic/img/` pour les images.
- Nommage : `t{n}_p{partie}_{numéro}.mp3`, où le numéro est celui de la première question du groupe. En partie 2, un groupe = une question, donc le numéro est celui de la question.
- Vérifier un fichier : code HTTP 200, `Content-Type: audio/mpeg`, `Accept-Ranges: bytes`, durée lue avec `ffprobe`, taille cohérente avec la durée. Une durée sous 4 secondes en partie 2 est suspecte (voir section 6).
- Le téléversement passe par le script documenté dans `docs/cert-demo.md` du dépôt `elearn-supabase` (identifiants injectés par l'environnement, jamais dans le dépôt).
- Pour une mise en ligne par l'API Cloudflare, il faut un jeton R2 en écriture déclaré dans l'environnement. Aucun jeton n'est écrit dans un fichier, un commit ou un message.

## 3. Génération audio

- Outil : ElevenLabs, modèle multilingue. Les voix sont variées par design et ce choix est à garder (voir les règles). Une voix se choisit dans la liste des voix de l'espace de travail, jamais de mémoire.
- Débit : le débit doit ressembler à un vrai TOEIC. Les audios régénérés en octobre ont parlé trop lentement ; le réglage de vitesse de l'API (`voice_settings.speed`, plage 0,7 à 1,2) est à utiliser, environ 1,05 à 1,1. Le réglage n'est pas exposé par l'outil de génération vocale disponible dans une session d'agent : il faut l'API directe, avec une clé déclarée dans l'environnement.
- Avant de lancer une série : un clip test, mesure de durée, comparaison de rythme avec un clip de démonstration, puis la série.
- Ne jamais relancer une génération pour « réessayer » : chaque appel est facturé. Une génération qui échoue se signale avant de recommencer.
- Coût et budget : le budget mensuel est celui de Benny. Il se vérifie avant toute série. Ne rien dépasser sans son accord écrit.

## 3 bis. Voie OmniVoice (décision du 23 octobre 2026)

- Jusqu'ici, les audios TOEIC (démo et tests 2 et 3) ont été générés avec ElevenLabs. Benny a décidé de passer l'audio TOEIC à OmniVoice, comme pour les vidéos de cours (dossier `video-cours/`, à reprendre depuis le fil vidéos, qui tient la chaîne exacte).
- Principe relayé : une phrase = un clip, avec une voix de référence commune à toute la série. Le volume demande un GPU : à lancer là où le GPU est disponible, pas dans une session d'agent sans GPU.
- Points à valider avant la mise en production commerciale : la licence OmniVoice est CC-BY-NC, incompatible avec un usage commercial sans accord. Un juriste doit la valider (issue #64) avant tout usage payant.
- Les règles de la section 3 restent valables : débit naturel, clip test avant série, contrôle de durée et de chemin R2, ordre des options respecté, voix variées gardées (à re-vérifier avec la voix de référence OmniVoice), et une durée minimale de 4 secondes en partie 2.
- Cette section décrit une décision relayée : la chaîne OmniVoice n'est pas encore décrite dans ce dépôt. Le fil vidéos est la source à jour.

## 4. Production des questions : la chaîne

1. Partir du cahier (v1.35) et de la notion visée. Une question vise une notion et une partie.
2. Rédiger : pour l'écoute, la transcription complète (question puis réponses A, B, C dans l'ordre où elles seront lues). Pour la lecture, le texte ou le passage et l'énoncé. Chaque question a une seule bonne réponse.
3. Distracteurs : les pièges grammaticaux faux sont voulus (accord sujet-verbe, temps, forme) ; un distracteur doit être plausible, pas absurde. Une réponse fausse qui n'a aucun rapport avec la question est un défaut à corriger.
4. Ordre des options : pour toute partie d'écoute, l'ordre des options affiché doit toujours suivre l'ordre lu dans l'audio. Ne jamais mélanger.
5. Relecture contre la transcription : chaque question est relue mot à mot contre sa transcription avant le statut `reviewed`.
6. Écriture en base : migration SQL dans `elearn-supabase` (voir section 5). Ne pas écrire directement en base en dehors d'une migration, sauf lecture.
7. Audio : génération (section 3), téléversement sur R2 (section 2), contrôle HTTP et durée, puis lien `audio_path` en base.
8. Vérification : pgTAP en CI, puis contrôle en production après déploiement.

Tags : il n'y a pas de colonne de tags libres. La banque réutilisable s'appuie sur `part`, `main_notion_id` et `cert_question_notions`. Le cahier v1.34 (décision D-49) ajoute la difficulté, une vue d'usage et le tirage de validation, côté développement.

## 5. Process de publication (obligatoire)

- Une branche, une PR, jamais de push sur `main` de `elearn-supabase`. Un push sur `main` déploie en production.
- Nom de migration : horodatage supérieur à la dernière version appliquée en production (`supabase_migrations.schema_migrations`). Une migration trop ancienne bloque toute la file de déploiement.
- Migrations additives. Ne jamais casser l'ancienne app ni le back-office.
- Tests pgTAP en local avant de pousser quand c'est possible (Docker), sinon le CI `pgtap` fait office de barrière. Le CI lance aussi `fonctions` (Edge Functions) et GitGuardian.
- Fusion : squash, uniquement au CI vert, sur le SHA de tête vérifié.
- Après fusion : vérifier en production (`schema_migrations`, `pg_proc` pour une fonction, et les lignes changées). Rapporter à Benny : quoi, pourquoi, tests passés, risque, retour arrière.
- Les modifications de texte seules (sans nouvelle structure) passent aussi par une migration de données idempotente, avec un `where` qui vérifie le texte d'origine.

## 6. Etat au 24 octobre 2026

Fait et vérifié en production :
- Les tests 2 et 3 : 6 questions en partie 1, 25 en partie 2, 39 en partie 3, 30 en partie 4, avec un audio par groupe (108 fichiers audio au total, tous présents, en 200, audio/mpeg).
- Notions de la partie 6 : trois fiches de pièges (`p6_temps_verbaux`, `p6_mots_de_liaison`, `p6_pronoms`), PR #148.
- Démarrage des demi-tests et du test complet (`cert_test_start`, PR #146), liste des tests (`cert_tests_list`, PR #147), score exact (PR #149), corrections de texte (PR #144, #145, #153).
- Textes corrigés en partie 2 : t2_p2_31 (réponse A) et t3_p2_29 (réponse A), PR #153. Leurs clips audio ne sont pas encore régénérés.

Problèmes ouverts :
- Partie 2 : les 50 clips audio des tests 2 et 3 durent entre 1,5 et 4,1 secondes. Une question plus trois réponses lues demande 6 à 10 secondes en TOEIC. Ces clips sont incomplets et doivent être régénérés, avec le texte complet, l'ordre des options respecté, un débit naturel, et une durée minimale de 4 secondes. Le clip t2_p2_30 est prioritaire (question 30 signalée par Benny).
- Le lecteur de l'application affiche « Audio indisponible » ou reste à 0:00 sur certains clips. Les fichiers R2 sont sains (200, audio/mpeg, durées correctes). La cause est côté client : le dev cherche. Pour la version web, il manque aussi une règle CORS sur le bucket pour l'origine de l'application ; elle n'est pas posée, elle attend l'accord de Benny.
- Côté application, à transmettre au dev : la page de transition entre la partie 1 et la partie 2 du demi-test n'apparaît pas ; la barre de progression avec le pourcentage manque sur les cartes de grammaire de la partie révisée.
- Accès : l'API ElevenLabs répond 401 quand on passe par le proxy de l'environnement, et aucun jeton R2 en écriture n'est déclaré. Sans ces deux accès, aucune génération audio et aucun téléversement ne sont possibles. Ils se déclarent dans les réglages de l'environnement cloud du projet, jamais dans un message.
- Banque : Benny a validé le lot de contenu pour les demi-tests multiples, soit environ 400 questions d'écoute et 400 de lecture en plus, réutilisables dans les demi-tests, les mini-tests, la validation de notions et le plan. Le travail se fait par lots de 50 questions d'écoute et 50 de lecture : partie 2 réparée puis parties 3 et 4 pour l'écoute, chaque lot relu contre sa transcription avant « prêt ». Aucune des 800 nouvelles questions n'est écrite à ce jour.
- Vérification de durée à appliquer aux parties 1, 3 et 4 : environ 2,5 mots par seconde de transcription ; un écart important signale un clip incomplet ou trop rapide.

## 7. Règles de qualité

- Aucun contenu en valeur figée dans le code ou les tests : les crédits viennent de `credit_actions`.
- Les voix variées sont gardées ; ne pas uniformiser.
- Pas d'emoji dans l'interface ni dans les issues et commits. Pas d'identifiant de modèle dans les commits, PR ou documents poussés.
- Aucun secret dans le dépôt, le chat, une PR ou une mémoire.
- Toute suppression en production (lignes en cascade incluses) se compte et se sauvegarde avant. Un incident de ce type a eu lieu le 21 octobre : des lignes liées ont été perdues en cascade et restaurées depuis la sauvegarde quotidienne.
- Une question pour Benny se pose une fois, avec le choix recommandé. Les dépenses hors budget, les suppressions en production et les migrations de production sont à lui d'abord ; le reste se tranche sur place, de façon réversible, et se signale après.

## 8. Premier travail pour une nouvelle reprise

1. Vérifier les accès (section 6) avant tout ; sans eux, travailler sur les textes et les lots, pas sur l'audio.
2. Régénérer les 50 clips de partie 2, en commençant par `t2_p2_30`, après le clip test.
3. Poser les vérifications de durée et de chemin, puis mettre à jour les liens `audio_path` si un chemin change (il ne doit pas changer).
4. Rédiger le lot suivant de 50 questions d'écoute (partie 3 puis partie 4) et de 50 questions de lecture, relues contre leur transcription ou leur texte.
5. Un rapport par lot à Benny : nombre de questions, relecture faite, audios contrôlés, coût en rapport avec le budget, risques.
