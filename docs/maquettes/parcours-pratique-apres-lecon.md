# Parcours TOEIC : pratique après chaque leçon (retour de Benny, 24 novembre 2026)

## Maquette (validée par le texte de Benny)
Dans la frise Réviser > Parcours, chaque leçon est suivie d'une seule étape d'entraînement, dans cet ordre :
1. la leçon (Recall ou Découverte, avec sa vidéo) ;
2. « Pratique · <notion> » (couleur et icône de l'étape Pratique), c'est l'option « s'entraîner sur cette notion » de la fin de vidéo. Elle ouvre une série sur cette seule notion. Pas d'étape « Quiz de leçon » en plus, pas de doublon.

Le « Mini-test » reste une étape à part dans le plan, il n'est pas confondu avec cette pratique (retour de Benny, 24 novembre).

Le numéro continu et la surbrillance du jour actif ne changent pas.

## Page de leçon (fiche d'une notion)
Le bouton « Practise this topic » reste en pied de page collant, avec la bordure du haut.
Il doit être séparé du bas de l'écran par la marge de la barre système, comme sur les autres écrans.
Correction : la fiche ne désactive plus l'inset du bas (`insetBas={false}` retiré de `FicheNotion`).

## Code
- `monPlan.ts` : `pratique` ajouté après chaque `quiz_lecon` (titre « Pratique · notion »).
- `routeEtape` : une étape `pratique` avec `uniteId` ouvre la série de cette notion (route existante).
- Tests : `planLocalComplet.test.ts` vérifie l'ordre leçon, quiz, pratique.
