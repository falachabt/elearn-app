import {
  analyserChemin,
  analyserExpression,
  contexteScene,
  evaluerNoeud,
  evaluerValeur,
  pointsCourbe,
  pointsRessort,
  texteScene,
  validerScene,
  type SceneChat,
} from '../laboScene';

// Scènes RÉELLES produites par Gemma 4 sur le banc « génération libre » (13/11/2026) : la validation doit
// les accepter telles quelles — c'est le contrat que la fonction « conversation » sert au labo.
const SCENE_PENDULE = JSON.parse(`{
  "titre": "Simulation du Pendule Simple", "largeur": 420, "hauteur": 320,
  "parametres": [
    { "id": "L", "etiquette": "Longueur du fil (m)", "min": 0.2, "max": 1.5, "pas": 0.05, "defaut": 0.8 },
    { "id": "A", "etiquette": "Angle de départ (°)", "min": 5, "max": 60, "pas": 1, "defaut": 15 },
    { "id": "g", "etiquette": "Gravité (m/s²)", "min": 1, "max": 20, "pas": 0.1, "defaut": 9.81 }
  ],
  "variables": [
    { "id": "theta_max", "expression": "A * pi / 180" },
    { "id": "T_theorique", "expression": "2 * pi * sqrt(L / g)" },
    { "id": "theta_t", "expression": "theta_max * cos(2 * pi * t / T_theorique)" },
    { "id": "pivot_x", "expression": "210" },
    { "id": "pivot_y", "expression": "50" },
    { "id": "masse_x", "expression": "pivot_x + L * 100 * sin(theta_t)" },
    { "id": "masse_y", "expression": "pivot_y + L * 100 * cos(theta_t)" }
  ],
  "elements": [
    { "type": "rectangle", "x": 0, "y": 0, "largeur": 420, "hauteur": 320, "remplissage": "#f8f9fa", "contour": "#ccc" },
    { "type": "ligne", "x1": 180, "y1": 50, "x2": 240, "y2": 50, "couleur": "#333", "epaisseur": 4 },
    { "type": "ligne", "x1": 210, "y1": 50, "x2": "masse_x", "y2": "masse_y", "couleur": "#555", "epaisseur": 2 },
    { "type": "cercle", "cx": 210, "cy": 50, "r": 4, "remplissage": "#333" },
    { "type": "cercle", "cx": "masse_x", "cy": "masse_y", "r": 12, "remplissage": "#e74c3c", "contour": "#c0392b" },
    { "type": "texte", "x": 210, "y": 20, "contenu": "Pendule Simple", "taille": 16, "couleur": "#2c3e50", "ancre": "middle" }
  ],
  "affichages": [
    { "etiquette": "Période (T)", "expression": "T_theorique", "unite": "s", "decimales": 2 },
    { "etiquette": "Angle actuel", "expression": "abs(theta_t * 180 / pi)", "unite": "°", "decimales": 1 }
  ]
}`);

const SCENE_CIRCUIT = JSON.parse(`{
  "titre": "Circuit Électrique : Courant et Tension", "largeur": 420, "hauteur": 320,
  "parametres": [
    { "id": "U", "etiquette": "Tension (V)", "min": 0, "max": 12, "pas": 0.5, "defaut": 6 },
    { "id": "R", "etiquette": "Résistance (Ω)", "min": 10, "max": 100, "pas": 5, "defaut": 50 }
  ],
  "variables": [
    { "id": "I", "expression": "U/R" },
    { "id": "vitesse_flux", "expression": "I * 50" }
  ],
  "elements": [
    { "type": "rectangle", "x": 50, "y": 50, "largeur": 320, "hauteur": 220, "remplissage": "#f9f9f9", "contour": "#333" },
    { "type": "chemin", "d": "M 100 100 L 320 100 L 320 220 L 100 220 Z", "couleur": "#333", "epaisseur": 3, "remplissage": "none",
      "flux": { "vitesse": "vitesse_flux", "nombre": 12, "rayon": 2, "couleur": "#f1c40f" } },
    { "type": "groupe", "rotation": { "angle": "0", "cx": 100, "cy": 100 }, "elements": [
      { "type": "rectangle", "x": 80, "y": 85, "largeur": 40, "hauteur": 30, "remplissage": "#2c3e50", "contour": "#000" },
      { "type": "texte", "x": 100, "y": 105, "contenu": "Pile", "taille": 11, "couleur": "#fff", "ancre": "middle" }
    ] },
    { "type": "texte", "x": 210, "y": 80, "contenu": "I = {I} A", "taille": 13, "couleur": "#333", "ancre": "middle" }
  ],
  "affichages": [ { "etiquette": "Intensité", "expression": "I", "unite": "A", "decimales": 2 } ]
}`);

