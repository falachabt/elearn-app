# Cahier des charges : profil TOEIC (Elearn Prepa)

Version 0.3 du 15 octobre 2026, à valider par Benny. Mise à jour : parcours d'arrivée décidé (Élève ou Concours, puis « Je prépare une certification », TOEIC en bas de liste, puis le contenu TOEIC), coût de la démo confirmé à 16 000 crédits, livraison visée en une semaine en version réduite (voir `planning.md`). Complète (ne remplace pas) le cahier de la PR elearn-app #43 (`docs/certifications/03-cahier-des-charges.md`, lots C0 à C3) en y ajoutant les idées de Benny du 15 octobre : notions étiquetées, carnet de mots, parcours personnalisé, section Cours. Les exigences CERT-1 à CERT-30 de la PR #43 restent valables ; ici on ne détaille que ce qui change ou s'ajoute (numérotées TOE-n).

Règles communes : pas d'emojis dans l'interface, aucun écran sans maquette, montants (crédits, limites, seuils) dans `credit_settings` / `credit_actions` / réglages serveur, tests pgTAP et Jest pour toute fonctionnalité, migrations additives via PR sur `elearn-supabase`, jamais Opus, pas de PR pour l'app (commit direct sur la branche de travail), un agent local à la fois.

## 1. Constat et positionnement

### Ce que fait une bonne préparation (état de la recherche)
La recherche web de ce jour donne des sources solides sur la structure du test, faibles sur les chiffres de performance : à lire comme des tendances, pas des preuves.
- Format Listening and Reading : 200 questions, 7 parties (6 / 25 / 39 / 30 puis 30 / 16 / 54), environ 2 h (45 min d'écoute, 75 min de lecture). Concordant entre les sources (IIBC, guide de l'INSA Lyon).
- Partie 5 : les questions se rangent en forme du mot (nature grammaticale), grammaire (temps, voix passive, relatives, conditionnel), prépositions et connecteurs, pronoms, sens du mot (vocabulaire). Chaque question teste donc une notion précise : ce que Benny a observé. Aucune source fiable ne donne de pourcentages par catégorie.
- Méthode la plus répétée : classer chaque erreur (mot inconnu, notion mal comprise, question mal lue, manque de temps) puis travailler d'abord le point faible diagnostiqué plutôt que tout répéter à égalité. Révision espacée pour le vocabulaire des affaires.

### Concurrents (d'après les fiches des stores, partiel et non vérifié par avis d'utilisateurs)
- Santa : prédit le score par IA et propose un programme ; vidéos de grammaire, vocabulaire, mini-tests gratuits. Marché asiatique, interface en anglais ou coréen.
- abceed : questions recommandées selon le score prédit ; contenu gratuit limité.
- Practice for TOEIC Test Pro : analyse des forces et faiblesses, hors ligne.
- ETS 토익기출 (livres officiels adaptés) : sujets officiels, analyse des points faibles.
- Applications génériques de sujets : des avis signalent des corrigés faux ou qui changent après envoi, ce qui détruit la confiance.
Ce qu'ils ratent pour notre public (déduction à vérifier par test d'usage) : aucune explication en français ni piège propre aux francophones (faux amis, ordre des mots), paiement par carte, audio lourd sans mode hors ligne soigné, peu de lien entre la faute et le cours qui la répare.

