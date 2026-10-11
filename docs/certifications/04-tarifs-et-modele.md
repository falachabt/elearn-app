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

Clients visés : **universités** et **écoles privées** uniquement (7 octobre). Une licence = un nombre de places ; une place = une personne qui a rejoint l'établissement avec son propre compte.

**Un seul prix de référence : 7 500 FCFA par personne.** Benny a jugé ce niveau bon ; il vaut le pass six mois, ce qui rend l'offre lisible (« un étudiant, un pass de six mois, payé par l'établissement »).

| Produit | Pour qui | Prix | Minimum | Durée |
| --- | --- | --- | --- | --- |
| Licence Certification | Universités, instituts, grandes écoles | 7 500 FCFA par étudiant | 30 places | Cohorte de six mois (dates fixées avec l'établissement) |
| Licence Établissement | Écoles privées (secondaire) | 7 500 FCFA par élève | 50 places | Année scolaire |

Remises de volume proposées, pour les gros établissements seulement : 6 500 FCFA à partir de 500 places, 5 500 à partir de 1 000. Pas de remise en dessous : le prix reste simple à annoncer.

Cohérence avec les prix individuels :
- 7 500 FCFA est exactement le prix du **pass six mois** : l'établissement ne paie pas plus cher qu'une famille, et aucun étudiant n'a intérêt à acheter son pass pendant que l'établissement paie.
- Pour une école privée, 7 500 FCFA par an représentent trois mois de pass mensuel pour toute l'année : tarif de gros, cohérent avec le prix d'entrée bas qui convertit déjà.
- La licence Établissement, vendue à l'année, est moins chère par mois que la licence Certification (six mois) : justifié par un usage plus léger (mission du jour, annales) et un plafond d'IA plus bas.

### Qui est dans l'app sous licence
Les étudiants d'une université rattachés par code arrivent **directement dans le profil Certification** et n'ont rien d'autre dans l'app. On ne compte pas sur des utilisateurs déjà présents qui changeraient de profil : l'audience de certification est **acquise séparément** (voir §6).

Ce que comprend une licence : accès illimité aux contenus pour les élèves rattachés, plafond d'usage IA propre aux licences (réglage serveur), espace web de suivi (lot E1), rapport mensuel (lot E0), assistance.

Pilote : soixante jours gratuits, cinquante places au plus, pour la première école ou le premier groupe de chaque type. Objectif : mesurer l'activation des élèves et ce que l'école regarde.

Conditions de paiement proposées : moitié à la signature, moitié à trois mois, par Mobile Money (pawaPay) ou virement avec facture. L'accès s'arrête à l'échéance impayée.

Commission d'apport : le plan prévoit déjà une commission par école relais ; pour une licence signée grâce à un enseignant relais, une commission proportionnelle au montant de la première année est à fixer (décision avec Benny, chiffre dans l'annexe privée).

Entreprises : hors périmètre pour l'instant.

## 4. Acquisition de l'audience certification (hypothèse de départ)
Hypothèse retenue : les utilisateurs de certification viennent **uniquement pour la certification**, ils ne viennent pas d'un autre profil de l'app. La vente passe donc par des canaux dédiés :
1. **Universités** : une cohorte signée apporte d'un coup 30 à 200 utilisateurs, c'est le canal principal et le plus sûr.
2. **Écoles privées** avec une classe de certification.
3. **Communication ciblée** : groupes WhatsApp et réseaux d'étudiants qui préparent le test, ambassadeurs de campus, page du site dédiée à la préparation du TOEIC.
4. **Parrainage** entre étudiants d'une même cohorte (mécanisme existant, sans récompense contre un « j'aime » ou un abonnement).

Conséquence sur le plan : aucun revenu individuel de certification n'est compté au départ ; les achats de pass par des candidats isolés sont une avance éventuelle, pas une hypothèse de financement.

## 5. Ce qu'un directeur compare
- Un répétiteur ou un cours du soir coûte plus cher par mois qu'une licence par an.
- L'examen TOEIC lui-même est facturé plusieurs dizaines de milliers de FCFA par candidat : une préparation à 7 500 FCFA pèse peu dans le coût total pour l'étudiant.
- L'école obtient en plus un suivi de progression qu'un répétiteur ne fournit pas.

## 6. Risques propres au modèle
- Aucune école n'a encore été interrogée : les prix sont des hypothèses.
- Le pari du plan reste la ligne partenaires. Les licences la rendent concrète (places multipliées par un prix) mais ne prouvent rien tant qu'une première école n'a pas payé.
- iOS : une licence payée hors de l'app par une école ne passe pas par la commission de la plateforme ; vérifier la règle de publication avant les stores.
- Coût de l'IA par élève sous licence : plafonner avant de vendre (annexe privée).
- Marque du test et origine de la banque de sujets : droits à confirmer avant de vendre le contenu à une université (étude certifications §6) ; mention de non-affiliation obligatoire.
- Audience certification entièrement à acquérir : sans cohorte signée, peu d'utilisateurs.
