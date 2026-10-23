# Retouche — page hors ligne : retrait de l'icône nuage en haut

- Date : 2026-10-23 12:00 UTC
- Auteur : Muse
- Sujet : demande directe de Benny (capture d'écran de la page « Tes cours, même sans réseau ») : supprimer la pastille icône nuage au-dessus du texte d'introduction, garder le texte seul.
- État : fait avec ce commit.
- Zones : `src/components/horsLigne/HorsLigne.tsx` uniquement.

## Changement

Le bloc icône (`cloud-download-outline` dans un carré teinté marque) en tête de
l'écran hors ligne est retiré ; l'introduction commence directement par son
texte. Import et style devenus inutiles supprimés au passage. Aucun autre
écran touché (la feuille « Tu es hors ligne » du lot C garde sa pastille nuage
barré, validée dans son design).
