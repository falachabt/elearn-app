## Reference
Design system Elearn Prepa — section "Parrainage". Tokens semantiques du theme obligatoires.

## Ecran principal `src/app/parrainage/index.tsx`
- Code personnel (carte fond emeraude 500, texte encre 1000, bordure franche)
- Bouton "Partager sur WhatsApp" / "Copier le lien"
- Jauge de progression vers le prochain palier (neo-brutaliste, bordure encre 1000)
- Stats : filleuls actifs, filleuls ayant achete
- Liste des recompenses disponibles + bouton "Reclamer"
- Icone soleil (palette.soleil[400]) pour les recompenses

## Page publique `src/app/parrainage/recompenses.tsx`
- Accessible sans compte
- Explication des paliers, du bonus achat, des missions de parrainage
- CTA "Creer mon compte"

## Etendre `src/services/parrainage.ts`
- `obtenirMonCode()`
- `chargerStatuts()`
- `reclamerRecompense(rewardId)`
- `partagerLien(code)`

## Integrations
- Entree "Parrainer des amis" dans l'onglet Moi
- Badge "-15%" sur les ecrans Pass pour les filleuls eligibles
- Evenement analytics `milestone_reached` et `reward_granted`

## Criteres d'acceptation
- L'ecran parrainage s'ouvre depuis Moi.
- Le code est partageable via WhatsApp en un clic.
- Les recompenses reclamables s'affichent avec les bons montants.
- Mode sombre supporte.

## Nouveauté (Ajouté en cours de route)
**Étapes de parrainage et Notifications Push associées :**
Le parcours de parrainage est divisé en 3 étapes claires. À chaque étape, une notification push est envoyée et des récompenses sont distribuées.

1. **Utilisation du lien** : Le parrain reçoit une notification ("Ton ami X a utilisé ton lien d'invitation !") et reçoit une première récompense.
2. **Création du compte** : Le parrain reçoit une notification ("Ton filleul X a créé son compte !") et reçoit une deuxième récompense. C'est uniquement à cette étape que le **filleul** reçoit sa récompense d'inscription.
3. **Achat d'un Pass** : Le parrain reçoit une notification ("Ton filleul X a pris son Pass !") et reçoit sa récompense finale/bonus d'achat.

*Note : Ces notifications doivent être routées correctement vers l'écran de parrainage ou les crédits.*

