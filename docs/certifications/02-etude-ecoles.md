# Étude : axe écoles (licences et espace écoles)

Date : 7 octobre 2026. Étude seulement. Entreprises : hors périmètre, non prioritaires (décision de Benny). Chiffres financiers : voir le fichier privé remis à Benny, pas dans ce dépôt public.

## 1. Le besoin

Une école veut (a) donner l'accès à Elearn Prepa à tous ses élèves ou étudiants sans que chacun paie, (b) créer et organiser ses classes, (c) voir qui travaille et qui progresse.

Trois types de clients, dans cet ordre de priorité :
1. **Établissements privés du secondaire** (collèges et lycées) : programme, annales, mission du jour, aide IA plafonnée. Profil existant « élève ».
2. **Universités, instituts et grandes écoles** : préparation à une certification (TOEIC d'abord) pour des promotions entières. Profil « certification ».
3. **Centres de langues et de préparation aux concours** : mêmes besoins, plus petits groupes.

Ce qui fait vendre : le suivi (le directeur ou l'enseignant voit la progression), l'absence de paiement individuel, et un coût par élève très inférieur à un répétiteur.

## 2. Modèle de licence

Un établissement achète une **licence** : un nombre de places pour une durée (année scolaire, ou cohorte de six mois pour une certification). Chaque place est occupée par un élève qui crée son propre compte et rejoint l'école par un code.

Pourquoi des comptes personnels et non des comptes créés par l'école :
- pas de mots de passe à gérer, pas de stock de comptes partagés ;
- l'élève garde sa progression s'il change d'école ;
- cohérent avec l'app actuelle (connexion Google ou téléphone, lien de parrainage, page `rejoindre`).

Alternative à étudier plus tard : comptes générés en lot avec un code d'accès, pour les élèves sans téléphone.

### Droits ouverts par une licence
- Accès illimité aux contenus (comme un pass), sans crédits à dépenser.
- Limite de questions IA par jour **propre aux licences**, réglée côté serveur (`school_ai_daily_limit`), plus basse que celle du pass individuel, pour tenir le coût.
- Mode hors ligne inchangé.
- Fin de licence : l'accès illimité s'arrête, le compte repasse au régime gratuit, la progression est conservée.

## 3. Espace écoles

Application **web** (pas dans l'app mobile), dans `elearn-site` (Next.js), sous un chemin réservé aux écoles. Enseignants et directeurs travaillent sur ordinateur ou sur le navigateur du téléphone.

### Rôles
| Rôle | Peut faire |
| --- | --- |
| Administrateur de l'école | Tout : places, classes, enseignants, factures, exports |
| Enseignant | Voir et gérer ses classes ; voir la progression de ses élèves ; lancer un devoir |
| Élève (dans l'app) | Rejoindre une école, voir « Mon école », rien de plus |

### Fonctions, par lot
**Lot E0 (sans développement web) : concierge.** La première école est suivie à la main : codes d'invitation, vue SQL de progression exportée en tableur, rapport mensuel envoyé par WhatsApp ou e-mail. Objectif : apprendre ce que l'école regarde vraiment avant de construire.

**Lot E1 (espace web minimal)**
- Connexion de l'administrateur (e-mail ou code envoyé).
- Tableau de bord : places utilisées, élèves actifs cette semaine, score moyen estimé.
- Classes : créer, renommer, générer un **code de classe** et un lien WhatsApp à partager.
- Liste des élèves d'une classe : dernière activité, série de jours, missions faites, score estimé.
- Retirer un élève (libère la place).
- Export CSV de la progression.

**Lot E2**
- Devoirs : demander un test blanc ou une série pour une date.
- Détail d'un élève : points faibles par compétence, courbe du score estimé.
- Bulletin PDF par élève ou par classe.
- Factures et reçus, renouvellement, paiement Mobile Money de la licence (pawaPay) ou virement avec facture.
- Import de liste d'élèves par CSV (invitations par numéro ou e-mail).

**Plus tard** : comparaison entre classes, alertes d'élèves en décrochage, classement inter-classes (déjà prévu au lot 2 : issue #38).

## 4. Données (conception)

Nouveau fichier de schéma proposé : `f_ecoles.sql`. Tables préfixées `org_`.

```
organizations      id, name, kind ('secondaire','superieur','centre'), country, city,
                   contact_name, contact_phone, contact_email, status ('pilot','active','expired'), created_at
org_members        org_id, user_id, role ('admin','teacher','student'), joined_at, left_at
org_classes        id, org_id, name, level_or_goal, exam_code nullable, created_by
org_class_members  class_id, user_id, role ('teacher','student'), joined_at
org_invites        id, org_id, class_id nullable, code (unique, court), role, max_uses, uses, expires_at, created_by
org_licenses       id, org_id, product ('school_secondary','school_certification'),
                   seats, starts_at, ends_at, price_amount, currency, status, order_id nullable
org_seat_usage     (vue) licence, places occupées, places libres
```
Droits : `entitlements` accepte aujourd'hui `source in ('purchase','reward','manual','migration')` avec un `order_id`. Il faut ajouter la source `'school'` et un `license_id` nullable. Un élève membre d'une école avec licence valide reçoit un droit dont la fin suit celle de la licence ; départ de l'élève ou fin de licence passent par `revoked_at`. Modification **additive**.

### Confidentialité (point sérieux)
- Un enseignant voit **uniquement** les élèves de ses classes ; un administrateur ceux de son école. RLS obligatoire sur chaque table `org_*`, avec tests pgTAP prouvant qu'une école ne voit jamais les élèves d'une autre.
- Données visibles à l'école : activité, scores, points faibles. **Jamais** : messages privés, questions posées dans l'entraide, achats personnels, localisation.
- L'élève voit dans Moi « Mon école » et ce qui est partagé ; il peut quitter l'école (place libérée, accès illimité arrêté).
- Élèves de moins de 18 ans : l'école atteste détenir l'accord des parents (clause du contrat de licence) ; l'écran d'adhésion informe en une phrase de ce que l'école voit. Texte juridique à faire relire.
- Effacement de compte à 30 jours : les lignes `org_*` de l'élève partent avec lui.

## 5. Impact sur l'app mobile
- `/bienvenue` : lien « J'ai un code de mon école ».
- Écran d'adhésion : saisie ou lien du code, nom de l'école et de la classe, ce que l'école voit, bouton Rejoindre. Voisin de `rejoindre` (aujourd'hui dédié au parrainage) : réutiliser le mécanisme du code, pas l'écran tel quel.
- Moi : carte « Mon école » (nom, classe, quitter).
- Accueil : si une licence est active, le compteur de crédits devient « Accès illimité grâce à ton école ».
- Crédits et pass : les feuilles d'achat n'apparaissent pas à un élève couvert par une licence.

## 6. Risques
| Risque | Parade |
| --- | --- |
| École qui tarde à payer | Paiement d'avance par moitiés (signature, puis trois mois) ; accès coupé à l'échéance |
| Élèves qui ne rejoignent pas | Suivi des places inoccupées dès la deuxième semaine ; relance par l'enseignant relais |
| Coût IA d'un usage intensif | Limite quotidienne propre aux licences, mesurée avant d'ouvrir à grande échelle |
| Fuite de données entre écoles | RLS, tests pgTAP dédiés, revue de sécurité avant la première vente |
| Vente longue | Pilote gratuit de soixante jours sur un nombre de places limité, puis licence |
| iOS | Une licence achetée hors de l'app par une école n'est pas un achat dans l'app ; vérifier la règle de la plateforme avant publication |

## 7. Ce qu'il faut valider avec de vrais directeurs
Aucun directeur d'école n'a encore été interrogé. Avant le lot E1, cinq entretiens courts : que regardent-ils, quel budget par élève, qui décide, quel moyen de paiement. Les prix du document `04` sont des hypothèses jusqu'à ces entretiens.