### Ce qui nous démarque
1. **Chaque question porte des notions** (grammaire, vocabulaire, piège) et des mots clés : la faute devient une donnée.
2. **Carte de maîtrise**, pas seulement un score : l'élève voit ses notions par parties, de « fragile » à « acquise ».
3. **Carnet de mots vivant** : mots connus, en cours, à revoir, alimenté par les réussites et les échecs, rappel espacé.
4. **Parcours personnalisé** : chaque jour, une séance construite avec ses fautes (notion faible, mots ratés, questions ratées à rejouer), pas une liste de tests à la suite.
5. **Cours par notion** reliés aux fautes : un bouton « Revoir la notion » depuis l'explication d'une erreur.
6. **« Pourquoi j'ai raté »** : l'élève classe sa faute en une touche (je ne connaissais pas le mot, la règle, j'ai mal lu, trop de temps) : cela nourrit le parcours et rend l'IA inutile pour l'essentiel.
7. Explications en français, pièges des francophones, hors ligne léger, Mobile Money, prix local.
8. Score estimé honnête (fourchette, jamais présenté comme officiel).

## 2. Périmètre : deux niveaux de livraison

- **Semaine 1** (version réduite, voir `planning.md` pour ce qui est coupé) puis **TOE-MVP** (premier livrable complet) : profil Certification, diagnostic, entraînement par partie avec explications, notions et fiches Cours, carnet de mots, parcours personnalisé du jour, score estimé. Pas de test blanc chronométré complet.
- **TOE-V2** : tests blancs complets et demi-tests, packs hors ligne, plan jusqu'à la date du test, rédaction et oral (lot C3 de la PR #43).
Raison : la valeur qui nous distingue (notions, mots, parcours) tient dans le MVP ; le test blanc complet est ce que tout le monde fait, et c'est le plus cher en hors ligne et en chrono.

## 3. Exigences

### 3.0 Arrivée (décision de Benny, 15 octobre)
- TOE-0 (M) Écran d'arrivée : choix Élève ou Candidat concours, puis un lien ou une carte « Je prépare une certification » ; la liste des certifications place **TOEIC en bas** ; après le choix, l'élève choisit le contenu TOEIC (diagnostic, parties, cours, carnet). Ajuste le parcours A (A1), ne le redessine pas. Valeur de profil additive (`certification`), liste des examens servie par le serveur.

### 3.1 Notions (TOE-1 à TOE-5)
- TOE-1 (M) Référentiel de notions servi par le serveur : code, famille (grammaire, vocabulaire, piège, stratégie), titre, parties concernées, ordre. Cible de départ : 50 à 70 notions (forme du mot, temps, passif, relatives, conditionnel, prépositions, connecteurs, pronoms, comparatifs, collocations, verbes à particule, vocabulaire par thème d'affaires, et par partie les pièges d'écoute : homophones, synonymes, « répétition qui piège »).
- TOE-2 (M) Chaque question a une notion principale et jusqu'à deux secondaires. *Réception* : 100 % des questions du MVP étiquetées, relues par échantillon (statut `reviewed`).
- TOE-3 (M) État de maîtrise par notion et par élève : calcul serveur ou local rejoué (réussites pondérées par récence), seuils (fragile, en progrès, acquise) dans les réglages serveur.
- TOE-4 (M) Carte de maîtrise : notions groupées par partie, avec état et nombre de questions faites.
- TOE-5 (S) Étiquette de « piège » (distracteur) sur l'option fausse la plus choisie, pour l'explication.

### 3.2 Cours par notion (TOE-6 à TOE-9)
- TOE-6 (M) Section « Cours » de l'onglet Réviser du profil Certification : liste des notions, groupées par famille et par partie.
- TOE-7 (M) Fiche d'une notion, courte (3 minutes) : la règle en une phrase, 2 à 3 exemples avec traduction, le piège TOEIC typique, les faux amis ou différences avec le français, puis 3 questions d'ancrage. Texte en base (comme les autres cours), LaTeX inutile.
- TOE-8 (M) Bouton « Revoir la notion » depuis l'explication d'une question ratée et depuis la carte de maîtrise.
- TOE-9 (M) Cours lisible hors ligne (les 10 notions les plus faibles de l'élève préchargées), passant par `lireLocalHorsLigne` (AGENTS.md §16 bis) avec test.

### 3.3 Carnet de mots (TOE-10 à TOE-15)
- TOE-10 (M) Lexique serveur : mot, classe grammaticale, définition courte en français et en anglais simple, exemple d'affaires, thème, niveau, audio facultatif. Cible de départ : 600 mots.
- TOE-11 (M) Chaque question de lecture et d'écoute référence les mots clés qu'elle teste (table de liaison).
- TOE-12 (M) État d'un mot par élève : nouveau, en cours (boîte 1 à 3), connu (boîte 4+), à revoir. Passage de boîte sur réussite d'une question ou d'une carte, retour en arrière sur échec. Délais de rappel réglables serveur.
- TOE-13 (M) Écran Carnet : trois listes (à revoir, en cours, connus), recherche, détail d'un mot avec ses questions ratées.
- TOE-14 (M) Séance de mots (5 minutes) : cartes à rappel espacé, réponse en une touche (je savais / je ne savais pas) ou mini-QCM, jouable hors ligne, résultat rejoué de façon idempotente (`client_uuid`).
- TOE-15 (S) Ajout manuel d'un mot au carnet depuis une explication ou un texte de lecture.

### 3.4 Parcours personnalisé (TOE-16 à TOE-21)
- TOE-16 (M) Après le diagnostic de 20 questions (CERT-6), l'app construit le **parcours** : objectif de score, date du test facultative, temps disponible par jour (10, 20, 30 minutes), puis séances quotidiennes.
- TOE-17 (M) Une séance du jour combine, selon le temps choisi : un point de cours (notion la plus faible non vue), des mots à revoir (carnet), des questions déjà ratées à rejouer (espacées), et une série dans une partie à renforcer. Règle de composition = réglages serveur, testée par pgTAP ou Jest.
- TOE-18 (M) La séance remplace la « mission du jour » du profil Certification (CERT-11) et nourrit la série de jours partagée.
- TOE-19 (M) Les questions ratées reviennent à J+1, J+3, J+7 jusqu'à deux réussites de suite.
- TOE-20 (M) L'élève voit pourquoi la séance est ce qu'elle est (« parce que tu as raté 4 questions sur les prépositions »).
- TOE-21 (S) Recalcul hebdomadaire et lien avec « Ma semaine » et le résumé parents WhatsApp.

### 3.5 Entraînement et explications (TOE-22 à TOE-25)
- TOE-22 (M) Entraînement par partie et par notion, séries de 10 (CERT-9), explication en français après chaque réponse, avec la notion nommée et le piège.
- TOE-23 (M) « Pourquoi j'ai raté » : après une mauvaise réponse, quatre choix en une touche (mot inconnu, règle pas claire, mal lu, trop vite ou trop lent). Facultatif. Alimente le parcours.
- TOE-24 (M) Les sept types d'écran d'exercice de l'étude (CERT-12), lecteur audio unique ou relisible (CERT-13).
- TOE-25 (S) Fiches de méthode par partie (CERT-14).

### 3.6 Tests et score (V2, rappel)
CERT-15 à CERT-20 de la PR #43 : tests blancs, chrono exact, packs hors ligne, bilan, plan de révision. À ajouter : le bilan d'un test blanc montre la carte de maîtrise mise à jour et les 3 notions qui ont coûté le plus de points.
Score estimé : règle de conversion à calibrer ; la démo utilise une règle linéaire approximative (5 + 4,9 par bonne réponse), à ne pas publier telle quelle. Toujours une fourchette.

### 3.7 Crédits et droits (proposition, valeurs au serveur)
Rappel des actions de la PR #43 : `cert_explanation`, `cert_mock_half`, `cert_mock_full`, corrigé complet. Ajouts proposés :
- Gratuits sans crédit (acquisition et rétention) : diagnostic, Cours, Carnet et séances de mots, rejouer ses erreurs.
- Limite quotidienne gratuite de séances du parcours (réglage `cert_daily_sessions_free`), au-delà : crédits ou pass.
- Explication d'une question : coût de `cert_explanation` ; incluse dans le pass.
Aucun montant dans l'app ni dans les tests. Le serveur vérifie le droit avant de servir une explication ou un corrigé payant (option A).

### 3.8 Mesure PostHog
En plus de CERT-28 : `cert_notion_opened`, `cert_why_missed` (raison), `cert_word_state_changed`, `cert_session_started/completed` (composition), `cert_mastery_viewed`. Un drapeau PostHog `cert_profile_enabled` ouvre le profil progressivement.

## 4. Modèle de données (conception, aucune migration encore)
S'ajoute aux tables `cert_*` de l'étude #43 (exams, parts, questions, items, passages, audio).
- `cert_notions(id, code, famille, titre, parts[], ordre, cours_md, statut)`
- `cert_question_notions(question_id, notion_id, role)` ; `cert_question_mots(question_id, mot_id)`
- `cert_mots(id, mot, pos, def_fr, def_en, exemple, theme, niveau, audio_path, statut)`
- `cert_user_notion(user_id, notion_id, vues, bonnes, mauvaises, derniere, etat)`
- `cert_user_mot(user_id, mot_id, boite, prochaine_revue, vues, bonnes, mauvaises)`
- `cert_user_question(user_id, question_id, derniere_reponse, ratee_le, prochaine_revue, raison)`
- `cert_user_plan(user_id, objectif, date_test, minutes_par_jour, cree_le)` ; `cert_sessions(id, user_id, client_uuid, composition jsonb, termine_le)`
Toutes les tables utilisateur : RLS dès la création, écritures par RPC idempotentes (`client_uuid`), tests pgTAP (isolation entre comptes). Réglages (seuils de maîtrise, délais de rappel, composition de séance) dans une table de réglages serveur, pas dans le code.

## 5. Génération de contenu (lot C0 élargi)
Voir `planning.md` pour le budget ElevenLabs. Principes :
- Contenu original (la démo de 200 questions est conservée et sert de socle) ; aucune question officielle ETS, aucun « brain dump ». Mention de non-affiliation.
- Chaîne : écriture par modèle de langage avec grille (notion visée, difficulté, piège), contrôle automatique (une seule bonne réponse, niveau, répartition), relecture humaine par échantillon, puis audio. On valide le script **avant** de générer l'audio (une régénération coûte des crédits).
- Étiquetage : un passage automatique assigne notions et mots aux 200 questions de la démo ; échantillon relu avant import.

## 6. Risques
- Étiquetage faux ou corrigés faux : c'est le risque de confiance n°1 (voir les avis des applications génériques). Relecture et contrôle automatique obligatoires, signalement d'erreur par l'élève.
- Complexité du parcours : commencer par des règles simples et lisibles avant tout algorithme.
- Audience à acquérir (étude #43 : aucune cohorte aujourd'hui). Atténuer par une version web gratuite de la démo (voir planning).
- Poids de l'audio et du hors ligne ; coût IA des modes rédaction et oral (V2).
- Droits : contenu original, donc levé ; la banque de sujets de Benny reste inutilisée tant que l'origine n'est pas écrite.
