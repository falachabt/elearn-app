# Diagramme des parcours utilisateur — Elearn Prepa

Ce document décrit les parcours réellement implémentés dans `elearn-app`, à partir des routes Expo Router et des composants utilisés par ces routes.

## Légende

- Un rectangle représente un écran ou une zone de navigation.
- Un losange représente une décision ou un garde-fou.
- Un nœud arrondi représente une feuille du bas, une modale ou un message superposé.
- Les parcours internes à un même écran sont indiqués comme des états, car ils ne changent pas de route.

## 1. Entrée dans l’application et onboarding

```mermaid
flowchart TD
    A[Ouverture de l'app] --> B[Initialisation globale<br/>langue · session invité · crédits · liens profonds]
    B --> C{Profil local<br/>terminé ?}

    C -- Non --> W["/bienvenue"]
    C -- Oui --> T[Shell des cinq onglets]

    W --> D{Qui es-tu ?}
    D -- Élève --> CE["/classe?type=eleve"]
    D -- Candidat concours --> CC["/classe?type=concours"]
    D -- J'ai déjà un compte --> LOGIN["/compte/connexion"]

    CC --> CONCOURS["/concours"]
    CONCOURS --> CC
    CE --> R["/premier-resultat"]
    CC --> R

    R --> PHOTO["/photo<br/>porte photo"]
    R --> TEST["/mini-test"]
    R --> EXPLORE[Explorer sans commencer]

    PHOTO --> T
    EXPLORE --> T
    TEST --> SCORE["/score"]
    SCORE --> SAVE{Invité :<br/>sauvegarder ?}
    SAVE -- Oui --> SAVE_SHEET((Feuille Sauvegarder))
    SAVE_SHEET --> ACCOUNT["/compte/creer ou OAuth"]
    SAVE -- Plus tard --> T
    SCORE --> T

    LOGIN --> M[Retour réussi vers /moi]
    ACCOUNT --> M
    M --> T
```

### Détails importants

- La session Supabase invitée est créée avant l’affichage fonctionnel. L’utilisateur peut donc commencer sans compte.
- Les choix de statut, niveau, pays et concours sont conservés localement.
- Le parcours concours est réellement en deux temps : choix de la filière, choix du concours, retour vers la sélection de niveau, puis validation vers le premier résultat.
- Le mini-test termine l’arrivée à l’ouverture de `/score`. La photo et « Explorer sans commencer » terminent l’arrivée directement avant d’ouvrir leur destination.
- La création d’un compte par e-mail depuis un invité convertit le même utilisateur et conserve sa progression locale. Une connexion sociale peut, selon le fournisseur et le compte existant, rattacher l’identité ou ouvrir un autre compte.

## 2. Navigation principale et mission du jour

```mermaid
flowchart LR
    T[Shell cinq onglets] --> A[Accueil]
    T --> R[Réviser]
    T --> P[Photo]
    T --> Q[Questions]
    T --> MOI[Moi]

    A --> M["/mission"]
    A --> REP[Reprise d'une leçon, d'un quiz ou d'un exercice]
    A --> P
    A --> CRED((Détail des crédits))
    A --> RCOMP((Rappel de création de compte<br/>pour l'invité))

    M --> MT[Mini-test de la mission]
    MT --> FIN["/mission/terminee"]
    FIN --> ERR["/mission/erreurs"]
    ERR --> QR["/quiz/resultats"]
    FIN --> CH["/cours/chapitre<br/>revoir les chapitres en erreur"]
    FIN --> RH((Feuille rythme<br/>première mission))
    FIN --> RN((Feuille rappel notifications))
    FIN --> A

    REP --> LEÇON["/cours/lecon"]
    REP --> EQ["/entrainement/quiz"]
    REP --> EX["/entrainement/exercice"]
```

Le compteur de crédits en haut de l’Accueil et de Réviser ouvre une feuille de détail. La carte de crédits dans Moi ouvre la même feuille. Les actions liées au compte, au paiement ou à la question passent par le garde-fou compte invité.

