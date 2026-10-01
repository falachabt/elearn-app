/**
 * Banque du mini-test d'arrivée (A4, M1-03) : 5 questions par classe ou concours, embarquées dans l'app pour que le
 * premier résultat arrive hors ligne et en moins de 2 minutes. Première version rédigée par l'équipe dev
 * (30/09/2026) ; l'agent contenu la remplacera par des questions tirées des contenus existants.
 * `bonne` est l'indice de la bonne réponse dans `choix` ; l'ordre affiché est mélangé au tirage.
 */
export type Matiere = 'maths' | 'physique' | 'chimie' | 'svt' | 'francais' | 'logique';

export type Question = {
  id: string;
  matiere: Matiere;
  chapitre: string;
  enonce: string;
  choix: readonly [string, string, string, string];
  bonne: 0 | 1 | 2 | 3;
  explication: string;
};

type Banque = Record<string, readonly Question[]>;

export const BANQUE: Banque = {
  '6e': [
    { id: '6e-1', matiere: 'maths', chapitre: 'Fractions', enonce: 'Quelle fraction est égale à 1/2 ?', choix: ['2/4', '2/3', '3/4', '1/4'], bonne: 0, explication: 'On multiplie le haut et le bas par 2 : 1/2 = 2/4.' },
    { id: '6e-2', matiere: 'maths', chapitre: 'Fractions', enonce: 'Combien font 3/10 + 4/10 ?', choix: ['7/10', '7/20', '12/10', '1/10'], bonne: 0, explication: 'Même dénominateur : on additionne les numérateurs, 3 + 4 = 7.' },
    { id: '6e-3', matiere: 'maths', chapitre: 'Nombres décimaux', enonce: 'Quel nombre est le plus grand ?', choix: ['2,45', '2,5', '2,405', '2,09'], bonne: 1, explication: 'On compare les dixièmes : 2,5 a 5 dixièmes, les autres 4 ou 0.' },
    { id: '6e-4', matiere: 'maths', chapitre: 'Nombres décimaux', enonce: 'Combien font 3,6 × 10 ?', choix: ['36', '0,36', '360', '3,06'], bonne: 0, explication: 'Multiplier par 10 décale la virgule d’un rang vers la droite.' },
    { id: '6e-5', matiere: 'maths', chapitre: 'Périmètres', enonce: 'Quel est le périmètre d’un carré de 5 cm de côté ?', choix: ['20 cm', '25 cm', '10 cm', '15 cm'], bonne: 0, explication: 'Un carré a 4 côtés égaux : 4 × 5 = 20 cm.' },
  ],
  '5e': [
    { id: '5e-1', matiere: 'maths', chapitre: 'Priorités opératoires', enonce: 'Combien font 2 + 3 × 4 ?', choix: ['14', '20', '24', '9'], bonne: 0, explication: 'La multiplication passe avant : 3 × 4 = 12, puis 2 + 12 = 14.' },
    { id: '5e-2', matiere: 'maths', chapitre: 'Priorités opératoires', enonce: 'Combien font (8 − 3) × 2 ?', choix: ['10', '2', '13', '5'], bonne: 0, explication: 'Les parenthèses d’abord : 8 − 3 = 5, puis 5 × 2 = 10.' },
    { id: '5e-3', matiere: 'maths', chapitre: 'Nombres relatifs', enonce: 'Combien font −5 + 8 ?', choix: ['3', '−3', '13', '−13'], bonne: 0, explication: 'Signes différents : 8 − 5 = 3, et on garde le signe du plus grand, +.' },
    { id: '5e-4', matiere: 'maths', chapitre: 'Nombres relatifs', enonce: 'Quel nombre est le plus petit ?', choix: ['−7', '−2', '0', '3'], bonne: 0, explication: 'Parmi les négatifs, le plus petit est le plus loin de zéro : −7.' },
    { id: '5e-5', matiere: 'maths', chapitre: 'Triangles', enonce: 'Dans un triangle, deux angles mesurent 50° et 60°. Combien mesure le troisième ?', choix: ['70°', '80°', '90°', '110°'], bonne: 0, explication: 'La somme des angles vaut 180° : 180 − 50 − 60 = 70°.' },
  ],
  '4e': [
    { id: '4e-1', matiere: 'maths', chapitre: 'Puissances', enonce: 'Combien vaut 2³ ?', choix: ['8', '6', '9', '5'], bonne: 0, explication: '2³ = 2 × 2 × 2 = 8.' },
    { id: '4e-2', matiere: 'maths', chapitre: 'Puissances', enonce: 'À quoi est égal 10⁻² ?', choix: ['0,01', '0,1', '−100', '−20'], bonne: 0, explication: '10⁻² = 1/10² = 1/100 = 0,01.' },
    { id: '4e-3', matiere: 'maths', chapitre: 'Calcul littéral', enonce: 'Développe 3(x + 2).', choix: ['3x + 6', '3x + 2', 'x + 6', '3x + 5'], bonne: 0, explication: 'On multiplie chaque terme par 3 : 3 × x + 3 × 2 = 3x + 6.' },
    { id: '4e-4', matiere: 'maths', chapitre: 'Calcul littéral', enonce: 'Réduis 4x + 3x.', choix: ['7x', '12x', '7x²', '7'], bonne: 0, explication: 'On additionne les coefficients : 4 + 3 = 7, donc 7x.' },
    { id: '4e-5', matiere: 'maths', chapitre: 'Théorème de Pythagore', enonce: 'Un triangle rectangle a des côtés de l’angle droit de 3 cm et 4 cm. Combien mesure l’hypoténuse ?', choix: ['5 cm', '7 cm', '6 cm', '12 cm'], bonne: 0, explication: '3² + 4² = 9 + 16 = 25, et √25 = 5 cm.' },
  ],
  '3e': [
    { id: '3e-1', matiere: 'maths', chapitre: 'Équations du 1er degré', enonce: 'Résous : 2x + 3 = 11', choix: ['x = 3', 'x = 4', 'x = 7', 'x = 8'], bonne: 1, explication: 'On retire 3 des deux côtés : 2x = 8, donc x = 4.' },
    { id: '3e-2', matiere: 'maths', chapitre: 'Équations du 1er degré', enonce: 'Résous : 5x − 2 = 3x + 6', choix: ['x = 4', 'x = 2', 'x = 1', 'x = 8'], bonne: 0, explication: 'On regroupe les x : 5x − 3x = 6 + 2, donc 2x = 8 et x = 4.' },
    { id: '3e-3', matiere: 'maths', chapitre: 'Fractions', enonce: 'Combien font 2/3 × 3/4 ?', choix: ['1/2', '6/7', '5/7', '8/9'], bonne: 0, explication: 'On multiplie haut et bas : 6/12, qui se simplifie en 1/2.' },
    { id: '3e-4', matiere: 'maths', chapitre: 'Fractions', enonce: 'Combien font 1/2 + 1/3 ?', choix: ['5/6', '2/5', '1/5', '2/6'], bonne: 0, explication: 'Même dénominateur 6 : 3/6 + 2/6 = 5/6.' },
    { id: '3e-5', matiere: 'maths', chapitre: 'Fonctions', enonce: 'Pour f(x) = 2x − 1, combien vaut f(3) ?', choix: ['5', '6', '7', '1'], bonne: 0, explication: 'On remplace x par 3 : 2 × 3 − 1 = 5.' },
  ],
  '2nde': [
    { id: '2nde-1', matiere: 'maths', chapitre: 'Identités remarquables', enonce: 'Développe (x + 3)².', choix: ['x² + 6x + 9', 'x² + 9', 'x² + 3x + 9', '2x + 6'], bonne: 0, explication: '(a + b)² = a² + 2ab + b² : x² + 2 × 3 × x + 9.' },
    { id: '2nde-2', matiere: 'maths', chapitre: 'Identités remarquables', enonce: 'Factorise x² − 16.', choix: ['(x − 4)(x + 4)', '(x − 4)²', '(x − 8)(x + 8)', 'x(x − 16)'], bonne: 0, explication: 'a² − b² = (a − b)(a + b), avec b = 4 car 4² = 16.' },
    { id: '2nde-3', matiere: 'maths', chapitre: 'Fonctions affines', enonce: 'Quel est le coefficient directeur de la droite y = 3x − 2 ?', choix: ['3', '−2', '2', '1/3'], bonne: 0, explication: 'Pour y = ax + b, le coefficient directeur est a, ici 3.' },
    { id: '2nde-4', matiere: 'maths', chapitre: 'Fonctions affines', enonce: 'Pour quelle valeur de x a-t-on 3x − 2 = 0 ?', choix: ['2/3', '3/2', '−2/3', '2'], bonne: 0, explication: '3x = 2, donc x = 2/3.' },
    { id: '2nde-5', matiere: 'maths', chapitre: 'Vecteurs', enonce: 'Avec A(1 ; 2) et B(4 ; 6), quelles sont les coordonnées du vecteur AB ?', choix: ['(3 ; 4)', '(5 ; 8)', '(−3 ; −4)', '(4 ; 3)'], bonne: 0, explication: 'On fait B − A : (4 − 1 ; 6 − 2) = (3 ; 4).' },
  ],
  '1re': [
    { id: '1re-1', matiere: 'maths', chapitre: 'Second degré', enonce: 'Quel est le discriminant de x² − 4x + 3 ?', choix: ['4', '28', '−8', '16'], bonne: 0, explication: 'Δ = b² − 4ac = 16 − 12 = 4.' },
    { id: '1re-2', matiere: 'maths', chapitre: 'Second degré', enonce: 'Quelles sont les solutions de x² − 4x + 3 = 0 ?', choix: ['1 et 3', '−1 et −3', '2 seulement', '0 et 4'], bonne: 0, explication: 'Δ = 4 : x = (4 − 2)/2 = 1 et x = (4 + 2)/2 = 3.' },
    { id: '1re-3', matiere: 'maths', chapitre: 'Dérivation', enonce: 'Quelle est la dérivée de f(x) = x³ ?', choix: ['3x²', 'x²', '3x', '3x³'], bonne: 0, explication: '(xⁿ)’ = n xⁿ⁻¹, donc 3x².' },
    { id: '1re-4', matiere: 'maths', chapitre: 'Dérivation', enonce: 'Quelle est la dérivée de f(x) = 5x² − 2x ?', choix: ['10x − 2', '5x − 2', '10x² − 2', '10x'], bonne: 0, explication: '(5x²)’ = 10x et (−2x)’ = −2.' },
    { id: '1re-5', matiere: 'maths', chapitre: 'Suites', enonce: 'Suite arithmétique : u₀ = 2 et raison 3. Combien vaut u₄ ?', choix: ['14', '11', '12', '162'], bonne: 0, explication: 'uₙ = u₀ + n × r : 2 + 4 × 3 = 14.' },
  ],
  Tle: [
    { id: 'tle-1', matiere: 'maths', chapitre: 'Exponentielle et logarithme', enonce: 'Quelle est la dérivée de eˣ ?', choix: ['eˣ', 'x eˣ⁻¹', 'ln x', '1/x'], bonne: 0, explication: 'L’exponentielle est sa propre dérivée.' },
    { id: 'tle-2', matiere: 'maths', chapitre: 'Exponentielle et logarithme', enonce: 'Combien vaut ln(e³) ?', choix: ['3', 'e³', '1/3', '3e'], bonne: 0, explication: 'ln et exp sont réciproques : ln(e³) = 3.' },
    { id: 'tle-3', matiere: 'maths', chapitre: 'Limites', enonce: 'Quelle est la limite de 1/x quand x tend vers +∞ ?', choix: ['0', '+∞', '1', '−∞'], bonne: 0, explication: 'Quand x devient très grand, 1/x devient très petit : la limite est 0.' },
    { id: 'tle-4', matiere: 'maths', chapitre: 'Limites', enonce: 'Quelle est la limite de eˣ quand x tend vers −∞ ?', choix: ['0', '−∞', '1', '+∞'], bonne: 0, explication: 'eˣ reste positif et se rapproche de 0 quand x tend vers −∞.' },
    { id: 'tle-5', matiere: 'maths', chapitre: 'Probabilités', enonce: 'On lance un dé équilibré à 6 faces. Quelle est la probabilité d’obtenir un nombre pair ?', choix: ['1/2', '1/3', '1/6', '2/3'], bonne: 0, explication: '3 faces paires (2, 4, 6) sur 6 : 3/6 = 1/2.' },
  ],
  ens: [
    { id: 'ens-1', matiere: 'maths', chapitre: 'Pourcentages', enonce: 'Un article de 5 000 FCFA augmente de 20 %. Quel est son nouveau prix ?', choix: ['6 000 FCFA', '5 200 FCFA', '7 000 FCFA', '5 020 FCFA'], bonne: 0, explication: '20 % de 5 000 = 1 000, donc 5 000 + 1 000 = 6 000 FCFA.' },
    { id: 'ens-2', matiere: 'maths', chapitre: 'Pourcentages', enonce: 'Combien font 30 % de 400 ?', choix: ['120', '12', '130', '300'], bonne: 0, explication: '400 × 30/100 = 120.' },
    { id: 'ens-3', matiere: 'francais', chapitre: 'Vocabulaire', enonce: 'Quel mot est un synonyme de « rapide » ?', choix: ['véloce', 'lent', 'lourd', 'calme'], bonne: 0, explication: '« Véloce » veut dire qui va vite.' },
    { id: 'ens-4', matiere: 'francais', chapitre: 'Conjugaison', enonce: 'Complète : « Nous ___ à Yaoundé demain. » (aller, futur)', choix: ['irons', 'allons', 'allerons', 'irions'], bonne: 0, explication: 'Au futur, aller devient ir- : nous irons.' },
    { id: 'ens-5', matiere: 'logique', chapitre: 'Suites logiques', enonce: 'Quel nombre continue la suite 2, 4, 8, 16, … ?', choix: ['32', '24', '20', '18'], bonne: 0, explication: 'Chaque nombre est le double du précédent : 16 × 2 = 32.' },
  ],
  medecine: [
    { id: 'med-1', matiere: 'svt', chapitre: 'Biologie cellulaire', enonce: 'Quel organite produit l’essentiel de l’énergie de la cellule ?', choix: ['La mitochondrie', 'Le noyau', 'Le ribosome', 'L’appareil de Golgi'], bonne: 0, explication: 'La respiration cellulaire a lieu dans la mitochondrie, qui produit l’ATP.' },
    { id: 'med-2', matiere: 'svt', chapitre: 'Génétique', enonce: 'Combien de chromosomes compte une cellule humaine non sexuelle ?', choix: ['46', '23', '44', '48'], bonne: 0, explication: '23 paires, soit 46 chromosomes ; les gamètes n’en ont que 23.' },
    { id: 'med-3', matiere: 'chimie', chapitre: 'Acides et bases', enonce: 'Quel est le pH d’une solution neutre à 25 °C ?', choix: ['7', '0', '14', '1'], bonne: 0, explication: 'À 25 °C, une solution neutre a un pH de 7.' },
    { id: 'med-4', matiere: 'chimie', chapitre: 'Acides et bases', enonce: 'Une solution de pH 3 est…', choix: ['acide', 'basique', 'neutre', 'saline'], bonne: 0, explication: 'Un pH inférieur à 7 indique une solution acide.' },
    { id: 'med-5', matiere: 'physique', chapitre: 'Mécanique', enonce: 'Quelle est l’unité de la force ?', choix: ['le newton', 'le joule', 'le watt', 'le pascal'], bonne: 0, explication: 'La force se mesure en newtons (N) ; le joule mesure l’énergie.' },
  ],
  ingenieurs: [
    { id: 'ing-1', matiere: 'maths', chapitre: 'Analyse', enonce: 'Quelle est la dérivée de sin x ?', choix: ['cos x', '−cos x', '−sin x', 'tan x'], bonne: 0, explication: '(sin x)’ = cos x.' },
    { id: 'ing-2', matiere: 'maths', chapitre: 'Analyse', enonce: 'Suite géométrique : u₀ = 3 et raison 2. Combien vaut u₃ ?', choix: ['24', '12', '18', '9'], bonne: 0, explication: 'uₙ = u₀ × qⁿ : 3 × 2³ = 24.' },
    { id: 'ing-3', matiere: 'maths', chapitre: 'Équations', enonce: 'Résous : 3x − 7 = 8', choix: ['x = 5', 'x = 1/3', 'x = 15', 'x = 3'], bonne: 0, explication: '3x = 15, donc x = 5.' },
    { id: 'ing-4', matiere: 'physique', chapitre: 'Mécanique', enonce: 'Une voiture parcourt 120 km en 2 h. Quelle est sa vitesse moyenne ?', choix: ['60 km/h', '240 km/h', '120 km/h', '30 km/h'], bonne: 0, explication: 'v = d / t = 120 / 2 = 60 km/h.' },
    { id: 'ing-5', matiere: 'physique', chapitre: 'Électricité', enonce: 'Avec U = R × I, R = 10 Ω et I = 2 A, combien vaut U ?', choix: ['20 V', '5 V', '12 V', '0,2 V'], bonne: 0, explication: 'U = 10 × 2 = 20 V.' },
  ],
};

/** Questions du mini-test pour une classe ou un concours ; la 3e sert de repli (niveau inconnu). */
/** Filières de concours du serveur → banque embarquée la plus proche. */
const ALIAS: Record<string, string> = { sante: 'medecine', agro: 'medecine', commerce: 'ingenieurs', arts: 'ens', autres: 'ens' };

export function questionsPour(niveau?: string | null): readonly Question[] {
  const cle = niveau ? (ALIAS[niveau] ?? niveau) : null;
  return (cle && BANQUE[cle]) || BANQUE['3e'];
}
