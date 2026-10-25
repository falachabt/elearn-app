# Issue #125 — Page de changement de parcours : implémentation

**De :** Muse · **Date :** 25 octobre 2026, 13:33 UTC · **Issue :** #125 « [Parcours] Page de changement unique à onglets (Secondaire / Concours / Certification) — fin des feuilles P4/P5 »
**Socle :** inventaire `2026-10-25-1204-claude-choix-changement-parcours-prise.md`, décisions `2026-10-25-1219-...` et modèle final `2026-10-25-1233-claude-choix-parcours-onglets-page-changement.md` ; parcours « Choix et changement de parcours » (18 cadres) de la planche vivante, validé par Benny le 25 octobre 2026.

## Livré

**Une page de changement unique** (`src/app/profil/changer.tsx` → `src/components/profil/PageChangementParcours.tsx`) : retour en haut à gauche, fil d'Ariane « Moi › Mon profil › {onglet} » quand on vient de Moi, et **3 onglets Secondaire / Concours / Certification**. On reste sur la page ; l'onglet ouvert par défaut est celui de la famille actuelle (ou celui demandé par le paramètre `onglet`) ; un **point soleil** marque la famille ACTIVE, distinct de l'onglet consulté (vérifié en captures : profil concours consultant l'onglet Secondaire, le point est sur Concours).

