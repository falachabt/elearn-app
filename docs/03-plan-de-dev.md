# Plan de développement et état d'avancement

Source : document « Plan de développement — nouvelle app Elearn Prepa » (doc Claude privé du projet, fil « Plan de développement », 30/09/2026) et passation `/mnt/project-files/suivi/dev.md`. État au **30/09/2026 17:30**. Mets ce fichier à jour à chaque étape terminée (petit commit).

## Principes

- On construit dans l'ordre du parcours qui fait vendre : premier résultat sans compte, puis paiement, puis ce qui fait revenir l'élève.
- **Une tâche = une PR courte** en brouillon ; Benny teste sur son téléphone (OTA canal `preview`) puis fusionne. Rien en production sans son accord.
- La nouvelle app vit **à côté** de l'ancienne jusqu'au lancement ; même base Supabase ; **changements de base = ajouts seulement** (nouvelles tables), jamais de suppression avant la bascule.
- Le design est suffisant pour coder (guide, 48 écrans, `theme.ts`) ; Figma sert aux retouches.
- La mesure dès le premier écran (événements PostHog de la section 8 du cahier des charges).
- Claude code, Benny assiste : rythme plus rapide que prévu, dates indicatives.

## Phases

| Phase | Contenu | Dates prévues | État au 30/09 |
|---|---|---|---|
| 0 · Assainir et ouvrir les comptes | Dépôt `elearn-supabase` (migrations rejouables en local, tests), audit sécurité, comptes (Apple, Play : déjà là) | 1–11 oct. | **Faite** sauf sécurité (RLS, clés) **différée** à la phase 5 |
| 1 · Socle | Expo SDK 57, thème, polices, composants, navigation, i18n fr/en, PostHog, journal d'erreurs, CI, OTA, icônes | 12–25 oct. | **Faite** |
| 2 · Premier résultat et compte | Parcours d'arrivée (A1–A7), mini-test, score, sauvegarde, Google/Apple/Facebook/e-mail, reprise des anciens comptes, suppression du compte, capture du parrainage, Paramètres Sons | 26 oct.–8 nov. | **En grande partie faite** (voir ci-dessous) |
| 3 · Vendre | Écran des offres (500 / 2 500 / 7 500), pawaPay (réutiliser l'intégration serveur existante), droits d'accès, reçus, échecs, lien parent + page `/payer/[jeton]` du site, achat Apple sur iOS si imposé, codes promo | 9–22 nov. | À faire. **Paiements en dernier** (décision Benny) |
| 4 · Faire revenir l'élève | Mission du jour, série, cours et fiches hors ligne, annales + chrono, rappel quotidien, back-office offres/prix, **M15** (portefeuille, paliers, parrainage récompensé, partage), moments **M16** branchés | 23 nov.–13 déc. | À faire |
| 5 · Reprise des comptes, recette, stores | Reprise des comptes existants et de l'historique de paiements, test terrain 20 élèves, 10 paiements réels, **sécurité** (voir `10-avant-la-production.md`), soumission Play Store et App Store | 14–31 déc. | À faire |
| 6 · Lancement | Janvier 2027, puis lot 2 (classes, enseignant, espace parent, WhatsApp, fil des questions, classement) et lot 3 (partenaires, packs pays, annales publiques) | janv. 2027 → | À faire |

**Si on prend du retard**, on repousse dans cet ordre : mode hors ligne, mode chronométré, Facebook, fiches. On ne coupe **jamais** le premier résultat, le paiement ni le lien parent.

## Phase 2 en détail

Fait et vérifié sur le téléphone de Benny : APK preview installé, OTA reçues, feuille de mise à jour, sons, vibrations, réglages.

Fait (branches de dev, pas encore vérifié sur téléphone) :
- Connexion Google et Apple réelles, e-mail + mot de passe, e-mail de confirmation.
- Conversion invité → compte (même utilisateur, progression gardée) ; un invité qui choisit Apple ne migre pas sa progression.
- Parrainage de bout en bout (testé en local).
- A4 mini-test, A5 score, A6 invitation à sauvegarder (M1-03, M1-04, M2-05) ; table `first_results` côté Supabase.
- Connexion Facebook (M2-03), affichée quand le fournisseur est activé.
- A7 reprise des anciens comptes (M2-06) et rattachement d'une connexion sociale.
- Barres système : variante « vert Elearn » à essayer depuis les réglages.

Reste (à confirmer avec la PR #2 et le fil « Dev app mobile, reprise ») :
- Synchronisation des préférences (sons, vibrations, animations, langue) avec le profil (M16-03).
- Suppression du compte depuis l'app (M2-08) : statut à confirmer.
- Vérifications sur téléphone de tout ce qui précède.

## Branches et PR (30/09)

| Dépôt | Branche | PR | Contenu |
|---|---|---|---|
| elearn-app | `claude/project-thread-cvknuk` | #1 (brouillon) | Socle phase 1 + début phase 2 |
| elearn-app | `claude/project-thread-kw792g` | #2 (brouillon) | Suite phase 2 (fil « Dev app mobile, reprise ») |
| elearn-app | `claude/project-thread-06itfr` | cette PR docs | CLAUDE.md et `docs/` |
| elearn-supabase | `claude/project-thread-cvknuk` | #1 (brouillon) | Import du dossier supabase, tests, CI |
| elearn-supabase | `claude/project-thread-kw792g` | à confirmer | `first_results` et suite |
| elearn-site | `claude/project-thread-ldrx0b` | #5 (brouillon) | Refonte du site vitrine |

`main` des deux nouveaux dépôts ne contient que le commit initial : tout est dans les PR. Ne pas pousser sur la branche d'un autre fil.

## Suivi

Ce fichier + la passation `/mnt/project-files/suivi/dev.md` + (prévu) des issues GitHub par phase. Captures d'écran clair et sombre : `/mnt/project-files/app/apercus/`.
