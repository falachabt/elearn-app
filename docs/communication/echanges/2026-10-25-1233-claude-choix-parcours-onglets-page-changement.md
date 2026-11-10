# Choix et changement de parcours — correction : les onglets vivent dans la page de changement (note de conception, maquette)

**Auteur :** Muse (maquette uniquement, aucune implémentation)
**Date :** 25 octobre 2026, 12:33 UTC
**Suite de :** `2026-10-25-1204-claude-choix-changement-parcours-prise.md` (inventaire de l'existant) et `2026-10-25-1219-claude-choix-parcours-page-dediee-onglets.md` (page dédiée par parcours + onglets de vue) — **la présente note corrige le point « onglets » de la note 1219** ; le reste de la note 1219 (page dédiée depuis Moi, disparition des feuilles P4/P5, textes de conséquences, états en page) reste valable.
**Support :** planche vivante `maquettes-a4-79/maquette-parcours-a4.html`, parcours « Choix et changement de parcours » (18 cadres par rangée, clair puis sombre), aperçu `maquette-parcours-choix-apercu.png` régénéré et vérifié visuellement dans les deux thèmes.

## 1. La correction de Benny (définitive, 25 octobre 2026)

En relisant la maquette, Benny corrige l'emplacement des onglets : sur l'accueil, tout en haut à gauche, il y a déjà un bouton (le chip de classe, avec sa flèche) qui ouvre une page pour changer de classe — **c'est à l'intérieur de cette page-là que les onglets s'intègrent, pas sur la page d'accueil elle-même**.

Conséquences directes :

- **Aucun onglet sur l'accueil.** L'accueil et son chip restent inchangés. La version « onglets de vue sur l'accueil » (anciens cadres 13 à 15, note 1219 §5) est **abandonnée et retirée de la planche**.
- La page ouverte par le chip — aujourd'hui `/classe?modifier=1` (écran Classe en modification) — devient **la page dédiée unique de changement**, et c'est elle qui porte les 3 onglets.
- Le « point soleil » change de rôle : il ne marque plus un profil actif au milieu de vues d'accueil ; il marque **la famille actuelle de l'élève** sur les onglets de la page de changement.

## 2. Le modèle final dessiné (cadres 13 à 18)

**Cadre 13 — Accueil, le chip (inchangé).** L'accueil d'un élève Secondaire, tel qu'aujourd'hui : chip « Tle D » en haut à gauche, pastilles, cloche, avatar, mission du jour, barre du bas. Aucun onglet. Le chip ouvre la page de changement.

**La page de changement — page dédiée unique à 3 onglets** (Secondaire / Concours / Certification), en haut de page. On reste sur la même page ; toucher un onglet change le contenu affiché. À l'ouverture, l'onglet actif est celui de la **famille actuelle** de l'élève (marquée du point soleil).

- **Cadre 14 — Onglet Secondaire** : SA liste = l'écran Classe en modification actuel (classes, puis série, puis pays). Les pastilles « Je suis élève / Je prépare un concours » de cet écran sont remplacées par les onglets. **Changer dans sa famille** (autre classe, autre série) = le flux actuel : « Enregistrer » (planning recalculé, mission du jour invalidée).
- **Cadre 15 — Onglet Concours** : SA liste = `ChoixConcours` en 2 étapes (la filière, puis la liste des concours) — dessiné à l'étape 2, même écran qu'aux cadres 3 et 8.
- **Cadre 16 — Onglet Certification** : SA liste = celle de l'écran des certifications (cadre 4) : la ligne TOEIC, l'encadré « D'autres certifications à venir. » (issue #77) et le pays. « Continuer » reste inactif tant qu'aucune certification n'est touchée (règle de l'écran A2).
- **Cadre 17 — Adoption inter-familles, conséquences + confirmation dans la page** : toucher TOEIC dans l'onglet Certification fait apparaître, dans la même page, le bloc d'adoption — texte de conséquences réel (« L'accueil, Réviser, Tests et Statistiques changent. Ton profil secondaire reste enregistré : tu pourras y revenir depuis Moi. ») et bouton « Passer au TOEIC » ; « Annuler » referme le bloc, rien n'a changé. **Pas de bascule automatique au toucher de l'onglet.** Au départ du TOEIC, même mécanique avec le texte « Le profil TOEIC reste enregistré. Tu pourras le retrouver depuis Moi. » Les états chargement (« Changement de profil ») et erreur (« Changement impossible ») restent des états de page (cadres 11 et 12, inchangés).
- **Cadre 18 — Entrée depuis Moi, le bon onglet** : Moi → « Mon profil » (P2, cadre 6, inchangé) → toucher un parcours ouvre **cette même page, sur l'onglet correspondant** (dessiné : arrivée sur l'onglet Concours, concours coché, bloc de confirmation d'adoption). Depuis le chip, la page s'ouvre sur l'onglet de la famille actuelle ; depuis Moi, sur l'onglet du parcours touché. Une seule page, deux entrées.

Règles qui ne changent pas : la bascule reste la permutation existante (`changementProfil`, mémoire `profil.memoire`) — aucune donnée effacée, le profil quitté reste enregistré ; hors ligne, la feuille « Tu es hors ligne » bloque le changement (issue #74).

## 3. Sort de l'écran orphelin `/profil/certification` : absorption (recommandation)

Deux options étaient sur la table :

- **(a) Réactivation séparée** (recommandation de la note 1219) : brancher l'écran comme page Certification du flux, à côté des pages Classe et Concours.
- **(b) Absorption dans la page de changement** : le contenu de l'écran (liste, conséquences, confirmation, états) devient le contenu de l'**onglet Certification** de la page unique.

**Recommandation : (b) l'absorption.** Le modèle corrigé par Benny fait de la page de changement LA page unique du changement de parcours ; conserver à côté un écran Certification séparé recréerait un deuxième chemin pour la même action, avec le même contenu. L'onglet Certification a besoin exactement de ce que cet écran contient déjà (`ChoisirCertification` / `FeuilleChangementProfil`, qui rend déjà une `Carte` réutilisable comme contenu d'onglet) : l'orphelin est résorbé en devenant l'onglet, sans rien jeter de son contenu ni de ses textes. À l'implémentation : brancher le contenu dans l'onglet, et soit rediriger la route `/profil/certification` vers la page de changement (onglet Certification), soit la retirer si aucun lien ne la référence.

## 4. Ce que la correction change par rapport à la note 1219

- §5 de la note 1219 (onglets de vue sur les accueils, carte d'adoption dans les vues, partage chip/onglets) : **caduc**, remplacé par le §2 ci-dessus.
- Les manques n° 1 (aucun chip sur l'accueil TOEIC) et n° 2 (le chip ne mène pas à la certification) ne sont plus traités côté accueil : la certification devient atteignable par les onglets de la page de changement pour les élèves Secondaire et Concours (dont l'accueil a le chip). Pour un élève TOEIC, la page de changement reste atteignable par Moi → « Mon profil » (voir §5, point 1).
- Le reste de la note 1219 est inchangé : forme « la page propre à chaque parcours » (qui devient ici « le contenu propre à chaque onglet », dessiné avec les mêmes écrans), textes de conséquences par sens (§3 de la note 1219), états chargement/erreur en page.

## 5. Points restés ouverts (dessinés au plus simple, à trancher par Benny)

1. **Accueil TOEIC sans chip** : la page de changement n'y est atteignable que par Moi. Faut-il un point d'entrée sur l'accueil TOEIC (un chip équivalent) ? Non dessiné.
2. **Textes de conséquences hors TOEIC** : seuls les textes TOEIC existent dans le code (`profilChoix.passerToeicTexte`, `profilChoix.revenirTexte`). Le bloc du cadre 18 (Secondaire → Concours) est une **proposition de rédaction**, calquée sur le texte TOEIC ; il faudra une rédaction validée pour chaque sens de bascule inter-familles.
3. **Étape pays de l'adoption Concours** : aujourd'hui, après `ChoixConcours`, le pays se règle dans Classe en modification (cadre 9). Dans la page à onglets, placement à décider (dans l'onglet Concours après le choix, ou bascule vers l'onglet du nouveau parcours après confirmation). Non dessiné.
4. **Titre de la page de changement** : les écrans actuels n'ont pas de titre commun (retour seul, comme aux cadres 7 et 9) ; la maquette suit cette forme (retour + onglets, sans titre ajouté). À confirmer si un titre est voulu à l'implémentation.
5. **Déclencheur depuis P2** (point déjà ouvert dans la note 1219) : toucher de ligne direct ou sélection + « Continuer » — la page P2 est dessinée telle qu'aujourd'hui ; la mécanique exacte se précisera à l'implémentation, l'essentiel étant l'arrivée sur le bon onglet.

## 6. Périmètre de cette mise à jour

- Planche : cadres 1 à 12 **inchangés** ; cadre 13 redessiné (accueil sans onglets, légende corrigée) ; cadres 14 à 18 nouveaux ; anciens cadres 13 à 15 (vues d'accueil à onglets) **retirés** ; introduction, résumé et notes de sources de la section mis à jour.
- Aucun code de l'app touché, aucune zone EN-COURS modifiée, **aucun commit** (fichiers laissés en place dans l'arbre de travail, d'autres chantiers partageant le worktree).
