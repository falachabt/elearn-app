# Séries de la séance du jour : annonce alignée sur le servi (écart I-4) — implémentation

- Date : 25 octobre 2026, 23 h 42 UTC (26 octobre à Paris)
- Auteur : Muse
- État : fait
- Prise : `2026-10-25-2324-claude-series-seance-i4-prise.md`
- Zones touchées : `src/services/certification/serie.ts`, `src/components/certification/SeanceDuJour.tsx`, tests. Commits locaux sur kw792g, **aucun push** (push groupé décidé par Benny).

## Ce qui a été fait

**Recensement** (détail dans la prise) : un seul endroit annonçait le budget au lieu du servi — l'aide du bloc « Une série » de l'écran Séance du jour (D2). La carte « Série interrompue » de l'accueil et les écrans de série/pendant/après affichaient déjà le nombre réel (`questions.length`) ; ils sont inchangés. Les séries mixtes et par notion (Réviser) n'annoncent aucun nombre avant le départ : inchangées.

**Mécanisme** : nouvelle aide `longueurSerieAnnoncee(partie, budget, reglages)` dans `src/services/certification/serie.ts` (constante `BUDGET_SERIE_BASE = 10`) :

- au budget de base (10 — séance de 20 minutes, durée par défaut et recommandée), elle rend la longueur servie de la partie via l'aide existante `longueurMiniServie` (réglage serveur `test_mini_length_by_part`) : **12 pour les parties 3, 4 et 6, 10 pour les autres** — la même règle que le chantier serveur applique à `cert_series_get` ;
- aux budgets 5 et 15, elle rend le budget (écart assumé ci-dessous).

`SeanceDuJour.tsx` chargeait déjà les réglages : l'aide du bloc série passe par cette fonction. Le lancement est inchangé (la `taille` transmise à l'écran de série reste le budget : c'est le serveur qui sert la longueur de la partie). Aucun texte fr/en modifié : la clé `certification.seanceJour.serieAide` était déjà paramétrée.

## Écart restant, assumé

Budgets 5 et 15 annoncés au budget. À ces budgets, le serveur sert le maximum atteignable en groupes entiers sous le budget (partie 6 : 4 au budget 5, 12 au budget 15), qui dépend des tailles de groupes de la banque — non servies à l'app. Le fermer exigerait un réglage serveur par partie et par budget (hors périmètre app de ce chantier). Justification complète dans l'échange de prise.

## Tests et validation

- Unitaires (`serie.test.ts`, +3) : budget de base → 12 pour P3/P4/P6, 10 sinon ; budgets 5/15 → budget rendu pour les sept parties ; réglage absent → 10.
- Composant (`accueil.test.tsx`, bloc D2, +2) : bloc série Partie 6 au budget 10 → aide « Partie 6 · 12 questions » (et pas « 10 questions ») ; au budget 5 → « Partie 6 · 5 questions ».
- `npm run valider` complet **vert (exit 0)** : typage, ESLint, Jest **234 suites / 2 595 tests** (2 590 + 5 nouveaux), export Android Hermes.

## Captures (vérifiées visuellement)

Démo Playwright (réglage `test_mini_length_by_part` présent dans `demo/reglages.json`) dans `~/workspace/captures-series-i4/` (+ script `capturer-seance-serie.js`) : [seance-serie-partie6-390-clair.png](sandbox://workspace/captures-series-i4/seance-serie-partie6-390-clair.png) · [seance-serie-partie6-390-sombre.png](sandbox://workspace/captures-series-i4/seance-serie-partie6-390-sombre.png) — le bloc « Une série » annonce « Partie 6 · 12 questions » dans les deux thèmes. La séance est semée dans le stockage local de la démo (bloc série Partie 6 au budget de base, séance gardée comme l'app la conserve entre deux ouvertures) : la composition propre de la démo choisit sa partie selon sa maîtrise semée, sans garantir la partie 6.
