# Schéma de scènes (étape 1)

Chaque phrase d'un script peut porter une scène explicite. Sans scène, le pipeline utilise l'écran par défaut (titre, étape, phrase, formule) calculé à partir du texte.

```json
{"id": "p012", "dit": "...", "texte": "...", "pause": 1.0,
 "scene": {"type": "graphique-parabole", "params": {"a": 1, "b": -4, "c": 3}}}
```

## Types enregistrés (scenes.py, REGISTRE)
| type | statut | paramètres obligatoires | gabarit |
| --- | --- | --- | --- |
| titre | statique | titre | lecon.html / lecon-16x9.html |
| formule | statique | tex | idem |
| etape | statique | tex (liste) | idem |
| cas | statique | actif (0, 1 ou 2) | idem |
| recap | statique | etapes | idem |
| phrase | statique | texte | idem |
| graphique-parabole | dynamique | a, b, c | dynamique/cas-maths.js |
| mouvement-chute | dynamique | hauteur_m | dynamique/cas-physique.js |
| reaction-neutralisation | dynamique | (aucun) | dynamique/cas-chimie.js |
| dialogue-2-voix | dynamique | repliques (liste de locuteur, texte) | dynamique/cas-anglais.js |

## Règles de validation
- Type inconnu : refusé.
- Paramètre obligatoire manquant ou de mauvais type : refusé.
- Une scène dynamique doit être liée à au moins une phrase dont la durée sert de référence (les phases se calent sur les temps de phrases).
- Un script dont une scène est refusée ne se rend pas (statut « à corriger »).

## Ce qui reste hors schéma
- La décision de quel type utiliser pour une leçon : règles simples aujourd'hui, classement par modèle plus tard, toujours relu.

---

# Catalogue de scènes (étape 1 bis, 23 octobre 2026)

Objectif : couvrir la variété réelle des cours sans qu'aucun cours ne soit bloqué. Une scène = un gabarit (fichier HTML ou JS) + une entrée dans `REGISTRE` de `scenes.py`. Ajouter une scène ne touche pas aux autres.

## Ce que dit l'inventaire (état au 23/10)
- Base : 1 164 leçons en tête pour une seule catégorie, environ 4 700 leçons au total, durée moyenne de lecture de 3 à 4 min, 8 à 11 min pour deux catégories (sources : `courses_content.reading_time_minutes`, lecture seule).
- Blocs de l'éditeur (code `elearn/src/components/editor`) : paragraphe, titres 1 à 3, listes à puces, numérotées et à cocher, citation, bloc de code, image, tableau, colonnes multiples, bloc mathématique (`math`, LaTeX) et formule en ligne (`inlineMath`).
- Ce que le code ne dit pas : la fréquence réelle de chaque type de bloc. Elle viendra de l'export décodé (étape 3, `pipeline/export_lecons.py`). Les priorités ci-dessous sont donc provisoires et seront recalées sur cet échantillon.

## Légende
- Automatisable : **oui** (le gabarit suffit), **partiel** (il faut une relecture du contenu ou du paramètre), **non** (trop libre, passe par la scène de secours).
- Difficulté : **facile**, **moyenne**, **élevée** (animation géométrique ou physique).
- Statut : **fait** (gabarit et test), **à faire**.

## Familles et scènes

### 1. Texte et définition
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `titre` | titre | oui | facile | fait |
| `phrase` | texte | oui | facile | fait |
| `definition` | terme, texte, exemple (facultatif) | oui | facile | à faire |
| `points-cles` | liste de points, apparition un par un | oui | facile | à faire |

### 2. Formules et démonstrations
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `formule` | tex | oui | facile | fait |
| `demonstration` | liste d'étapes LaTeX, une par une | oui | moyenne | fait (`etape`) |
| `cas` | actif (0, 1, 2) | oui | facile | fait |
| `recap` | etapes | oui | facile | fait |
| `formule-en-ligne` | tex, texte autour | partiel | facile | à faire |

