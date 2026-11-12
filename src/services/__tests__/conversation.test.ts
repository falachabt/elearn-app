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