## 3. Parcours Réviser

```mermaid
flowchart TD
    R[Réviser] --> ONG{Onglet}

    ONG -- Cours --> MAT["/cours/matiere"]
    MAT --> CH["/cours/chapitre"]
    CH --> FICHE["/cours/fiche"]
    CH --> LEÇON["/cours/lecon"]
    CH --> ENTRA["/entrainement/chapitre"]

    LEÇON --> VAL{Leçon déjà validée ?}
    VAL -- Oui --> NEXT[Leçon suivante ou fin de chapitre]
    VAL -- Non --> INV((Feuille : répondre au quiz ?))
    INV -- Répondre --> LQ["/cours/quiz"]
    INV -- Passer --> NEXT
    LQ --> LQR{Score >= 2/3 ?}
    LQR -- Oui --> NEXT
    LQR -- Non --> RETRY[Réessayer ou revenir]
    LQ --> CORR["/quiz/correction"]
    NEXT --> FINCH["/cours/fin"]
    FINCH --> ENTRA

    ONG -- S'entraîner --> ENTRA
    ENTRA --> ECH["/entrainement/chapitre"]
    ECH --> CHOIX{Élément}
    CHOIX -- Quiz --> DETAIL["/entrainement/detail<br/>si sessions existantes"]
    DETAIL --> EQ["/entrainement/quiz"]
    CHOIX -- Exercice --> EX["/entrainement/exercice"]
    EQ --> QR["/quiz/resultats"]
    QR --> CORR
    EX --> PAY{Corrigé demandé}
    PAY --> CREDIT((Feuilles crédits :<br/>coût · épuisé · limite))
    EX --> FINEX((Feuille : marquer comme fait ?))
    EX --> EXNEXT[Exercice suivant ou sortie]

    ONG -- Annales --> AN["/annales/dossier ou /annales/concours"]
    AN --> SUJET["/annales/sujet"]
    SUJET --> DOC["/document<br/>sujet PDF gratuit ou déjà ouvert"]
    SUJET --> CORR_A{Correction accessible ?}
    CORR_A -- Gratuite / crédit / pass --> DOC
    CORR_A -- Solde insuffisant --> OFFRES["/offres?declencheur=limite"]
    DOC --> DOCS["/documents<br/>copie locale et reprise de page"]
```

### Branches de Réviser

- **Cours** : matière → chapitre → fiche optionnelle ou leçon → quiz de validation → leçon suivante / fin de chapitre.
- **S’entraîner** : filtre par matière → chapitre → quiz ou exercice. Les quiz terminés mènent à la correction ; les exercices ont des confirmations de sortie et un corrigé potentiellement payant.
- **Annales** : les dossiers de classe et concours mènent à des sujets ; chaque PDF est ouvert dans le lecteur interne et peut être conservé hors ligne.

## 4. Aide par photo

Le parcours Photo est une machine à états dans la route `/photo` :

```mermaid
stateDiagram-v2
    [*] --> Camera
    Camera --> Recadrage: photo prise ou galerie
    Camera --> Historique: historique / notification
    Historique --> Correction: ouvrir une ancienne correction
    Recadrage --> Analyse: Demander à l'IA
    Analyse --> Correction: correction reçue
    Analyse --> Illisible: image non lisible
    Analyse --> Erreur: hors ligne ou erreur serveur
    Analyse --> Limite: quota du pass atteint
    Analyse --> Recadrage: crédits insuffisants
    Recadrage --> Credits
    Correction --> Signaler: pas compris ou drapeau
    Correction --> Partager: partager la correction
    Correction --> Camera: nouvelle photo
    Signaler --> Correction: signalement envoyé
    Illisible --> Camera: reprendre
    Erreur --> Analyse: réessayer la même photo
    Erreur --> Camera: nouvelle photo
    Limite --> Accueil
    Credits: Feuille crédits épuisés
    Accueil: Retour à l'Accueil
```