### 3. Tableaux, listes, comparaisons
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `tableau` | en-têtes, lignes, ligne surlignée (facultatif) | oui | facile | à faire |
| `comparaison` | deux colonnes, critères | oui | facile | à faire |
| `qcm-rappel` | question, options, réponse (la réponse apparaît à la fin) | oui | facile | à faire |

### 4. Schémas et frises
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `schema-annote` | image de fond, flèches et étiquettes avec coordonnées | partiel | moyenne | à faire |
| `frise-chronologique` | dates, événements | oui | moyenne | à faire |
| `carte` | fond (SVG fourni), zones à colorer | partiel | élevée | à faire |

### 5. Mathématiques
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `graphique-fonction` | expression, intervalle, points remarquables | oui | moyenne | fait (`graphique-parabole`, à généraliser) |
| `geometrie-figure` | points, segments, aire ou angle à montrer | partiel | élevée | à faire |
| `vecteur` | coordonnées, somme ou produit | oui | moyenne | à faire |
| `statistiques-histogramme` | classes, effectifs | oui | facile | à faire |
| `suite-escalier` | expression de la suite, premiers termes | oui | moyenne | à faire |

### 6. Physique
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `mouvement-chute` | hauteur_m | oui | moyenne | fait |
| `vecteurs-forces` | forces (direction, intensité) | oui | élevée | à faire |
| `circuit-electrique` | composants, branchement | partiel | élevée | à faire |
| `graphique-mouvement` | x(t) ou v(t), courbe qui se trace | oui | moyenne | à faire |

### 7. Chimie
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `reaction-neutralisation` | (aucun) | oui | moyenne | fait |
| `equation-reaction` | réactifs, produits, coefficients | oui | moyenne | à faire |
| `molecule` | formule, liaisons (SVG) | partiel | élevée | à faire |

### 8. Vivant et anatomie
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `cycle` | étapes en boucle (cycle cellulaire, azote) | oui | moyenne | à faire |
| `schema-annote` | voir famille 4 | partiel | moyenne | à faire |

### 9. Langues et grammaire
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `dialogue-2-voix` | repliques (locuteur, texte) | oui | moyenne | fait |
| `conjugaison` | verbe, temps, tableau animé | oui | facile | à faire |
| `vocabulaire-image` | mot, image, traduction | partiel | facile | à faire |

### 10. Scène de secours
| scène | paramètres | automatisable | difficulté | statut |
| --- | --- | --- | --- | --- |
| `secours-generique` | titre, texte, image (facultative), points clés | oui | facile | à faire, priorité 1 |

**Rôle** : toute leçon dont le bloc ou le type n'est pas couvert passe ici. Elle affiche le titre, le texte de la phrase, l'image si elle existe, et les points clés apparaissent un par un. Elle ne montre jamais de contenu absent du cours : pas d'animation inventée. Un cours ne peut donc jamais être bloqué, il est seulement moins animé.

## Règles d'architecture
- Une scène = un gabarit + une entrée de `REGISTRE` (paramètres obligatoires, statique ou dynamique) + un test.
- Une scène inconnue est refusée au rendu, sauf si la phrase donne un type de secours.
- Les scènes statiques passent par `lecon.html` ou `lecon-16x9.html`. Les dynamiques ont leur fichier dans `gabarits/dynamique/` et partagent le même contrat : `init`, `frame(t)`.

## Priorités (provisoires, à recaler sur l'export décodé)
1. `secours-generique` : rend tout cours possible.
2. `definition`, `points-cles`, `tableau`, `qcm-rappel` : texte et structure, les plus fréquents dans une base de cours.
3. `graphique-fonction` (généraliser `graphique-parabole`), `vecteur`, `graphique-mouvement`, `equation-reaction` : les animations à forte valeur.
4. `geometrie-figure`, `schema-annote`, `molecule`, `carte`, `circuit-electrique` : plus lourdes, après l'échantillon.
