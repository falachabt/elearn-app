import { blocsSurs, lireLignesConversation } from '../conversation';

describe('conversation — blocsSurs', () => {
  it('garde texte, pendule paramétré et fonction valides', () => {
    const blocs = blocsSurs([
      { type: 'texte', texte: 'Voici le pendule.' },
      { type: 'pendule', longueur: 0.8, amplitudeDeg: 35, pesanteur: 9.8 },
      { type: 'texte', texte: 'À retenir.' },
    ]);
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'pendule', 'texte']);
    const p = blocs[1];
    expect(p.type === 'pendule' && [p.longueur, p.amplitudeDeg, p.pesanteur]).toEqual([0.8, 35, 9.8]);
  });

  it('plafonne les paramètres du pendule dans les bornes des curseurs', () => {
    const blocs = blocsSurs([
      { type: 'texte', texte: 'Un grand pendule.' },
      { type: 'pendule', longueur: 12, amplitudeDeg: 120, pesanteur: 0.5 },
    ]);
    const p = blocs[1];
    expect(p.type === 'pendule' && [p.longueur, p.amplitudeDeg, p.pesanteur]).toEqual([3, 60, 1.6]);
  });

  it('supprime les types inconnus et le deuxième bloc interactif', () => {
    const blocs = blocsSurs([
      { type: 'texte', texte: 'Le barycentre est un point.' },
      { type: 'schema', forme: 'triangle' },
      { type: 'pendule' },
      { type: 'fonction', a: 1, b: 0, c: 0 },
    ]);
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'pendule']);
  });

  it('supprime une fonction sans coefficients exploitables (a = 0 ou manquants)', () => {
    expect(blocsSurs([{ type: 'texte', texte: 'Texte seul.' }, { type: 'fonction', a: 0, b: 3, c: 4 }]).map((b) => b.type)).toEqual(['texte']);
    expect(blocsSurs([{ type: 'texte', texte: 'Texte seul.' }, { type: 'fonction', a: 2 }]).map((b) => b.type)).toEqual(['texte']);
  });

  it('garde une correction complète, étapes nettoyées', () => {
    const blocs = blocsSurs([
      {
        type: 'correction',
        enonce: 'Un pendule de 1 m est lâché. Calculer sa période.',
        methode: 'On applique $T = 2\\pi\\sqrt{L/g}$.',
        etapes: [
          { titre: 'Calcul', detail: 'T ≈ 2,01 s.' },
          { titre: ' ', detail: '' },
        ],
        resultat: 'T ≈ 2,01 s',
        aRetenir: 'La période dépend de L.',
      },
    ]);
    expect(blocs.map((b) => b.type)).toEqual(['correction']);
    const c = blocs[0];
    expect(c.type === 'correction' && c.etapes).toEqual([{ titre: 'Calcul', detail: 'T ≈ 2,01 s.' }]);
    expect(c.type === 'correction' && c.aRetenir).toBe('La période dépend de L.');
  });

  it('une correction seule est exploitable, mais une correction incomplète ou doublée est supprimée', () => {
    const incomplete = blocsSurs([{ type: 'correction', enonce: 'Énoncé.', methode: 'Méthode.', etapes: [], resultat: 'Résultat.' }]);
    expect(incomplete).toEqual([]);
    const complete = {
      type: 'correction',
      enonce: 'Énoncé.',
      methode: 'Méthode.',
      etapes: [{ titre: 'Étape', detail: 'Détail.' }],
      resultat: 'Résultat.',
    };
    expect(blocsSurs([complete, complete]).map((b) => b.type)).toEqual(['correction']);
  });

  it('garde une scène libre valide (une seule, comme les autres blocs interactifs)', () => {
    const scene = {
      titre: 'Circuit simple', largeur: 420, hauteur: 320,
      parametres: [{ id: 'U', etiquette: 'Tension (V)', min: 0, max: 12, pas: 0.5, defaut: 6 }],
      variables: [{ id: 'I', expression: 'U / 50' }],
      elements: [{ type: 'chemin', d: 'M 100 100 L 320 100 L 320 220 L 100 220 Z', flux: { vitesse: 'I * 50', nombre: 6, rayon: 2 } }],
      affichages: [{ etiquette: 'Intensité', expression: 'I', unite: 'A', decimales: 2 }],
    };
    const blocs = blocsSurs([{ type: 'texte', texte: 'Voici le circuit.' }, { type: 'scene', scene }, { type: 'pendule' }]);
    expect(blocs.map((b) => b.type)).toEqual(['texte', 'scene']);
    const gardee = blocs[1];
    expect(gardee.type === 'scene' && gardee.scene.titre).toBe('Circuit simple');
  });

  it('supprime une scène invalide (expression inconnue) sans perdre le texte', () => {
    const scene = {
      titre: 'Cassée', largeur: 420, hauteur: 320, parametres: [], variables: [],
      elements: [{ type: 'cercle', cx: 'inconnu', cy: 10, r: 5 }], affichages: [],
    };
    const blocs = blocsSurs([{ type: 'texte', texte: 'Explication seule.' }, { type: 'scene', scene }]);
    expect(blocs.map((b) => b.type)).toEqual(['texte']);
  });

  it('renvoie vide sans bloc texte exploitable (réponse inexploitable pour l’écran)', () => {
    expect(blocsSurs([{ type: 'pendule', longueur: 1 }])).toEqual([]);
    expect(blocsSurs([{ type: 'texte', texte: '   ' }])).toEqual([]);
    expect(blocsSurs('pas un tableau')).toEqual([]);
    expect(blocsSurs(null)).toEqual([]);
  });
});

describe('conversation — lireLignesConversation', () => {
  it('lit les événements complets et garde la ligne incomplète', () => {
    const { evenements, reste } = lireLignesConversation('{"t":"etape","etape":"analyse"}\n{"t":"fin","blocs":[],"modele":"m","repli":false}\n{"t":"enc');
    expect(evenements.map((e) => e.t)).toEqual(['etape', 'fin']);
    expect(reste).toBe('{"t":"enc');
  });

  it('ignore les lignes vides ou illisibles', () => {
    const { evenements } = lireLignesConversation('\n{n importe quoi}\n{"t":"erreur","code":"ia"}\n');
    expect(evenements).toEqual([{ t: 'erreur', code: 'ia' }]);
  });
});
