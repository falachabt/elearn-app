import { gzipSync, strToU8 } from 'fflate';

import { decoderContenu, latexVersTexte, normaliserBlocs, texteAvecFormules } from '../blocs';

/** Même format que le back-office (blocknote-codec.ts) : clés courtes, gzip, base64. */
function compresser(blocs: unknown): string {
  const court = JSON.stringify(blocs).replace(/"type":/g, '"t":').replace(/"props":/g, '"p":').replace(/"content":/g, '"c":').replace(/"styles":/g, '"s":').replace(/"children":/g, '"ch":');
  const octets = gzipSync(strToU8(court));
  return JSON.stringify({ v: 1, f: 'gzip+shortkeys', d: btoa(String.fromCharCode(...octets)) });
}

const LECON = [
  { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Statistiques', styles: { textColor: 'blue' } }], children: [] },
  {
    type: 'paragraph',
    props: {},
    content: [
      { type: 'text', text: 'L’', styles: {} },
      { type: 'text', text: 'amplitude', styles: { bold: true } },
      { type: 'text', text: ' vaut ', styles: {} },
      { type: 'inlineMath', props: { latex: 'a = \\frac{x_{max} - x_{min}}{k}' } },
    ],
    children: [],
  },
  { type: 'paragraph', props: {}, content: [], children: [] },
  { type: 'numberedListItem', props: {}, content: [{ type: 'text', text: 'Un', styles: {} }], children: [{ type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Sous-point', styles: { italic: true } }], children: [] }] },
  { type: 'numberedListItem', props: {}, content: [{ type: 'text', text: 'Deux', styles: {} }], children: [] },
  {
    type: 'table',
    props: {},
    content: {
      type: 'tableContent',
      rows: [
        { cells: [{ type: 'tableCell', props: {}, content: [{ type: 'text', text: 'Classe', styles: {} }] }, [{ type: 'text', text: 'Effectif', styles: {} }]] },
      ],
    },
    children: [],
  },
  { type: 'divider', props: {}, children: [] },
  { type: 'image', props: { url: 'https://x/y.png', caption: 'Figure' }, children: [] },
  { type: 'video', props: { url: 'https://x/v.mp4' }, children: [] },
];

describe('decoderContenu', () => {
  it('décompresse le format du back-office', () => {
    const blocs = decoderContenu({ compresse: compresser(LECON) }) as { type: string; props: unknown }[];
    expect(blocs).toHaveLength(LECON.length);
    expect(blocs[0].type).toBe('heading');
    expect(blocs[0].props).toEqual({ level: 2 });
  });

  it('contenu non compressé ou illisible', () => {
    expect(decoderContenu({ brut: LECON })).toBe(LECON);
    expect(decoderContenu({ compresse: 'pas du json' })).toEqual([]);
    expect(decoderContenu({ compresse: JSON.stringify({ v: 2, f: 'autre', d: 'x' }) })).toEqual([]);
    expect(decoderContenu({})).toEqual([]);
  });
});

describe('normaliserBlocs', () => {
  const blocs = normaliserBlocs(LECON);

  it('titres, paragraphes avec styles et formules, paragraphes vides ignorés', () => {
    expect(blocs[0]).toEqual({ type: 'titre', niveau: 2, segments: [{ texte: 'Statistiques' }] });
    expect(blocs[1]).toEqual({
      type: 'paragraphe',
      retrait: 0,
      segments: [{ texte: 'L’' }, { texte: 'amplitude', gras: true }, { texte: ' vaut ' }, { texte: 'a = (xₘₐₓ - xₘᵢₙ)/k', math: true, latex: 'a = \\frac{x_{max} - x_{min}}{k}' }],
    });
    expect(blocs.filter((b) => b.type === 'paragraphe')).toHaveLength(1);
  });

  it('listes numérotées, enfants en retrait', () => {
    expect(blocs[2]).toMatchObject({ type: 'puce', numero: 1, retrait: 0 });
    expect(blocs[3]).toMatchObject({ type: 'puce', retrait: 1, segments: [{ texte: 'Sous-point', italique: true }] });
    expect(blocs[4]).toMatchObject({ type: 'puce', numero: 2 });
  });

  it('tableau, séparateur, image ; types inconnus ignorés', () => {
    expect(blocs[5]).toEqual({ type: 'tableau', lignes: [[[{ texte: 'Classe' }], [{ texte: 'Effectif' }]]] });
    expect(blocs[6]).toEqual({ type: 'separateur' });
    expect(blocs[7]).toEqual({ type: 'image', url: 'https://x/y.png', legende: 'Figure' });
    expect(blocs).toHaveLength(8);
  });
});

describe('latexVersTexte', () => {
  it.each([
    ['x^2 + y^{2}', 'x² + y²'],
    ['x_{min}', 'xₘᵢₙ'],
    ['\\frac{1}{2}', '1/2'],
    ['\\frac{a+b}{2}', '(a+b)/2'],
    ['\\sqrt{2}', '√2'],
    ['\\sqrt{x+1}', '√(x+1)'],
    ['a \\times b \\leq c', 'a × b ≤ c'],
    ['x \\in \\mathbb{R}', 'x ∈ ℝ'],
    ['\\left( \\pi r^2 \\right)', '( π r² )'],
    ['\\text{si } x \\neq 0', 'si x ≠ 0'],
    ['e^{-x}', 'e⁻ˣ'],
    ['2^{ab}', '2^(ab)'],
    ['\\vec{u}', 'u⃗'],
    ['\\inconnu{x}', 'inconnux'],
  ])('%s → %s', (entree, attendu) => {
    expect(latexVersTexte(entree)).toBe(attendu);
  });

  it('formules entre $ dans un texte', () => {
    expect(texteAvecFormules('Calcule $x^2$ pour $x = \\frac{1}{2}$.')).toBe('Calcule x² pour x = 1/2.');
  });
});
