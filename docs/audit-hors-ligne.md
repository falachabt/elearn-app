# Audit du mode hors ligne (issue #74, lot D)

État des lieux au 23 octobre 2026, après les lots A à C de l'issue #74. Ce document dit ce qui
fonctionne sans réseau dans l'app, ce qui exige une connexion, et le comportement prévu dans chaque
cas. Il sert de référence produit : un flux « en ligne seulement » n'est pas un bug s'il est listé ici
avec son comportement.

## Ce qui fonctionne hors ligne

- **Session** : une session déjà connectée reste utilisable pendant la coupure, même si le jeton
  d'accès d'une heure a expiré entre-temps ; l'app ne déconnecte plus l'élève pour un échec réseau
  (`services/session.ts`). Seule une erreur qui n'est pas réseau peut invalider la session.
- **Accueil** : mission du jour (préchargée), série, total XP (solde local + gains en file),
  calendrier de la classe (copie par niveau et pays), séance du jour du planning (copie).
- **Planning d'études** : lecture sur la copie gardée, séances faisables avec les contenus du pack,
  coches rangées dans une file locale et rejouées vers le serveur au retour du réseau (RPC
  idempotent, une entrée par jour, dernier état gardé). Tests d'intégration du parcours complet :
  `services/__tests__/planningParcoursHorsLigne.test.ts`.
- **Réviser et s'entraîner** : leçons, fiches, quiz de leçon, quiz libres, exercices et corrigés
  (selon le pass) lus depuis les fichiers du pack. Toute lecture de contenu passe par
  `lireLocalHorsLigne`, qui applique l'expiration (7 jours sans contact serveur).
- **Annales** : catalogue et sujets PDF téléchargés consultables ; la consultation ne demande pas le
  réseau.
- **Téléchargement du pack** : parallèle (jusqu'à 32 flux), interrompu proprement par une coupure
  (l'erreur réseau n'est pas un échec), repris automatiquement au retour du réseau et à la réouverture
  de l'app. Les contenus des séances des trois prochains jours partent en premier (lot B).
- **Notifications** : le centre se lit sur la liste gardée sur l'appareil.

## Ce qui exige le réseau, et ce qui se passe alors

- **Connexion et création de compte** (Google, e-mail, Apple) : impossibles hors ligne. Sans session
  stockée, l'app reste sur l'arrivée ; avec une session stockée, voir « Session » ci-dessus.
- **Changement de classe ou de programme** : interdit hors ligne (lot C). Le bouton Enregistrer de
  l'écran de choix de classe ouvre une feuille du bas « Tu es hors ligne » et rien n'est écrit : le
  planning et le pack sont recalculés pour la nouvelle classe, ce qui demande le serveur.
- **Paiements** : pass (Mobile Money, Chariow, achats intégrés), codes promo. Gardés par
  `useGardeReseau` : message « Connexion nécessaire », rien n'est débité ni présenté comme réussi.
- **Questions et correction photo par IA** : la question peut être préparée, l'envoi et la correction
  attendent le réseau (file d'attente des sorties). La dépense de crédits est gardée de la même façon.
- **Solde de crédits** : le dernier solde connu s'affiche hors ligne ; toute dépense exige le serveur.
- **Recalcul du planning** (changement de temps par jour, de classe, de série) : en ligne seulement ;
  hors ligne, le planning affiché est la copie, avec les coches en attente posées dessus.
- **Parcourir au-delà de son programme** : le pack ne contient que le programme du profil (niveau,
  pays, concours ou classe). Un autre niveau, ou le catalogue complet des annales, demande le réseau.
- **Réception des notifications push** : impossible pendant la coupure, par nature ; le centre reste
  consultable sur sa copie.

## Hors périmètre de cet audit

- **TOEIC / certifications** : zone tenue par un autre développeur. Des copies locales existent
  (`cert.cache.*`, lues par `lireAvecCopie`) mais leur couverture hors ligne n'a pas été auditée ici.
- **Site web (PWA)** : décision produit du 22 octobre 2026 (issue #54 fermée `not_planned`) — le site
  est fait pour l'usage en ligne, le hors ligne passe par les apps natives.

## Limites connues

- **Expiration du contenu** : au-delà de 7 jours sans contact serveur, le contenu gardé n'est plus
  servi ; l'élève doit se reconnecter une fois. C'est un choix (issue #13), pas une panne.
- **Pack lié au profil** : après un changement de classe fait en ligne, le nouveau programme n'est
  pas téléchargé automatiquement ; l'élève relance le téléchargement depuis la page Hors ligne.
- **Corrigés dans le pack** : le corrigé d'un exercice n'est téléchargé que si le pass est actif ou
  le corrigé déjà ouvert ; l'énoncé l'est toujours.