Depuis une notification « correction prête », le lien ouvre `/photo?historique=1`, puis l’état Historique.

## 5. Questions et communauté

```mermaid
flowchart TD
    Q[Questions] --> FILTRES[Filtres matière · classe · résolues]
    FILTRES --> LISTE[Fil de questions]
    LISTE --> FICHE["/question"]
    LISTE --> PHOTO_Q((Visionneuse photo plein écran))
    LISTE --> POST_G{Poser une question}

    POST_G --> COMPTE{Invité ?}
    COMPTE -- Oui --> COMPTE_SHEET((Feuille compte requis))
    COMPTE_SHEET --> COMPTE_ACTION[Créer / OAuth / plus tard]
    COMPTE -- Non --> POST["/question/poser"]
    COMPTE_ACTION --> POST

    POST --> BROUILLON((Feuille garder ou supprimer le brouillon))
    POST --> PUBLISH[Publier]
    PUBLISH --> FICHE

    FICHE --> REPONDRE[Répondre]
    FICHE --> VOTER[Voter une réponse]
    FICHE --> SIGNALER[Signaler question ou réponse]
    FICHE --> SONDAGE[Voter à un sondage]
    REPONDRE --> COMPTE_SHEET
    VOTER --> COMPTE_SHEET
    SIGNALER --> COMPTE_SHEET
    SONDAGE --> COMPTE_SHEET
    SIGNALER --> SIGNAL_SHEET((Feuille motif de signalement))
    FICHE --> PHOTO_Q
```

Le fil garde une copie locale hors ligne. Les réponses échouées restent visibles avec « Réessayer » ou « Supprimer ».

## 6. Compte, Pass et paiement

```mermaid
flowchart TD
    GATE{Action réservée au compte ou au paiement}
    GATE --> INV{Session invitée ?}
    INV -- Oui --> FC((Feuille compte requis))
    FC --> EMAIL["/compte/creer"]
    FC --> SOCIAL[Google · Apple · Facebook selon plateforme]
    FC --> LATER[Plus tard / fermeture]
    INV -- Non --> SUITE[Action demandée]
    EMAIL --> SUITE
    SOCIAL --> SUITE

    OFFRES["/offres"] --> CHOIX[Choisir gratuit, semaine, mois ou autre Pass]
    CHOIX --> PAYER["/offres/payer"]
    CHOIX --> PARENT["/offres/parent"]
    PARENT --> WHATSAPP[Créer et partager le lien parent<br/>WhatsApp ou copie]
    PAYER --> PAY_STATE{État du paiement}
    PAY_STATE -- Saisie --> PAYS((Feuille choix du pays))
    PAY_STATE -- Envoi --> ATTENTE[Attente de confirmation opérateur]
    ATTENTE --> ANNUL((Feuille confirmer l'annulation))
    ATTENTE --> SUCCES[Paiement réussi]
    ATTENTE --> ECHEC[Paiement échoué]
    ECHEC --> RETRY[Changer numéro / opérateur / réessayer]
    ECHEC --> PARENT

    SUCCES --> MOI[Moi avec Pass actif]
    MOI --> HIST["/paiements"]
    HIST --> DETAIL["/paiements/:id"]
```

Les pages `/offres` sont ouvertes depuis le score, la limite de crédits, les annales, l’Accueil, Moi, la carte de crédits et les feuilles de paiement.

## 7. Parcours Moi et réglages

