# Code promo du Pass : états de l'écran E2 (issue #7)

Maquette : `docs/maquettes/code-promo.html` (prototype cliquable, ouvrir dans un navigateur ; mêmes états en clair et en sombre). Aperçu : https://claude.ai/artifact/PpWcDRXkjPMnhBLiEM1JVW. Parcours E existant : E2 ne montre que le lien « J'ai un code promo » ; on garde cet écran et on n'ajoute que ce que le code change. Règles générales : `docs/design-regles.md`.

## Règles retenues
- Un seul code par paiement ; pour en changer, on retire le code appliqué puis on en saisit un autre.
- Valable pour le Pass seulement (semaine 500, mois 2 500, concours 7 500 FCFA), pas pour les crédits.
- Le prix est toujours recalculé côté serveur : l'app affiche ce que le serveur renvoie, ne l'envoie jamais.
- Vérification au toucher sur « Appliquer » ou sur la touche OK du clavier, pas à chaque lettre ; une seule requête à la fois.
- Saisie en majuscules, sans espace, 20 caractères au plus (lettres, chiffres, tiret). Pas de correction automatique.
- `used_count` n'augmente qu'au paiement confirmé par le serveur (issue #7).

## États (14 écrans dans la maquette)
1. **Départ** : E2 inchangé, lien « J'ai un code promo » (`lien` du thème, souligné, 48 px).
2. **Champ ouvert** : le lien est remplacé par un champ (icône Lucide `Tag`, placeholder « Ton code », focus bleu) et un bouton « Appliquer » grisé ; « Annuler » en texte dessous ; clavier ouvert. Le reste de l'écran défile hors de vue.
3. **Texte saisi** : « Appliquer » devient le bouton vert ; « Payer » passe en blanc (un seul bouton vert par écran).
4. **Vérification** : champ figé, bouton « Vérification » avec icône qui tourne (fixe si « réduire les animations »).
5. **Appliqué, pourcentage** : résumé avec ancien prix barré, nouveau prix en gras, badge jaune « -20 % » (texte noir, bordure 2) et ligne « Tu économises 500 FCFA » ; carte du code (icône `Tag` sur carré jaune, code en mono, « -20 % sur le Pass mois ») avec bouton « Retirer » (icône `X`). Le bouton devient « Payer 2 000 FCFA ».
6. **Appliqué, montant fixe** : même écran avec badge « -500 FCFA ».
7. **Gratuit (0 FCFA)** : opérateur et numéro disparaissent, carte verte « Rien à payer. Ton code couvre tout le Pass semaine. Aucun numéro à saisir. », bouton « Activer mon Pass », note « Activation confirmée par Elearn Prepa ». Le serveur active le Pass sans Mobile Money, dans la même transaction que le code consommé ; compte connecté obligatoire.
8 à 13. **Erreurs** : le texte reste dans le champ, bordure et message corail (`etat.erreurTexte`, icône `AlertCircle` ou `WifiOff`), message annoncé au lecteur d'écran (`role=alert`), l'erreur disparaît dès que le texte change, « Payer » au prix normal reste possible.

| Cas | Message | Action |
|---|---|---|
| inconnu | Ce code n'existe pas. Vérifie les lettres et réessaie. | |
| expiré | Ce code a expiré le 30 sept. (date du serveur) | |
| épuisé | Ce code a déjà été utilisé le maximum de fois. | |
| offre | Ce code est valable pour le Pass concours, pas pour le Pass mois. | « Choisir le Pass concours » (change l'offre et revérifie) |
| réseau | Pas de réseau. Connecte-toi pour appliquer ton code. | « Réessayer » ; texte du champ conservé |
| trop d'essais | Trop d'essais. Réessaie dans 1 minute. | |

14. **E4 reçu** : lignes « Prix » barré, « Code ELEARN20 -20 % », « Montant payé 2 000 FCFA ».

## Comportements
- Retirer : sans confirmation, le prix d'origine et le lien reviennent.
- Changement d'offre sur E1 : le code est revérifié pour la nouvelle offre ; s'il ne convient plus, erreur « offre ».
- Cinq échecs de suite (inconnu, expiré, épuisé, offre) : « Trop d'essais » côté serveur (limitation de débit sur `apply_promo_code`).

## Contrat serveur attendu
```
apply_promo_code(p_code text, p_product text)
-> { "valide": true, "code": "ELEARN20", "type": "pct" | "fixe", "valeur": 20,
     "prix_initial": 2500, "prix_final": 2000, "etiquette": "-20 %" }
ou { "valide": false, "erreur": "inconnu" | "expire" | "epuise" | "offre" | "limite",
     "expire_le": "2026-09-30", "offres_valables": ["pass_concours"] }
```
À la commande, l'app envoie `{ produit, code, operateur, numero }` (jamais le prix). Avec un prix final de 0, ni opérateur ni numéro. La table de l'issue #7 ne connaît que `discount_pct` : le rabais en FCFA et la liste d'offres valables demandent une colonne de plus (à confirmer avec Benny).

## Tokens
`fond.creux` (résumé), `bord.fort`, `ombre.m` sur les boutons, `marque.principale` (action), `accent.soleil` (badge et icône du code, texte noir), `etat.erreur` / `etat.erreurTexte` (erreurs), `texte.lien`. Même rendu en clair et en sombre.

## PostHog
`promo_code_opened` {offre}, `promo_code_applied` {offre, type, gratuit}, `promo_code_failed` {offre, raison}, `promo_code_removed` {offre}. Ne jamais envoyer le code lui-même.

## Accessibilité
Champ libellé « Code promo », majuscules automatiques, touche clavier « OK » = Appliquer ; erreurs et état appliqué portent texte et icône ; cibles de 48 px ; le résumé annonce « Prix 2 000 FCFA au lieu de 2 500 FCFA » ; texte système jusqu'à 130 %.

## Tests
Les 14 états ; correction du texte qui efface l'erreur ; retrait ; changement d'offre ; double appui sur « Appliquer » (une seule requête) ; clavier ouvert sur petit écran ; clair et sombre.
