# Choix et changement de parcours — page dédiée par parcours et onglets de vue (note de conception, maquette)

**Auteur :** Muse (maquette uniquement, aucune implémentation)
**Date :** 25 octobre 2026, 12:19 UTC
**Suite de :** `2026-10-25-1204-claude-choix-changement-parcours-prise.md` (inventaire de l'existant)
**Support :** planche vivante `maquettes-a4-79/maquette-parcours-a4.html`, parcours « Choix et changement de parcours » (15 cadres par rangée, clair puis sombre), aperçu `maquette-parcours-choix-apercu.png` régénéré et vérifié visuellement dans les deux thèmes.

## 1. Décisions de Benny (25 octobre 2026)

1. **Depuis Moi, plus de feuilles du bas pour changer de profil.** La page « Mon profil » (P2, `/profil/choisir`) et sa liste des 3 parcours (3 lignes, badge « Actuel ») **ne changent pas**. Ce qui change, c'est la suite : **toucher un parcours mène à SA page, avec SA liste** — Secondaire → la page des classes, Concours → la page des concours, Certification → la page des certifications. Le choix concret et l'**adoption** (conséquences + confirmation) se font dans cette page ; rien ne bascule au seul toucher de la ligne. Les feuilles P4 (« Passer au profil TOEIC ? ») et P5 (« Revenir au secondaire ? ») disparaissent.
2. **Des onglets de parcours sur l'accueil.** Benny propose des tabs « Secondaire / Concours / Certification » sur l'accueil (le chip actuel ne permet de changer qu'entre Concours et Secondaire, et l'accueil TOEIC n'en a aucun — manques n° 1 et 2 de l'inventaire).
3. **Règle des onglets, après corrections successives** (une première version « onglet → toujours page dédiée » a été explicitement remplacée) : **les onglets sont un changement de VUE sur la même page** — on reste sur l'accueil, seuls les éléments proposés changent selon l'onglet. Ce n'est **pas** une bascule de profil : ni page dédiée, ni confirmation au toucher d'un onglet. La page dédiée reste le chemin du **changement de profil réel** (depuis Moi, et depuis l'appel à l'action d'adoption dans la vue d'un onglet).

## 2. Forme retenue pour la « page dédiée » : la page propre à chaque parcours

**Pas une page générique de confirmation** : chaque parcours a déjà sa page, et la maquette les réutilise telles quelles — c'est la forme la plus fidèle à l'existant, et la nouveauté se réduit à brancher la navigation.

| Destination touchée dans P2 | Page du parcours (cadre) | Liste portée par la page | Adoption |
|---|---|---|---|
| Secondaire | Classe en modification, variante élève (cadre 7) | Les classes, puis la série ; le pays | « Enregistrer » (planning recalculé, mission du jour invalidée) |
| Concours | `ChoixConcours` en 2 étapes (cadre 8), puis Classe en modification (cadre 9) | La filière, puis la liste des concours ; le pays ensuite | Choix écrit, puis « Enregistrer » |
| Certification | `/profil/certification` (`ChoisirCertification`) réactivé (cadres 10 à 12) | La ligne du seul examen (TOEIC) | « Passer au TOEIC », après le texte de conséquences, dans la même page |

- Secondaire ↔ Concours passait **déjà** par ces pages (aucune feuille) : le flux devient uniforme.
- La page Certification est la seule qui porte déjà, dans le code, les **conséquences + la confirmation en pleine page** : c'est le contenu de `FeuilleChangementProfil` rendu par `ChoisirCertification` **sans** `Feuille` ni voile (titre, texte de conséquences, ligne d'examen, bouton, « Annuler »), avec ses états **chargement** (« Changement de profil » / « Un instant, ton accueil se prépare. » / « Patiente un instant ») et **erreur** (« Changement impossible » / « Réessayer » / « Rester sur mon profil actuel ») repris tels quels, en états de page (cadres 11 et 12).
- Le retour depuis le TOEIC suit la même règle : toucher Secondaire ou Concours dans P2 mène aux pages des cadres 7 à 9. La feuille P5 et son étiquette figée « Revenir au secondaire » (fausse quand Concours est la destination) disparaissent ; chaque page porte ses propres libellés, qui suivent la destination.
- La bascule reste la permutation existante (`profil.memoire`, service `changementProfil`) : aucune donnée effacée, le profil quitté reste enregistré.

## 3. Textes de conséquences utilisés, par sens de bascule

Textes réels de `src/i18n/fr.ts`, repris verbatim dans la maquette :

- **Vers TOEIC** (clé `profilChoix.passerToeicTexte`, cadre 10) : « L'accueil, Réviser, Tests et Statistiques changent. Ton profil secondaire reste enregistré : tu pourras y revenir depuis Moi. » — titre `profilChoix.passerToeicTitre` « Passer au profil TOEIC ? », bouton « Passer au TOEIC ».
- **Départ du TOEIC** (clé `profilChoix.revenirTexte`) : « Le profil TOEIC reste enregistré. Tu pourras le retrouver depuis Moi. » — c'est le texte de conséquences du sens retour ; son emplacement proposé est la tête de la page du parcours touché (cadres 7 à 9), **non dessiné** (voir §6, point 4). Le libellé de la ligne de destination suit le choix réel : `profilChoix.revenirSecondaire` « Secondaire » / aide « De la 6e à la terminale », ou la ligne Concours — plus d'étiquette « secondaire » imposée.