```mermaid
flowchart TD
    MOI[Moi] --> PROFIL[Profil, classe, statut, pays]
    MOI --> PROG["/progression"]
    MOI --> DOCS["/documents"]
    MOI --> CRED((Détail crédits))
    MOI --> OFFRES["/offres"]
    MOI --> PARENT["/profil/parent"]
    MOI --> AIDE["/aide"]
    MOI --> SETTINGS["/parametres"]

    PROFIL --> CLASSE["/classe?modifier=1"]
    CLASSE --> CONCOURS["/concours si candidat"]
    CLASSE --> MOI

    DOCS --> PDF["/document"]
    DOCS --> DELETE((Feuille supprimer tous les documents))

    SETTINGS --> SONS["/parametres/sons"]
    SETTINGS --> LANG((Feuille choisir la langue))
    SETTINGS --> RYTHME((Feuille régler le rythme de mission))
    SETTINGS --> DECO((Feuille confirmer la déconnexion))
    SETTINGS --> DELETE_ACCOUNT["/profil/supprimer"]
    DECO --> WELCOME["/bienvenue après déconnexion"]
    DELETE_ACCOUNT --> DELETE_CONFIRM[Confirmation inline en deux appuis]
    DELETE_CONFIRM --> CANCEL[Annulation possible avant l'effacement différé]
```

## 8. Inventaire des feuilles, modales, popups et messages

### Overlays globaux

| Overlay | Déclencheur | Sorties principales |
|---|---|---|
| `FeuilleMiseAJour` | Mise à jour OTA disponible | Mettre à jour, Plus tard, Réessayer ; obligatoire = écran bloquant plein écran |
| `BienvenueCredits` | Bonus après création ou liaison d’un compte | Récupérer le bonus |
| `FeuilleCompte` | Paiement, parent, question, rappel compte | Créer par e-mail, Google/Apple/Facebook, Plus tard ; reprend l’action après réussite |
| `FeuilleSauvegarde` | Score du mini-test pour un invité | Créer/lier un compte ou Plus tard |
| `FeuilleDetailCredits` | Pastille crédits, carte Moi | Voir les Pass ; créer un compte si invité |
| `FeuilleCout` | Action coûtant au moins le seuil de confirmation | Confirmer la dépense, annuler, voir les Pass |
| `FeuilleEpuise` | Solde insuffisant | Créer un compte, Pass, demander au parent, attendre la recharge, fermer |
| Feuille de limite crédits | Limite IA du Pass atteinte | Compris |

### Overlays contextualisés

| Zone | Overlay / confirmation |
|---|---|
| Fin de mission | Réglage du rythme en deux étapes ; puis rappel quotidien des notifications |
| Leçon | Invitation à répondre au quiz ou à passer à la suite |
| Exercice | Hors ligne ; marquer comme fait avant de continuer ; confirmer la sortie |
| Résultats quiz | Liste des leçons ratées quand il y en a plusieurs |
| Questions | Menu d’une réponse ; feuille de signalement ; feuille conserver/supprimer le brouillon |
| Annales | Feuille d’erreur réseau pour l’ouverture payante |
| Documents | Confirmation « tout supprimer » |
| Paiement | Choix du pays ; confirmation d’annulation pendant l’attente opérateur |
| Ancien compte / parent | Modale native de choix de l’indicatif téléphonique |
| Questions avec photo | Modale native visionneuse plein écran avec zoom et gestes |

### Messages non modaux

Les `Banniere` inline couvrent les états succès, information, alerte et erreur : compte, hors ligne, numéro masqué, signalement envoyé, paiement, suppression de compte, rappel refusé, documents indisponibles, correction photo, etc. Le lecteur PDF affiche aussi un toast temporaire de reprise à la dernière page.

## 9. Constats de couverture

- Le fournisseur de visite guidée est installé à la racine, mais aucun appel à `useVisite().demarrer(...)` n’est actuellement présent dans le code : aucune visite ne se déclenche par elle-même.
- Il n’y a pas d’appel `Alert.alert` repéré : les confirmations métier utilisent principalement des feuilles du bas ou des bannières inline.
- `/auth/callback` est une route technique de retour OAuth qui redirige vers `/moi`.
- `/mise-a-jour` est une route de développement d’aperçu ; la mise à jour réelle est montée globalement dans le layout racine.
- `/compte/ancien`, `/annales/autres` et `/credits` existent comme routes, mais aucune entrée interne évidente n’a été repérée pour les ouvrir depuis la navigation actuelle. Elles restent accessibles par lien direct ou peuvent être conservées pour une prochaine itération.
