Date : 2026-10-23 10:15 UTC
Auteur : Muse
Sujet : issue #74 — fermeture après validation terrain de Benny
État : fermée
Zones : toutes celles de la #74 (libérées)

## Décision

Benny a testé sur son téléphone (Android, preview) l'ensemble des correctifs issus des retours terrain du 23 octobre et a confirmé : « j'ai testé, ça fonctionne, on peut fermer ». L'issue est fermée sur cette validation.

## Ce qui est livré et validé terrain

- Lot A : coches de séance hors ligne (file locale + rejeu idempotent).
- Copie locale du calendrier de la classe (la carte planning et le compte à rebours restent affichés hors ligne).
- Moteur de téléchargement du pack : parallèle adaptatif (jusqu'à 32 de front), erreur réseau distincte d'un échec, reprise à la réouverture.
- Garde-fous stockage et migration des contenus d'AsyncStorage vers les fichiers (fin du SQLITE_FULL qui bloquait la connexion).
- Sonde de connectivité qui exige une vraie réponse du serveur (200 + JSON) : un portail captif ne simule plus un retour en ligne.
- File de gains XP : aucun gain perdu à la reconnexion, double comptage au rejeu fermé (file vidée avant calcul, pas d'écriture absolue tant qu'il reste des gains en attente).
- Session servie hors ligne : un démarrage à froid sans réseau après expiration du jeton d'accès n'efface plus la session ; les copies locales du compte restent visibles.
- Lectures immédiates quand la coupure est connue : XP, planning et calendrier servent leur copie sans attendre l'échec réseau (avec tentative serveur conservée quand il n'y a rien à servir, pour que « Réessayer » puisse aboutir).

Validation locale complète au dernier commit de code (`57e7fb1`) : 219 suites, 2 444 tests, typage, lint, export Android ; CI verte sur chaque commit.

## Ce qui n'est PAS fait (assumé à la fermeture)

Le plan initial en 4 lots n'a pas été mené au bout ; Benny ferme sur l'état validé terrain :

- **Lot B** — préchargement ciblé des contenus des séances J/J+1/J+2 dans le pack : non fait. Le pack complet téléchargé par l'élève couvre ses séances en pratique, sans ciblage par jour.
- **Lot C** — garde hors ligne du changement de classe/programme (§4 de l'issue) : non faite.
- **Lot D** — tests d'intégration déconnexion/reconnexion du parcours complet et document d'audit du hors ligne résiduel (§5) : non faits en tant que tels ; les correctifs ci-dessus sont couverts par leurs tests unitaires et la reproduction des scénarios terrain rapportés.

Ces trois points peuvent rouvrir une issue le jour où ils redeviennent un besoin.