**Contenus des onglets**
- **Secondaire** : l'écran Classe en modification, extrait en `ChoixClasseContenu` (`src/components/ParcoursArrivee.tsx`) — mêmes classes, série, pays et garde hors ligne #74. Sans les pastilles de statut (remplacées par les onglets) ni le bouton retour interne (la page le porte).
- **Concours** : `ChoixConcours` en deux étapes, inchangé dans son flux ; dans la page, le bouton fermer laisse place à un retour texte « Retour aux filières » à l'étape 2.
- **Certification** : nouvel `OngletCertification` (liste des examens via `obtenirExamens`, badge « Actuel », pays persistant via `FeuillePays`, encadré « D'autres certifications à venir »). L'écran orphelin `/profil/certification` est **absorbé** : le composant `ChoisirCertification` est supprimé et la route **redirige** vers `/profil/changer?onglet=certification`.

**Entrées** — le chip de l'accueil (`SelecteurClasse`) pousse désormais `/profil/changer` sans paramètre (onglet de la famille actuelle) ; Moi → « Mon profil » (P2, liste des 3 **inchangée**) : les feuilles P4/P5 ont disparu de `ChoisirProfil`, « Continuer » ouvre la page sur l'onglet du parcours choisi (`source=moi`).

**Adoption** — dans sa famille : flux actuel (Enregistrer, blocage hors ligne #74 compris). D'une famille à l'autre : le pied de l'onglet devient le **bloc conséquences + confirmation dans la page** (l'ancienne `FeuilleChangementProfil`, renommée `BlocChangementProfil` — elle rendait déjà une `Carte`), avec ses états de page « Changement de profil » (en cours) et « Changement impossible » (erreur, profil inchangé). Aucune bascule au toucher de l'onglet. Données : nouvelle fonction de service `adopterProfil` (+ lecture `lireMemoireProfil`) — le profil quitté part dans son créneau de la mémoire `profil.memoire`, rien n'est effacé ; le TOEIC garde ses chemins historiques `passerAuToeic` / `revenirAuSecondaire`. Pré-remplissages depuis la mémoire : classe et pays d'un départ TOEIC, filière et concours d'un retour vers Concours.

## Textes de conséquences — PROPOSITIONS à valider par Benny

Ceux du TOEIC (vers TOEIC : `passerToeicTexte` ; départ du TOEIC : `revenirTexte`) sont repris **tels quels**, comme convenu. Les suivants n'existaient pas dans le code ; ils sont rédigés au ton de l'app (le premier reprend le texte du cadre 18 de la maquette validée) et attendent la validation de Benny :

- Vers Secondaire depuis Concours — titre « Passer au parcours Secondaire ? », bouton « Passer au secondaire », texte : « Ton accueil et tes contenus changent. Ton profil Concours reste enregistré : tu pourras y revenir depuis Moi. »
- Vers Concours depuis Secondaire — titre « Passer au parcours Concours ? », bouton « Passer au concours », texte : « Ton accueil et tes contenus changent. Ton profil Secondaire reste enregistré : tu pourras y revenir depuis Moi. »

(EN en miroir : « Switch to the Secondary track? » / « Switch to the Competitive exam track? », textes correspondants.)

## Écarts et points relevés pendant l'implémentation

1. **Bug trouvé par les captures, corrigé** : le pré-remplissage au focus de l'écran Classe recopiait le niveau du profil concours (sa filière, ex. « ingenieurs ») dans le formulaire classe — dans l'onglet Secondaire d'un profil concours, aucune classe n'était sélectionnée et une adoption sans toucher aux classes aurait écrit la filière comme classe. Garde ajoutée : ce pré-remplissage est ignoré dans la page (`dansPage`), chaque onglet a sa propre liste ; le comportement de la route autonome `/classe` est inchangé. Test de régression ajouté (la classe par défaut « 3e » reste sélectionnée, et c'est elle qui est adoptée).
2. **Test existant corrigé au passage** (`src/services/__tests__/changementProfil.test.ts`) : le test P6-ERR utilisait `jest.spyOn(AsyncStorage, 'setItem')` + `mockRestore()`, qui laisse `setItem` sans implémentation dans le mock officiel et casse les écritures des tests suivants du même fichier (vérifié en isolé). Remplacé par `mockRejectedValueOnce` sur le mock existant, mêmes assertions. Le test d'erreur de l'ancien écran certification a disparu avec l'écran ; son équivalent vit dans les tests de la page.
3. **Démos sans backend** : en captures locales (Supabase fictif), les listes Concours et Certification tombent sur leurs états d'erreur (« Impossible de charger… »), qui sont donc ce que montrent les captures de ces deux onglets ; la structure de la page, les onglets, le point soleil, le sélecteur de pays et les pieds y sont réels. Le bloc d'adoption est capturé en vrai sur l'onglet Secondaire depuis un profil concours (aucune donnée serveur requise). Icône de drapeau en image cassée sur le web local : le CDN des drapeaux est injoignable depuis la VM, artefact d'environnement, pas de l'app.
4. **Points restés ouverts (inchangés, à trancher par Benny)** : l'accueil TOEIC n'a toujours pas de chip (la page n'y est atteignable que par Moi) ; la page n'a pas de titre (retour + onglets seulement), comme la maquette validée.

## Validation

- `npm run valider` complet vert : typage, lint, **Jest 233 suites / 2 571 tests**, export Android Hermes. Les tests couvrent : entrées (chip → page, test mission mis à jour ; P2 → bon onglet + `source=moi`, plus aucune feuille), onglet par défaut = famille, paramètre `onglet`, changement d'onglet sans bascule, adoption intra-famille (Enregistrer préservé), adoptions inter-familles (certification : conséquences reprises de l'ancien écran, confirmation, permutation des profils, erreur d'écriture → « Changement impossible » ; secondaire depuis concours : bloc, texte proposé, permutation), service `adopterProfil`/`lireMemoireProfil`, redirection de l'ancienne route certification. Un premier passage sous charge a montré des courses de timing dans le nouveau fichier de tests (pré-remplissage asynchrone) : les tests attendent désormais la stabilisation, repassés plusieurs fois au vert.
- **Captures réelles** (Expo web + Playwright, clair et sombre) dans `~/workspace/captures-parcours/` : `onglet-secondaire-{clair,sombre}.png`, `onglet-concours-{clair,sombre}.png`, `onglet-certification-{clair,sombre}.png`, `adoption-secondaire-depuis-concours-{clair,sombre}.png` ; script `capturer.js` au même endroit.
- Commits locaux sur `claude/project-thread-kw792g` (code, puis traces). **Aucun push** : en attente du « Pousse » de Benny. Aucun commentaire GitHub à ce stade (au push seulement).
