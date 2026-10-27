# Détail d'un mini-test ou d'un mixte fini : erreur de chargement à tort — diagnostic et correctif

- Date : 27 octobre 2026 (11:31 UTC)
- Auteur : Muse
- État : fait
- Zones touchées : `src/components/certification/DetailTest.tsx`, `src/components/certification/ListeTests.tsx` (paramètre de route), nouveau test `src/components/certification/__tests__/detailTest.test.tsx`. Volet serveur lié : elearn-supabase #191 (groupes tronqués dans les définitions composées), traité séparément.
- Issue : elearn-app #129. Retour terrain de Benny du 27 octobre 2026 (capture « Écoute n° 1 »).

## Constat et cause prouvée

En voulant ouvrir le premier mini-test (déjà fait), Benny tombe sur la carte « Impossible de charger tes tests — Vérifie ta connexion », titre « Écoute n° 1 ». Les autres mini-tests se lancent normalement.

La cause est dans `DetailTest` : l'écran ramenait le type de la route à `listening` dès qu'il n'était ni `reading` ni `full` (`kind === 'reading' || kind === 'full' ? kind : 'listening'`). Or `ListeTests` envoie vers le détail tout test **fini**, des cinq types. Pour un mini ou un mixte fini, le détail chargeait la liste d'écoute, n'y trouvait pas la définition, et affichait la bannière d'erreur générique — avec le numéro de repli 1, d'où « Écoute n° 1 » dans tous les cas. Les tests non finis se lancent depuis la liste sans passer par le détail : ils fonctionnent, comme constaté. Ni un problème de connexion, ni un problème de données.

## Correctif

- `DetailTest` accepte les cinq types de la liste ; la bonne liste est chargée, la définition est trouvée.
- Titre : numéro de la définition ; pour un mini, le numéro **dans sa partie** (`numeroDansPartie`, comme la liste). La liste passe la partie du mini en paramètre de route pour que le titre reste juste pendant le chargement.
- Échelle du meilleur score, alignée sur le bilan de fin : total (990) pour le complet **et le mixte**, section (moitié) pour les demi-tests, et pour un mini par partie le compte « bonnes sur total » (`listes.meilleurSur`, dénominateur = nombre de questions) — le format n'a pas de score.
- « Refaire » transmet la partie du test et les réglages au lancement (`lancerDefTest`), comme le lancement depuis la liste (la durée d'un mini dépend de sa partie).

## Preuves

- Nouveau fichier de tests `detailTest.test.tsx`, 3 verrous : mini fini (titre « n° 2 » dans sa partie, pas de bannière d'erreur, actions présentes), mixte fini (« Mixte n° 1 », « Meilleur score : 520 sur 990 »), écoute finie (« Écoute n° 1 », « Meilleur score : 385 sur 495 »). Sur l'ancien code, les deux premiers tombaient sur la bannière d'erreur.
- Validation locale complète `npm run valider` verte : 235 suites, 2 614 tests (le nouveau fichier inclus).

## Points notés, hors périmètre

- Le texte « Vérifie ta connexion » accuse la connexion pour des erreurs qui n'en sont pas (ici, définition introuvable) : distinguer les causes d'échec de l'écran serait un chantier séparé.
- Ligne de liste du mixte : le meilleur y est rendu par `meilleurSur` avec le nombre de questions (20) en dénominateur alors que la valeur vit sur l'échelle totale — relevé à la lecture, signalé dans elearn-supabase #191 (la valeur source y est discutée), non traité ici.
