# Tarifs et modèle économique : certifications et écoles

Version 0.1 du 7 octobre 2026. Ce document ne contient **aucune projection financière** : le dépôt est public. Les scénarios chiffrés, les coûts et la correspondance avec le business plan sont dans une annexe privée remise à Benny (à ranger dans `elearn-supabase/docs/projet/`). Tous les prix ci-dessous sont des **propositions à valider** ; ils vivent dans la configuration serveur, jamais dans l'app.

## 1. Principe
Le modèle hybride en trois étages du business plan ne change pas :
1. **Gratuit** : ce qui coûte peu à servir (diagnostic, séries limitées, premier test).
2. **Familles et élèves** : le pass, pour ce qui coûte à chaque usage (IA, tests complets, hors ligne).
3. **Partenaires** : les écoles, qui paient pour donner l'accès à leurs élèves et suivre leur progression. Les licences sont la forme concrète de la ligne « partenaires » du plan.

## 2. Élèves et candidats (prix inchangés)

| Offre | Prix | Pour la certification |
| --- | --- | --- |
| Gratuit | 0 | Diagnostic, séries d'entraînement limitées par jour, un test blanc par semaine avec la recharge du lundi (selon coût réglé au serveur) |
| Pass semaine | 500 FCFA | Une semaine avant le test : tests et explications illimités |
| Pass mois | 2 500 FCFA | Offre principale |
| Pass six mois | 7 500 FCFA | L'offre naturelle d'une préparation de trois à six mois |

Recommandation : **les trois pass existants couvrent la certification** (décision 2 du rapport, option A). Raisons : prix déjà validés et déjà convertis, aucun nouveau produit à construire, aucun parcours de paiement de plus. L'option B (pass dédié valable jusqu'à la date du test, sur le modèle du pass concours déjà prévu dans le plan) reste possible si les premières mesures montrent que les élèves attendent la veille du test pour payer.

Contenu payant en crédits (réglé dans `credit_actions`, valeurs initiales proposées) : explication d'une question 1, demi-test 8, test complet 15, corrigé complet d'un test 5. Avec 25 crédits par lundi, un test complet par semaine reste gratuit : le gratuit sert l'audience, le pass sert ceux qui s'entraînent chaque jour.

Pas de nouveau paquet de crédits à acheter : le modèle reste « gratuit, crédits gagnés, ou pass ».

## 3. Écoles : licences

Les écoles paient une **licence** par place. Une place = un élève qui a rejoint l'école avec son propre compte.

| Produit | Pour qui | Prix proposé | Minimum | Durée |
| --- | --- | --- | --- | --- |
| Licence Secondaire | Collèges et lycées privés | 5 000 FCFA par élève | 100 places | Année scolaire |
| Licence Certification | Universités, instituts, grandes écoles, centres de langues | 7 500 FCFA par étudiant | 30 places | Cohorte de six mois |

Dégressivité de la licence Secondaire (proposition) : 5 000 FCFA de 100 à 299 places, 4 000 de 300 à 999, 3 000 à partir de 1 000.

Cohérence avec les prix individuels :
- La licence Certification est au **prix du pass six mois** : l'école ne paie pas plus cher que la famille, et aucun étudiant n'a intérêt à acheter son pass pendant que l'école paie.
- La licence Secondaire revient à environ deux mois de pass mensuel pour toute l'année scolaire : tarif de gros, cohérent avec le prix d'entrée bas qui convertit déjà.

Ce que comprend une licence : accès illimité aux contenus pour les élèves rattachés, plafond d'usage IA propre aux licences (réglage serveur), espace web de suivi (lot E1), rapport mensuel (lot E0), assistance.

Pilote : soixante jours gratuits, cinquante places au plus, pour la première école ou le premier groupe de chaque type. Objectif : mesurer l'activation des élèves et ce que l'école regarde.

Conditions de paiement proposées : moitié à la signature, moitié à trois mois, par Mobile Money (pawaPay) ou virement avec facture. L'accès s'arrête à l'échéance impayée.

Commission d'apport : le plan prévoit déjà une commission par école relais ; pour une licence signée grâce à un enseignant relais, une commission proportionnelle au montant de la première année est à fixer (décision avec Benny, chiffre dans l'annexe privée).

Entreprises : hors périmètre pour l'instant.

## 4. Ce qu'un directeur compare
- Un répétiteur ou un cours du soir coûte plus cher par mois qu'une licence par an.
- L'examen TOEIC lui-même est facturé plusieurs dizaines de milliers de FCFA par candidat : une préparation à 7 500 FCFA pèse peu dans le coût total pour l'étudiant.
- L'école obtient en plus un suivi de progression qu'un répétiteur ne fournit pas.

## 5. Risques propres au modèle
- Aucune école n'a encore été interrogée : les prix sont des hypothèses.
- Le pari du plan reste la ligne partenaires. Les licences la rendent concrète (places multipliées par un prix) mais ne prouvent rien tant qu'une première école n'a pas payé.
- iOS : une licence payée hors de l'app par une école ne passe pas par la commission de la plateforme ; vérifier la règle de publication avant les stores.
- Coût de l'IA par élève sous licence : plafonner avant de vendre (annexe privée).
- Marque du test : mention de non-affiliation obligatoire (étude certifications §6).
