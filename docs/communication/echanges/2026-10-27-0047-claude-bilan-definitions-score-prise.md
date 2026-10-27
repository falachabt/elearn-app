# Bilan des tests composés : score absent ou incohérent — prise

- Date : 27 octobre 2026 (00:47 UTC)
- Auteur : Muse
- État : pris
- Zones touchées : `src/components/certification/BilanMini.tsx`, `src/components/certification/BilanDefinition.tsx`, tests associés ; elearn-supabase : `cert_test_list_get` (migration additive par PR). Aucun écran redessiné, aucun écran Tests/Réviser/Statistiques modifié dans sa présentation.

## Signalement terrain (Benny, 27/10/2026, 01:28)

Fin d'un demi-test de lecture (définition composée, 100 questions) : l'écran de fin affiche « Score de cette tentative — Pas encore de score ». Deux minutes plus tard, le même écran de bilan affiche « Premier score — 550 — sur 495 ». Issue dédiée ouverte : elearn-app #127. Chantier dans la continuité de la chaîne score exact (#129 serveur, #82 app) — le bilan des définitions avait été signalé « non touché » à la livraison de #82.

## Diagnostic (prouvé par le code)

- Serveur (`cert_attempt_finish`, production) : demi-tests et test complet portent leur score dans `score` (demi-test : score de section par `cert_section_score`, borné 5 à 495 ; complet : total 10 à 990), et leur fourchette `score_min`/`score_max` reste toujours vide. La réponse de fin comme la colonne portent donc le score.
- App : `BilanMini` (branche définitions) alimentait `BilanDefinition` avec `fin.score_max` — `null` pour tout demi-test et tout test complet, d'où « Pas encore de score ». L'historique (T4/T7) lit la colonne `score` depuis #82 : la même tentative y affiche son score, ce qui départage — le serveur persiste et renvoie, c'est la lecture de l'écran de fin qui vise le mauvais champ.
- Le « 550 sur 495 » : 550 ne peut être ni un score de section (plafond 495) ni le `score_max` d'un demi-test (toujours vide) ; c'est la borne haute d'une fourchette (échelle totale 990) affichée comme un score, avec un dénominateur calculé `objectifMax / 2` pour toute définition non `full`, mixte compris.
- Serveur (`cert_test_list_get`) : meilleur d'une définition = `max(score_max)`, donc toujours NULL pour demi-tests et complet — `meilleurAvant` du bilan toujours `null` (« Premier score » à chaque tentative), meilleur des listes et du détail affichant « Pas encore de score » après un test terminé. `cert_test_progress_get`, lui, lit déjà la colonne `score`.

## Correctif retenu (plomberie du score uniquement)

- App : le bilan affiche le score de la tentative (`fin.score`, repli `score_max` pour d'anciens `fin` sans `score`) ; dénominateur d'échelle totale pour `full` et `mixed`, de section pour les demi-tests ; le « meilleur » transmis au relancement suit la même valeur ; prop `scoreMax` de `BilanDefinition` renommée `score`.
- Serveur : migration recréant `cert_test_list_get` avec `max(coalesce(score, score_max))` pour le meilleur, test pgTAP 24.

## Hors périmètre (inventaire transmis à Benny, maquette à valider)

Exigence de Benny du 27/10 : score + détail par partie + retour à la correction en fin de test, pour tous les types. Le bilan des définitions n'affiche aujourd'hui ni détail par partie ni accès à la correction ; `MiniRevue` lit l'état local, effacé en quittant le bilan des définitions ; T7 ne montre que les comptes par partie. Aucune implémentation de ce volet ici : maquette de parcours d'abord.