describe('parseur d’expressions (aucun eval)', () => {
  it('arithmétique, priorités, puissance et unaire', () => {
    const ev = (src: string, portee = {}) => evaluerNoeud(analyserExpression(src).noeud, portee);
    expect(ev('2 + 3 * 4')).toBe(14);
    expect(ev('(2 + 3) * 4')).toBe(20);
    expect(ev('2^3^2')).toBe(512); // associativité à droite, comme **
    expect(ev('-3 + 5')).toBe(2);
    expect(ev('10 % 3')).toBe(1);
    expect(ev('sqrt(16) + pow(2, 3)')).toBe(12);
    expect(ev('min(4, 2, 9) + max(1, 7)')).toBe(9);
    expect(ev('L * 2', { L: 0.8 })).toBeCloseTo(1.6);
    expect(ev('pi')).toBeCloseTo(Math.PI);
  });

  it('rejette tout ce qui sort de la grammaire fermée', () => {
    for (const src of ['alert(1)', 'x; y', 'a b', '2 +', 'foo(1)', 'sin()', 'sin(1, 2)', 'Math.sin(1)', 'a[0]', '1 ? 2 : 3', '']) {
      expect(() => analyserExpression(src)).toThrow();
    }
  });

  it('collecte les identifiants utilisés', () => {
    expect(analyserExpression('2*pi*sqrt(L/g) + t').identifiants.sort()).toEqual(['L', 'g', 'pi', 't']);
  });
});

describe('validerScene — scènes réelles du banc', () => {
  it('accepte la scène pendule de Gemma (paramètres, variables chaînées, affichages)', () => {
    const scene = validerScene(SCENE_PENDULE);
    expect(scene).not.toBeNull();
    expect(scene!.parametres.map((p) => p.id)).toEqual(['L', 'A', 'g']);
    expect(scene!.affichages).toHaveLength(2);
  });

  it('accepte la scène circuit de Gemma (chemin à flux, groupe tourné)', () => {
    const scene = validerScene(SCENE_CIRCUIT);
    expect(scene).not.toBeNull();
    const chemin = scene!.elements.find((e) => e.type === 'chemin');
    expect(chemin?.type === 'chemin' && chemin.flux?.nombre).toBe(12);
  });

  it('le contexte calcule les variables dans l’ordre : période du pendule juste pour L = 0,8 m', () => {
    const scene = validerScene(SCENE_PENDULE)!;
    const portee = contexteScene(scene, {}, 0);
    // T = 2π√(0,8/9,81) ≈ 1,79 s — la valeur que le banc a vérifiée.
    expect(portee.T_theorique).toBeCloseTo(1.79, 2);
    // À t = 0, la masse est à l’amplitude maximale : x décalé, y sous le pivot.
    expect(portee.masse_x).toBeGreaterThan(210);
    expect(portee.masse_y).toBeGreaterThan(50);
  });

  it('l’intensité du circuit est recalculée par le moteur : 6 V / 50 Ω = 0,12 A', () => {
    const scene = validerScene(SCENE_CIRCUIT)!;
    expect(contexteScene(scene, {}, 0).I).toBeCloseTo(0.12);
    expect(contexteScene(scene, { U: 12, R: 10 }, 0).I).toBeCloseTo(1.2);
    expect(texteScene('I = {I} A', contexteScene(scene, {}, 0))).toBe('I = 0,12 A');
  });
});