## 4. Sort proposé pour l'écran orphelin `/profil/certification`

**Recommandation : le réactiver, ne pas le supprimer.** Il devient la page Certification du flux de changement de profil :

- le brancher depuis « Mon profil » (P2) quand la ligne Certification est choisie, et depuis l'appel à l'action de la vue Certification de l'accueil (cadre 15) ;
- il cesse d'être orphelin et résorbe le manque n° 3 de l'inventaire : son texte de conséquences est enfin affiché dans un flux réel ;
- à l'implémentation : sortir `FeuilleChangementProfil` de son usage en surimpression dans `ChoisirProfil` (le composant rend déjà une `Carte`, réutilisable comme contenu de page), et retirer les feuilles P4/P5. Aucune suppression d'écran.

## 5. Onglets de vue sur l'accueil (cadres 13 à 15)

- Même page, même en-tête, même barre d'onglets du bas : seuls les **éléments proposés** changent avec l'onglet consulté (mission du jour / annales / séance TOEIC, cartes d'action). L'en-tête (chip, pastilles, cloche, avatar) et le pied suivent le **profil actif**, pas la vue.
- Distinction vue / profil actif, dessinée avec le design system existant : l'**onglet plein** (fond encre en clair, fond papier en sombre, comme un `palier` actif) = la vue consultée ; un **point soleil** sur un onglet = le **profil actif** de l'élève. Dans les cadres 13 à 15, l'élève est Secondaire : le point reste sur « Secondaire » quand on consulte Concours ou Certification.
- Chaque vue d'un parcours qui n'est pas le profil actif porte une **carte d'adoption** (« Tu consultes le parcours Concours » / bouton vers sa page ; « Passer au profil TOEIC ») qui mène à la **page du parcours** — le même chemin que depuis Moi. Aucune bascule au toucher de l'onglet.
- Les trois cadres montrent l'accueil d'un élève Secondaire ; par symétrie, l'accueil d'un élève Concours ou TOEIC porterait les mêmes onglets, le point sur son profil — ce qui répond aussi au manque n° 1 (l'accueil TOEIC n'avait aucune entrée de bascule).

**Chip contre onglets — proposition claire, à valider par Benny :** le chip reste l'indicateur et le raccourci du **profil actif** (la classe ou le concours **dans la famille**, toucher → Classe en modification, cadre 9) ; les onglets changent de **famille en consultation**. Les deux ne se contredisent pas : le chip dit « où j'en suis », les onglets disent « ce que je regarde ». Alternative signalée : retirer le chip quand les onglets sont là (en-tête allégée), au prix de perdre le raccourci classe. La maquette dessine la proposition (chip conservé, inchangé dans les trois vues).

## 6. Points restés ouverts (dessinés au plus simple, à trancher par Benny)

1. **Profondeur des vues** : la vue d'un parcours non actif est dessinée en **aperçu + appel à l'action d'adoption** (forme la plus simple). Faut-il le contenu complet et utilisable du parcours, ou cet aperçu suffit-il ?
2. **Chemin d'adoption depuis une vue** : l'appel à l'action mène à la page du parcours (même page que depuis Moi). À confirmer que c'est le chemin voulu.
3. **Déclencheur depuis P2** : la page P2 est dessinée telle qu'aujourd'hui, pied « Continuer » compris ; la règle « toucher un parcours mène à sa page » peut se lire toucher de ligne direct ou sélection + « Continuer ». Mécanique exacte à préciser à l'implémentation.
4. **Conséquences au départ du TOEIC sur les pages Classe/Concours** : placement proposé en tête de page (texte `revenirTexte`), non dessiné ; les états chargement/erreur ne sont dessinés que sur la page Certification — sur les pages Classe/Concours, l'adoption passe par l'« Enregistrer » existant, dont les états propres sont hors périmètre ici.
5. **Vue par défaut** à l'ouverture de l'accueil : supposée être celle du profil actif ; non précisé.
6. **Page Certification unique ou deux écrans** : la maquette garde l'écran d'adoption distinct de la liste A2 de l'onboarding (qui porte le pays et l'encadré « D'autres certifications à venir. », issue #77). Fusion ou coexistence à confirmer si d'autres certifications arrivent.

## 7. Périmètre de cette mise à jour

- Planche : cadres 1 à 6 et 9 **inchangés** (dessins), légende du cadre 6 et références du cadre 9 mises à jour ; cadres 7, 8, 10, 11, 12, 13, 14, 15 nouveaux ou redessinés ; introduction, résumé et notes de bas de section mis à jour (sources, manques n° 3 et 4, nouveau point n° 6 sur les onglets) ; CSS ajoutée pour les onglets de vue (`.pc-tabs`, clair et sombre).
- Aucun code de l'app touché, aucune zone EN-COURS modifiée, **aucun commit** (fichiers laissés en place dans l'arbre de travail).
