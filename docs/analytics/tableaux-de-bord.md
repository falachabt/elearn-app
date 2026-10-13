# Tableaux de bord PostHog

Refondus le 13 octobre 2026 : les cinq petits tableaux de l'issue #17 sont remplacés par neuf tableaux complets, un par usage, qui regroupent leurs graphiques (les graphiques d'origine y ont été déplacés, aucun n'est perdu). Projet PostHog « Elearn Prepa » (321203), étiquettes `elearn-app` et `suivi-posthog`. Adresse : `https://us.posthog.com/project/321203/dashboard/<identifiant>`.

Les évènements de l'ancienne app (`nav_screen_viewed`, `Start Lesson`...) vivent dans le même projet : ces tableaux n'utilisent que les évènements de la nouvelle app (voir `dictionnaire-evenements.md`). Fuseau du projet : Africa/Douala.

| Tableau | Identifiant | Question à laquelle il répond | Graphiques |
| --- | --- | --- | --- |
| 1. Acquisition et activation | 2207468 | Qui arrive, d'où, et combien deviennent actifs ? | Actifs par jour et par semaine ; premiers lancements par plateforme et par pays du téléphone ; entonnoir d'activation ; comptes créés par méthode ; invités contre comptes |
| 2. Paiement et revenus | 2207469 | Où perd-on les paiements, et combien rentre ? | Entonnoir de paiement ; paiements par offre ; par pays ; offres vues par déclencheur ; codes promo ; entonnoir paiement par un proche ; montant confirmé par le serveur ; échecs par motif |
| 3. Engagement et rétention | 2207470 | Les élèves reviennent-ils et que consomment-ils ? | Rétention D1 D7 D30 ; cycle de vie ; fidélité (jours d'activité) ; missions (complétion, série, durée) ; écrans les plus vus ; contenus consommés |
| 4. Crédits et gamification | 2207471 | L'économie de crédits pousse-t-elle à créer un compte ou à payer ? | Dépenses par action ; épuisements ; crédits gagnés par source ; bienvenue, recharge du lundi, limites ; entonnoir crédits vers compte vers paiement ; total par jour |
| 5. Parrainage et partage | 2207472 | La recommandation fait-elle grandir l'app ? | Entonnoir filleul ; actions de parrainage ; liens partagés par canal ; écran Parrainage et récompenses ; partages et liens ouverts |
| 6. IA photo : usage et qualité | 2207473 | L'IA est-elle rapide, fiable, appréciée ? | Durée p50 et p95 (app et serveur) ; issues des photos ; part illisible ou en échec ; photos par matière ; notes ; signalements |
| 7. Qualité technique et erreurs | 2207474 | L'app est-elle saine après chaque version ? | Exceptions par jour, par version, par écran ; coupures réseau ; part d'évènements hors ligne ; échecs métier ; versions en usage |
| 8. Notifications, résumé hebdo et WhatsApp | 2207475 | Les rappels et canaux ramènent-ils les élèves ? | Reçues et ouvertes ; taux d'ouverture ; permission ; résumé hebdomadaire (entonnoir, boutons) ; WhatsApp par contexte ; support et installation web |
| 9. Par pays, classe et statut | 2207477 | Les chiffres changent-ils selon le public ? | Actifs par pays choisi, par classe, élèves contre candidats, avec ou sans Pass ; missions par classe ; conversion paiement par classe ; paiements par pays |

Les anciens tableaux de Benny (« My App Dashboard », « Engagement des apprenants », « Mobile Analytics », « Product Analytics », « Utilisateurs par pays ») viennent de l'ancienne app et n'ont pas été touchés.

## Limites connues

- Les graphiques des évènements nouveaux restent vides tant que la version qui les pose n'a pas été utilisée. Ceux du serveur (`payment_succeeded_server`, `ai_correction_server`) se rempliront après le déploiement des Edge Functions.
- La rétention porte sur `app_opened` : un invité qui crée un compte avec le même identifiant reste dans sa cohorte ; un invité qui se connecte à un autre compte est fusionné par alias.
- L'entonnoir de paiement mesure les évènements de l'app. Le chiffre d'affaires officiel se calcule dans la base (cahier des charges §8.2).
