# Pied des écrans Photo : bloc du bas trop loin de la barre d'onglets

- Date : 24 octobre 2026, 15 h 13 UTC
- Auteur : Muse
- État : fait (commit local sur `claude/project-thread-kw792g`, non poussé : le push attend le feu vert de Benny après les captures)
- Zones touchées : `src/components/photo/Photo.tsx` (style du pied des écrans du parcours photo : recadrage, correction, signaler, limite de cadence, limite du jour). Aucun écran nouveau, aucune chaîne d'interface nouvelle. Zones TOEIC non touchées, `Ecran.tsx` et le layout des onglets non modifiés.

## Retour de Benny (capture téléphone, 24 octobre 2026)

Sur l'écran Correction, le bloc du bas (bouton « Nouvelle photo » + ligne « N questions IA
restantes aujourd'hui ») flotte avec un grand espace vide entre lui et la barre d'onglets.
Même espace sur l'état « avis » de la correction (« C'est clair » / « Pas compris »).
Demande : coller ce bloc au plus près de la barre, avec seulement l'espace de respiration
standard, pour rendre la place au contenu.

## Cause identifiée

Double réserve en bas, pour tout écran à pied fixe posé dans un onglet :

1. Le `TabSlot` du layout des onglets reçoit `paddingBottom: DEPASSEMENT_CENTRAL + espace[3]`
   (22 + 8 = 30) : tout l'écran est décalé d'autant vers le haut, pour que le contenu
   défilant s'arrête au-dessus du bouton central qui dépasse de la barre.
2. Le pied de `Ecran` ajoute par-dessus son `paddingBottom` standard `espace[5]` (16),
   prévu pour séparer le pied de ce qui est sous l'écran quand il n'y a pas cette réserve.

Le pied se retrouve donc à 46 dp sous le dernier texte, là où la réserve d'onglet seule
(30 = dépassement 22 + respiration `espace[3]` 8, le standard déjà choisi par le layout
pour le contenu défilant) suffit. Les écrans à pied du parcours photo sont les seuls
concernés côté élève : recadrage, correction (deux états), signaler, limite de cadence,
limite du jour — tous dans `Photo.tsx`.

## Correctif retenu

Dans `Photo.tsx`, les `Ecran` à pied du parcours reçoivent un `piedStyle` commun
(`PIED_ONGLET` : `marginBottom: -espace[5]`) qui compense la réserve en double : le pied
garde son `paddingBottom` interne — y compris le cas clavier de l'écran signaler, où
`Ecran` le réduit à `espace[3]` — et descend de `espace[5]` (16 dp). La réserve du
`TabSlot` (dépassement 22 + respiration `espace[3]`) reste l'unique espace sous le bloc,
et le contenu gagne 16 dp de hauteur. Ni `Ecran.tsx` (partagé, aussi utilisé par la
certification) ni le layout des onglets (tous les onglets) ne sont touchés.

## Résultat (24 octobre 2026)

- Validation locale `npm run valider` : verte — typage OK ; ESLint 0 erreur
  (44 avertissements préexistants) ; Jest 226 suites / 2 507 tests réussis ; export
  Android Hermes OK.
- Captures web local (Expo web + Chromium, caméra factice, viewport 390×844) sur
  l'écran Recadrage — même `Ecran`, même pied et même compteur de quota que la
  Correction ; la Correction elle-même exige une réponse du serveur d'analyse,
  inaccessible avec le backend fictif local. Mesure : bas du bouton d'envoi de 712 à
  728 px CSS, soit 16 dp rendus sous le bloc, en clair comme en sombre. Hors ligne, la
  ligne de quota ne se charge pas et n'apparaît pas sur les captures ; sur la
  Correction, elle est le dernier élément du pied et descend du même montant (écart
  sous la ligne : 46 → 30 dp).
- Captures (hors dépôt) : `~/workspace/captures-pied-photo/avant-recadrage-clair.png`,
  `apres-recadrage-clair.png`, `apres-recadrage-sombre.png`.
- Commit : `282b146` (local, non poussé).
