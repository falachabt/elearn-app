# Configuration de PostHog pour Elearn Prepa : ce qui est réglé, pourquoi, et ce qui ne l'est pas

Mise à jour du 13 octobre 2026. Projet PostHog « Elearn Prepa » (321203, région US). Règles de vie privée respectées partout : pas d'e-mail, de numéro ni de contenu de question ; aucune lecture de l'écran de l'élève.

## Configuré

| Élément | Ce qui a été fait | Pourquoi |
| --- | --- | --- |
| Tableaux de bord | 9 tableaux complets, un par usage (voir `tableaux-de-bord.md`) | Une question de décision par tableau, au lieu de graphiques épars : acquisition, argent, rétention, crédits, parrainage, IA, technique, rappels, publics. |
| Actions | 7 : Paiement confirmé (app ou serveur), Intention d'achat, Apprentissage terminé, Partage ou recommandation, Échec technique ou métier, Retour par un rappel, Élève activé | Regrouper des évènements proches en un seul indicateur réutilisable dans les entonnoirs. « Paiement confirmé » réunit l'évènement de l'app et celui du serveur, donc l'entonnoir reste juste quand le serveur sera branché. |
| Cohortes | 6 : Invités, Comptes créés, Avec un Pass actif, Candidats aux concours, Élèves du secondaire, Cameroun (pays choisi) | Comparer des publics sans refaire le filtre à chaque fois. Elles reposent sur les propriétés de la personne (`invite`, `pass_actif`, `statut`, `pays`), jamais sur une donnée personnelle. |
| Définitions d'évènements | Description et étiquette de parcours (acquisition, activation, monétisation, rétention, engagement, crédits, IA, croissance, qualité, serveur, hors-ligne, vie-privée) sur les évènements clés, y compris ceux pas encore reçus | Que chacun comprenne un évènement sans ouvrir le code. Les étiquettes permettent de filtrer le catalogue par étape du parcours. |
| Annotation | Le 13 octobre 2026, 16 h 19 UTC : « Suivi PostHog complet livré (app 3.1.0) » | Marquer le jour où la mesure change : sans cela, une hausse d'évènements après cette date se lirait comme un changement de comportement. |
| Fuseau du projet | Africa/Douala (était UTC) | Les graphiques par jour et par semaine suivent la journée de l'élève ; la mission du jour et la recharge du lundi y sont comptées au bon jour. |
| Suivi d'erreurs | Exceptions JavaScript, refus de promesse et erreurs d'écran, avec écran, version et plateforme (réglage de l'app) ; graphiques dans le tableau 7 | Voir tout de suite si une version casse un écran, sans attendre un message d'élève. |
| Entrepôt de données (Supabase) | SQL et pas-à-pas prêts (`entrepot-postgres.sql`, `entrepot-postgres.md`) ; la source se crée à la main, avec le mot de passe saisi par Benny | Croiser le comportement avec les ventes et les crédits réels de la base, sans exposer de donnée personnelle. |

## Volontairement non configuré

| Élément | Raison |
| --- | --- |
| Rejeu de session (replay) | Sur mobile, il faut un module natif PostHog et un nouvel APK, et il filme l'écran de l'élève : risque pour la vie privée (questions, photos de devoirs). Le projet garde ses réglages hérités du web (masquage par défaut), sans rien activer pour l'app mobile. À rouvrir seulement avec un APK dédié et un masquage de tous les champs. |
| Journaux (logs) | L'app n'envoie pas de journaux console : le SDK y écrit ses propres échecs d'envoi hors ligne, ce qui ferait grossir la file. Les erreurs utiles passent par le suivi d'erreurs et le journal local de l'app. |
| Cartes de chaleur (heatmaps) | Elles reposent sur les clics d'une page web. L'app suit des écrans et des boutons nommés ; une carte de chaleur n'aurait pas de sens sur mobile. |
| Web analytics | Il lit `$pageview`, que l'app n'envoie pas (elle envoie `$screen`). Les pages vues se lisent dans le tableau 3 (écrans les plus vus). |
| Sondages (surveys) | Désactivés dans le SDK (`disableSurveys`) : un sondage dans l'app demande un écran conçu et une maquette (règle de design), et risque de poser des questions personnelles. À proposer plus tard, par écran validé. |
| Drapeaux de fonctionnalité et expériences | Aucun besoin tant que l'app n'a pas de test à mener ; le SDK ne charge pas les drapeaux au démarrage (économie de données mobiles). À activer pour couper une fonctionnalité à distance ou pour tester une offre, quand le sujet se présente. |
| Alertes et destinations (e-mail, Slack, webhook) | Aucune destination n'existe (pas de Slack relié) et je n'envoie pas d'e-mails récurrents à Benny sans son accord. À créer quand Benny choisit où recevoir les alertes (propositions : plus de 20 exceptions par jour, taux d'échec de paiement, durée IA p95). |
| Workflows | Aucun message sortant n'est prévu depuis PostHog : les notifications et WhatsApp passent par Supabase et Kapso. |
| Crashs natifs (Java, Kotlin, C++) | Demandent `@posthog/react-native-plugin`, donc un nouvel APK (AGENTS.md §17). Les exceptions JavaScript, qui sont la grande majorité des erreurs d'une app Expo, sont couvertes. |

## À décider par Benny

1. Où recevoir les alertes (e-mail ou Slack), pour créer les trois alertes proposées.
2. Un APK dédié pour ajouter les crashs natifs, si besoin.
3. Brancher la base Supabase : lancer le SQL, puis créer la source (3 gestes, voir `entrepot-postgres.md`).
