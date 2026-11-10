# Profil TOEIC : parcours d'arrivée (O1 à O4)

Maquette : `docs/maquettes/toeic-parcours-arrivee.html` (clair et sombre, quatre écrans). Demande de Benny du 15 octobre 2026 : l'onboarding d'abord, puis A1, A2… un écran validé à la fois. Liste des besoins : `/mnt/project-files/toeic/besoins-maquettes.md`, cahier : `docs/certifications/03-cahier-des-charges.md` (CERT-1 à CERT-4).

Ordre : O1 Bienvenue (trois cartes) → O2 Certification (liste, TOEIC en bas, pays) → O3 Objectif (score et date, passer possible) → O4 Arrivée sur le profil TOEIC (diagnostic proposé en premier).

## Ce qui change dans l'existant
- **O1** : une carte « Je prépare une certification » (icône `Award`) ajoutée sous les deux cartes actuelles. Textes existants inchangés.
- **O2** : écran nouveau, même gabarit que la liste des filières du concours (`ChoixConcours.tsx`). Liste servie par `cert_exams`, TOEIC en bas, pays par défaut (`paysParDefaut`).
- **O3** : objectif, reprend la partie objectif de l'écran A1 du besoin (M-C3). Paliers de score servis par le serveur.
- **O4** : premier écran du profil TOEIC, une seule action verte « Commencer le diagnostic ».

## Règles
- Aucun emoji ; icônes Lucide carrées ; tokens `theme.color.*` ; une seule action verte par écran ; tutoiement ; espaces insécables.
- Le score n'est jamais présenté comme officiel. Le diagnostic est gratuit et sans crédit.
- Mention sous O2 : « TOEIC est une marque d'ETS. Elearn Prépa n'est pas affilié à ETS. »
- Les sous-titres des cartes Élève et Concours sont des repères : reprendre les textes exacts du code.

## PostHog
`onboarding_choice_made` {profil: 'certification'} (évènement existant), `cert_exam_chosen` {examen}, `cert_goal_set` {score, date_renseignee}, `cert_goal_skipped`, `cert_diagnostic_started`.

## Questions ouvertes pour Benny
1. Le pays se choisit-il sur O2 (proposition) ou seulement au paiement ?
2. Le paiement reste-t-il possible sans objectif ? (proposition : oui)
3. Les autres examens s'ajoutent-ils dans la même liste que le TOEIC ? (proposition : oui)

## Tests
Parcours complet sans objectif ; retour arrière qui garde le choix ; liste vide (aucun examen actif) ; clair et sombre ; texte à 130 % ; lecteur d'écran sur la radio de O2.
