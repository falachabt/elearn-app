# Code promo du Pass : E1 (liste des Pass) et E2 (Paiement), issue #7

Maquette : `docs/maquettes/code-promo.html` (prototype cliquable avec E1 et E2 reliés, ouvrir dans un navigateur ; mêmes états en clair et en sombre). Aperçu : https://claude.ai/artifact/PpWcDRXkjPMnhBLiEM1JVW. Règles générales : `docs/design-regles.md`.

Révision 2 (7 octobre, demande de Benny) : le code se saisit dès E1, sous le bandeau du répétiteur, pour voir l'effet sur chaque Pass, et il est repris déjà appliqué sur E2, où le lien « J'ai un code promo » remonte sous la carte du Pass. On garde les écrans Figma E1 et E2 ; on n'ajoute que ce que le code change.

## Ce qui change par rapport à Figma
- **E1** : un bloc code promo entre le bandeau « répétiteur » et les cartes. Les cartes ne bougent pas ; leur prix change quand un code est appliqué.
- **E2** : « J'ai un code promo » quitte le bas de l'écran. Ordre : résumé du Pass, code promo, « Ton opérateur », numéro, aide, « Payer ».
- Le texte du bandeau est celui de Figma E1 (à vérifier au codage).

## Règles retenues
- Un seul code par paiement ; pour en changer, on retire le code appliqué puis on en saisit un autre.
- Valable pour les Pass payants (semaine, mois, concours), jamais pour « Gratuit », les crédits ou d'autres achats.
- Un seul code partagé par E1 et E2 : saisi sur l'un, il est appliqué sur l'autre ; retiré d'un côté, il l'est des deux. Il survit au retour en arrière et au changement de Pass.
- Il est envoyé à la création de la commande, seulement s'il est valable pour le Pass choisi.
- À l'ouverture de E2, le code est revérifié sans bruit. S'il n'est plus valable : retiré, message « Ce code n'est plus valable. Le prix normal est rétabli. », prix normaux.
- Le prix est toujours recalculé côté serveur : l'app affiche ce que le serveur renvoie, ne l'envoie jamais.
- Vérification au toucher sur « Appliquer » ou sur la touche OK du clavier, pas à chaque lettre ; une seule requête à la fois.
- Saisie en majuscules, sans espace, 20 caractères au plus (lettres, chiffres, tiret). Pas de correction automatique.
- `used_count` n'augmente qu'au paiement confirmé par le serveur (issue #7).

## E1 : états (13 écrans)
1. **Départ** : lien « J'ai un code promo » (icône `Tag`, `texte.lien`, souligné, 48 px) sous le bandeau.
2. **Champ ouvert** : champ (placeholder « Ton code », focus bleu) et « Appliquer » grisé ; « Annuler » en texte ; clavier ouvert, l'écran défile pour garder le champ visible.
3. **Texte saisi** : « Appliquer » devient le bouton vert, « Payer » passe en blanc (un seul bouton vert par écran).
4. **Vérification** : champ figé, bouton « Vérification » avec icône qui tourne (fixe si « réduire les animations »).
5. **Appliqué, pourcentage** : le champ laisse place à une ligne (icône `Tag` sur carré jaune, code en mono, « -20 % sur les Pass payants », bouton « Retirer »). Chaque carte payante montre l'ancien prix barré, le nouveau prix en gras et, sous le nom, un badge jaune « -20 % » (texte noir) suivi de la durée.
6. **Appliqué, montant fixe** : badge « -500 FCFA » ; le Pass semaine passe à 0 FCFA.
7. **Pass à 0 FCFA choisi** : le bouton principal devient « Activer mon Pass ».
8. **Code valable pour un seul Pass** (ex. CONCOURS) : seule cette carte change ; les autres payantes portent « Code non valable pour ce Pass » (icône `AlertCircle` + texte, jamais la couleur seule) et gardent leur prix.
9 à 13. **Erreurs** : inconnu, expiré, épuisé, réseau, trop d'essais. Le texte reste dans le champ, bordure et message corail (`etat.erreurTexte`, icône `AlertCircle` ou `WifiOff`), message annoncé au lecteur d'écran (`role=alert`), erreur effacée dès que le texte change. Les prix normaux restent affichés, payer reste possible.

Bouton principal : « Payer » suit le Pass choisi et son prix après code ; « Envoyer à mon parent » reste blanc. Le code est joint au lien parent (à confirmer par Benny : la page parent F affiche alors le prix réduit).

## E2 : états (10 écrans dont E4)
1. **Départ** : lien sous la carte du Pass, avant l'opérateur.
2. **Champ ouvert**, 3. **texte saisi** : mêmes états qu'en E1.
4. **Code repris de E1** : ligne « appliqué » déjà présente ; résumé avec prix barré, nouveau prix, badge, « Tu économises 500 FCFA » ; bouton « Payer 2 000 FCFA ».
5. **Rabais en FCFA** : même écran, badge « -500 FCFA ».
6. **Rien à payer** : opérateur et numéro disparaissent, carte verte « Rien à payer. Ton code couvre tout le Pass semaine. Aucun numéro à saisir. », bouton « Activer mon Pass », note « Activation confirmée par Elearn Prepa ». Le serveur active le Pass sans Mobile Money, dans la même transaction que le code consommé ; compte connecté obligatoire.
7. **Code non applicable au Pass choisi** (CONCOURS avec le Pass mois) : ligne neutre « Valable pour le Pass concours seulement », prix normal ; deux choix : « Choisir le Pass concours » (retour sur E1, carte sélectionnée) ou « Retirer ».
8. **Erreur réseau** (les autres erreurs sont celles de E1), 9. **revérification refusée** à l'ouverture.
10. **E4 reçu** : « Prix » barré, « Code ELEARN20 -20 % », « Montant payé 2 000 FCFA ».

| Cas | Message | Action |
|---|---|---|
| inconnu | Ce code n'existe pas. Vérifie les lettres et réessaie. | |
| expiré | Ce code a expiré le 30 sept. (date du serveur) | |
| épuisé | Ce code a déjà été utilisé le maximum de fois. | |
| réseau | Pas de réseau. Connecte-toi pour appliquer ton code. | « Réessayer » ; texte conservé |
| trop d'essais | Trop d'essais. Réessaie dans 1 minute. | |
| plus valable (E2) | Ce code n'est plus valable. Le prix normal est rétabli. | |

Cinq échecs de suite (inconnu, expiré, épuisé) : « Trop d'essais » côté serveur (limitation de débit sur `apply_promo_code`).

## Contrat serveur attendu
Le contrat devient « par Pass » : E1 affiche tous les prix en un seul appel, sans produit en paramètre.
```
apply_promo_code(p_code text)
-> { "valide": true, "code": "ELEARN20", "type": "pct" | "fixe", "valeur": 20,
     "offres": {
       "pass_semaine":  { "valable": true, "prix_initial": 500,  "prix_final": 400,  "etiquette": "-20 %" },
       "pass_mois":     { "valable": true, "prix_initial": 2500, "prix_final": 2000, "etiquette": "-20 %" },
       "pass_concours": { "valable": false } } }
ou { "valide": false, "erreur": "inconnu" | "expire" | "epuise" | "limite", "expire_le": "2026-09-30" }
```
À la commande, l'app envoie `{ produit, code, operateur, numero }` (jamais le prix). Avec un prix final de 0, ni opérateur ni numéro. La table de l'issue #7 ne connaît que `discount_pct` : le rabais en FCFA et la liste de Pass valables demandent des colonnes de plus (décision à confirmer avec Benny).

## Tokens
`fond.creux` (résumé), `bord.fort`, `ombre.m` sur les boutons, `marque.principale` (action, carte sélectionnée en `marque.douce`), `accent.soleil` (badge et icône du code, texte noir), `etat.erreur` / `etat.erreurTexte` (erreurs et « non valable »), `texte.lien`. Même rendu en clair et en sombre.

## PostHog
`promo_code_opened` {ecran}, `promo_code_applied` {ecran, type, nb_pass_valables}, `promo_code_failed` {ecran, raison}, `promo_code_removed` {ecran}, `promo_code_unusable` {offre}. `ecran` vaut `e1` ou `e2`. Ne jamais envoyer le code lui-même.

## Accessibilité
Champ libellé « Code promo », majuscules automatiques, touche clavier « OK » = Appliquer ; états appliqué, non valable et erreurs portent texte et icône ; cartes de Pass en rôle radio, prix annoncé « 2 000 FCFA au lieu de 2 500 FCFA » ; cibles de 48 px ; texte système jusqu'à 130 %.

## Tests
Les états E1 et E2 ci-dessus ; propagation (saisi sur E1 présent sur E2, saisi sur E2 présent au retour sur E1, retrait des deux côtés) ; changement de Pass avec un code appliqué ; code non applicable sur E2 ; revérification refusée à l'ouverture de E2 ; correction du texte qui efface l'erreur ; double appui sur « Appliquer » (une seule requête) ; clavier ouvert sur petit écran ; clair et sombre.
