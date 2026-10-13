# Tableaux de bord PostHog (issue #17)

Créés le 13 octobre 2026 dans le projet PostHog « Elearn Prepa » (projet 321203), étiquettes `elearn-app` et `suivi-posthog`. Les évènements de l'ancienne app (`nav_screen_viewed`, `Start Lesson`...) vivent dans le même projet : ces tableaux n'utilisent que les évènements de la nouvelle app (dictionnaire : `dictionnaire-evenements.md`).

| Tableau | Identifiant | Graphiques | Évènements |
| --- | --- | --- | --- |
| Paiement : entonnoir | 2205773 | Entonnoir en 4 étapes (fenêtre 14 jours) ; paiements réussis par offre ; lancés, réussis et échoués par pays | `paywall_viewed`, `offer_selected`, `payment_initiated`, `payment_succeeded`, `payment_failed` (propriétés `offre`, `pays`) |
| Rétention D1 D7 D30 | 2205774 | Rétention par cohorte d'ouverture (31 jours) ; cycle de vie hebdomadaire | `app_opened` |
| Parrainage | 2205775 | Entonnoir code capté, compte créé, premier paiement (30 jours) ; actions de parrainage par semaine | `referral_code_captured`, `compte_cree`, `payment_succeeded`, `referral_link_shared`, `referral_signup`, `milestone_reached`, `reward_granted`, `share_reward_claimed` |
| Performance IA photo | 2205776 | Durée de correction p50 et p95 ; photos corrigées, illisibles, en échec, limite atteinte | `photo_sent`, `photo_corrected` (`duree_s`), `photo_unreadable`, `photo_failed`, `quota_reached` |
| Mission du jour | 2205777 | Taux de complétion quotidien (terminées / commencées) ; série et durée moyennes | `mission_started`, `mission_completed` (`serie`, `duree_s`) |

Adresse d'un tableau : `https://us.posthog.com/project/321203/dashboard/<identifiant>`.

## Limites connues

- La rétention porte sur `app_opened`, calculée par identifiant utilisateur : un invité qui crée un compte avec le même identifiant reste dans sa cohorte ; un invité qui se connecte à un autre compte est fusionné par alias.
- « Récompenses réclamées contre accordées » : côté app, `reward_granted` est la trace observée par l'élève ; le versement serveur n'est pas encore émis, voir `entrepot-postgres.md`.
- L'entonnoir de paiement mesure les évènements de l'app. Le chiffre d'affaires se calcule dans la base (paiements confirmés), pas dans PostHog (cahier des charges §8.2).
- Un graphique vide veut dire que l'évènement n'a pas encore été reçu depuis la version qui le pose.
