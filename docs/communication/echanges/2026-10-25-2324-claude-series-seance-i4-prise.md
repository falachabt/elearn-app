# Séries de la séance du jour : annonce alignée sur le servi (écart I-4) — prise

- Date : 25 octobre 2026, 23 h 24 UTC (26 octobre à Paris)
- Auteur : Muse
- État : pris
- Zones touchées : `src/services/certification/serie.ts` (nouvelle aide d'annonce), `src/components/certification/SeanceDuJour.tsx` (aide du bloc série), tests (`src/services/certification/__tests__/serie.test.ts`, `src/components/certification/__tests__/accueil.test.tsx`). Aucun autre écran.
- Origine : écart I-4 de l'audit de cohérence des formats (`2026-10-25-2224-claude-audit-coherence-formats-tests.md`, § I-4) ; décision de Benny du 26 octobre 2026 : tout corriger. Côté serveur, un chantier parallèle aligne `cert_series_get` sur la règle des minis ; ce chantier est le pendant **côté app uniquement**.

## Recensement : qui annonce quoi, aujourd'hui

| Endroit | Nombre annoncé | Source |
| --- | --- | --- |
| Bloc « Une série » de l'écran Séance du jour (D2, `SeanceDuJour.tsx`) | `Partie {partie} · {n} questions` avec n = `b.nombre`, c'est-à-dire le **budget** du réglage `session_budget.series` (5, 10 ou 15 selon la durée de séance) | composition de la séance (`BlocServi.serie.nombre`) |
| Carte « Série interrompue » de l'accueil (`AccueilToeic.tsx`) | `n = serie.questions.length` — le **réel servi** | état local de la série |
| Écran de série pendant la série (`Serie.tsx`) et fin de série (`FinSerie.tsx`) | compteurs sur `etat.questions.length` / le résumé — le **réel servi** | état local |

Le seul mensonge est donc l'aide du bloc de la séance du jour : elle promet le budget. Avant le chantier serveur, pour une partie 6 au budget 10, la séance annonçait 10 et servait 8 ; après l'alignement serveur (règle des minis), elle annoncerait toujours 10 et servira 12. Dans les deux sens, l'annonce au budget est fausse pour les parties 3, 4 et 6.

## Mécanisme retenu

Nouvelle aide `longueurSerieAnnoncee(partie, budget, reglages)` dans `src/services/certification/serie.ts` :

- **Budget de base (10)** — le cas des séances de 20 minutes, durée par défaut et recommandée : l'annonce est la longueur servie de la partie, lue dans le réglage serveur `test_mini_length_by_part` via l'aide existante `longueurMiniServie` — **12 pour les parties 3, 4 et 6, 10 pour les autres**. C'est exactement la règle que le chantier serveur applique à `cert_series_get` à ce budget.
- **Budgets 5 et 15** : l'annonce reste le budget (voir écart assumé ci-dessous).

L'écran `SeanceDuJour` charge déjà les réglages (`obtenirReglages`) : l'aide du bloc série passe par `longueurSerieAnnoncee(b.partie, b.nombre, reglages)`. Le lancement de la série est inchangé (`taille = b.nombre` transmise à l'écran de série : c'est le serveur qui sert la longueur de la partie). Aucun texte fr/en ne change : la clé `certification.seanceJour.serieAide` est déjà paramétrée (`{{n}}`).

## Écart assumé : budgets 5 et 15 annoncés au budget

À ces budgets, le serveur sert le **maximum atteignable en groupes entiers** sous le budget (partie 6 : 4 questions au budget 5, 12 au budget 15 ; parties 3 et 4 : 3 au budget 5, 15 au budget 15). Ce nombre dépend des tailles de groupes de chaque partie dans la banque — une donnée que l'app ne reçoit pas (le réglage `test_mini_length_by_part` ne donne que la longueur au budget de base). Le dériver proprement exigerait un nouveau réglage serveur (longueurs de série par partie et par budget) : hors du périmètre « app uniquement » de ce chantier. L'annonce reste donc le budget pour 5 et 15, comme aujourd'hui — écart connu, borné aux séances de 10 et 30 minutes, et signalé ici plutôt que masqué par une formule devinée.

## Tests

- Unitaire (`serie.test.ts`) : `longueurSerieAnnoncee` — budget 10 → 12 pour les parties 3, 4, 6 et 10 pour les autres (réglages du seed) ; budgets 5 et 15 → budget rendu tel quel pour toutes les parties ; réglage absent → 10 au budget de base.
- Composant (`accueil.test.tsx`, bloc D2) : séance dont le bloc série est en partie 6 au budget 10 → aide « Partie 6 · 12 questions » ; partie 6 au budget 5 → aide « Partie 6 · 5 questions » (annonce au budget, assumée).

## Captures

Recette Playwright sur la démo (réglage `test_mini_length_by_part` présent dans `demo/reglages.json`) : écran Séance du jour avec un bloc série Partie 6 au budget de base annonçant « 12 questions », clair et sombre, dans `~/workspace/captures-series-i4/`. Séance semée dans le stockage local de la démo (la composition de la démo choisit sa partie selon sa maîtrise semée, qui ne garantit pas la partie 6).

## Hors périmètre

- L'alignement de `cert_series_get` lui-même (chantier serveur parallèle).
- Les séries mixtes et par notion lancées depuis Réviser : elles ne passent pas par le bloc de séance et n'annoncent aucun nombre avant le départ (l'écran de série affiche le réel servi) — rien à corriger, vérifié dans le recensement.
- Aucun push : commits locaux, le push groupé reste décidé par Benny.