describe('validerScene — rejets', () => {
  const base = () => JSON.parse(JSON.stringify(SCENE_PENDULE));

  it('identifiant non déclaré dans une expression', () => {
    const s = base();
    s.variables[0].expression = 'ZZ * 2';
    expect(validerScene(s)).toBeNull();
  });

  it('fonction hors liste blanche', () => {
    const s = base();
    s.variables[0].expression = 'random() * 10';
    expect(validerScene(s)).toBeNull();
  });

  it('variable non finie aux bornes d’un curseur (division par zéro possible)', () => {
    const s = base();
    s.parametres.push({ id: 'd', etiquette: 'd', min: 0, max: 2, pas: 0.5, defaut: 1 });
    s.variables.push({ id: 'q', expression: '10 / d' });
    expect(validerScene(s)).toBeNull();
  });

  it('type d’élément inconnu, chemin avec arc, couleur non hexadécimale traitée', () => {
    const s = base();
    s.elements.push({ type: 'point', x: 1, y: 2 });
    expect(validerScene(s)).toBeNull();
    const s2 = base();
    s2.elements.push({ type: 'chemin', d: 'M 10 10 A 5 5 0 0 1 100 100' });
    expect(validerScene(s2)).toBeNull();
    const s3 = base();
    s3.elements[0].remplissage = 'rouge; } body { display:none';
    const v3 = validerScene(s3);
    expect(v3).not.toBeNull(); // la couleur invalide est écartée, pas la scène
    expect(v3!.elements[0].type === 'rectangle' && v3!.elements[0].remplissage).toBeUndefined();
  });

  it('x hors d’une courbe, interpolation inconnue, trop d’éléments', () => {
    const s = base();
    s.elements.push({ type: 'ligne', x1: 'x', y1: 0, x2: 10, y2: 10 });
    expect(validerScene(s)).toBeNull();
    const s2 = base();
    s2.elements.push({ type: 'texte', x: 10, y: 10, contenu: 'Valeur {inconnue}' });
    expect(validerScene(s2)).toBeNull();
    const s3 = base();
    for (let i = 0; i < 40; i++) s3.elements.push({ type: 'cercle', cx: 10, cy: 10, r: 3 });
    expect(validerScene(s3)).toBeNull();
  });

  it('paramètre incohérent : min ≥ max, id réservé, doublon', () => {
    const s = base();
    s.parametres[0].max = 0.1;
    expect(validerScene(s)).toBeNull();
    const s2 = base();
    s2.parametres[0].id = 'sin';
    expect(validerScene(s2)).toBeNull();
    const s3 = base();
    s3.parametres.push({ ...s3.parametres[0] });
    expect(validerScene(s3)).toBeNull();
  });

  it('le défaut hors bornes est plafonné, pas rejeté', () => {
    const s = base();
    s.parametres[0].defaut = 99;
    const v = validerScene(s);
    expect(v!.parametres[0].defaut).toBe(1.5);
  });
});

describe('géométrie de rendu', () => {
  it('ressort : zigzag entre les extrémités, nombre de points = spires + 2', () => {
    const pts = pointsRessort(0, 0, 100, 0, 9).split(' ');
    expect(pts).toHaveLength(11);
    expect(pts[0]).toBe('0,0');
    expect(pts[10]).toBe('100,0');
  });

  it('chemin rectangulaire du circuit : longueur = périmètre, point à distance connue', () => {
    const ech = analyserChemin('M 100 100 L 320 100 L 320 220 L 100 220 Z')!;
    expect(ech.longueur).toBe(2 * (220 + 120));
    expect(ech.pointA(0)).toEqual({ x: 100, y: 100 });
    expect(ech.pointA(220)).toEqual({ x: 320, y: 100 });
    expect(ech.pointA(220 + 120)).toEqual({ x: 320, y: 220 });
  });

  it('chemin relatif et courbes acceptés, commandes exotiques rejetées', () => {
    expect(analyserChemin('m 10 10 l 50 0 v 30 h -50 z')).not.toBeNull();
    expect(analyserChemin('M 0 0 C 10 10, 20 10, 30 0')).not.toBeNull();
    expect(analyserChemin('M 0 0 S 10 10 20 20')).toBeNull();
    expect(analyserChemin('M 0 0 L 10')).toBeNull();
    expect(analyserChemin('javascript:alert(1)')).toBeNull();
  });

  it('courbe : la parabole 2x² + 3x + 4 passe par (0, 4) dans le repère', () => {
    const scene: SceneChat = validerScene({
      titre: 'Parabole', largeur: 420, hauteur: 320, parametres: [], variables: [],
      elements: [{ type: 'courbe', fonction: '2*x*x + 3*x + 4', xmin: -4, xmax: 3, origine: [210, 160], echelle: [25, 25] }],
      affichages: [],
    })!;
    const el = scene.elements[0];
    const pts = pointsCourbe(el as Extract<SceneChat['elements'][number], { type: 'courbe' }>, { t: 0 });
    expect(pts).toContain('210.6,58.1'); // point le plus proche de x = 0 (grille de 81 points) : y ≈ 4,08 → écran (210,6 ; 58,1)
  });

  it('evaluerValeur retombe à 0 sur une expression cassée au rendu (jamais de plantage)', () => {
    expect(evaluerValeur('1/0', {})).toBe(0);
    expect(evaluerValeur('inconnu + 1', {})).toBe(0);
    expect(evaluerValeur(42, {})).toBe(42);
  });
});
