import { gunzipSync, strFromU8 } from 'fflate';

/**
 * Contenu des leçons (M5) : blocs BlockNote du back-office, ramenés à quelques blocs simples que l'app sait afficher.
 * Le back-office stocke le contenu compressé : {"v":1,"f":"gzip+shortkeys","d":"<base64>"} (clés type/props/content/
 * styles/children raccourcies en t/p/c/s/ch, voir elearn/src/lib/blocknote-codec.ts).
 */
export type Segment = { texte: string; gras?: boolean; italique?: boolean; souligne?: boolean; code?: boolean; math?: boolean };
export type Bloc =
  | { type: 'titre'; niveau: 1 | 2 | 3; segments: Segment[] }
  | { type: 'paragraphe'; segments: Segment[]; retrait: number }
  | { type: 'puce'; segments: Segment[]; retrait: number; numero?: number; coche?: boolean }
  | { type: 'citation'; segments: Segment[] }
  | { type: 'code'; texte: string }
  | { type: 'tableau'; lignes: Segment[][][] }
  | { type: 'image'; url: string; legende?: string }
  | { type: 'separateur' };

const CLES: Record<string, string> = { t: 'type', p: 'props', c: 'content', s: 'styles', ch: 'children' };

function etendre(n: unknown): unknown {
  if (Array.isArray(n)) return n.map(etendre);
  if (!n || typeof n !== 'object') return n;
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [CLES[k] ?? k, etendre(v)]));
}

function base64VersOctets(b64: string): Uint8Array {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/** Blocs BlockNote à partir du contenu compressé ou du JSON brut ; tableau vide si illisible. */
export function decoderContenu(p: { compresse?: string | null; brut?: unknown }): unknown[] {
  try {
    if (p.compresse) {
      const enveloppe = JSON.parse(p.compresse) as { v?: number; f?: string; d?: string };
      if (enveloppe.f !== 'gzip+shortkeys' || !enveloppe.d) return [];
      const json = JSON.parse(strFromU8(gunzipSync(base64VersOctets(enveloppe.d))));
      return Array.isArray(json) ? (etendre(json) as unknown[]) : [];
    }
    return Array.isArray(p.brut) ? p.brut : [];
  } catch {
    return [];
  }
}

const SYMBOLES: Record<string, string> = {
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
  equiv: '≡', infty: '∞', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', iff: '⇔',
  implies: '⇒', mapsto: '↦', degree: '°', circ: '°', angle: '∠', perp: '⊥', parallel: '∥', sum: '∑', prod: '∏', int: '∫',
  partial: '∂', nabla: '∇', ldots: '…', cdots: '⋯', dots: '…', prime: '′', percent: '%', lbrace: '{', rbrace: '}',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', lambda: 'λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const ENSEMBLES: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };
const EXPOSANTS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ' };
const INDICES: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', i: 'ᵢ', n: 'ₙ', k: 'ₖ', m: 'ₘ', p: 'ₚ', t: 'ₜ' };

/** Lit un argument {…} ou un seul caractère à partir de i ; renvoie [texte, position suivante]. */
function argument(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return [s[i] ?? '', i + 1];
  let profondeur = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') profondeur++;
    else if (s[j] === '}' && --profondeur === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

function convertirCar(texte: string, table: Record<string, string>, marque: string): string {
  const car = [...texte];
  if (car.every((c) => table[c])) return car.map((c) => table[c]).join('');
  return texte.length === 1 ? `${marque}${texte}` : `${marque}(${texte})`;
}

const simple = (t: string) => /^[\w.,′]+$/u.test(t);

/**
 * Formule LaTeX courte → texte lisible (x² ; a/b ; √(x) ; ≤ ; π…). Couvre les formules en ligne des leçons et des quiz
 * sans moteur de rendu ; une formule inconnue reste lisible, sans les barres obliques inverses.
 */
export function latexVersTexte(latex: string): string {
  let sortie = '';
  let i = 0;
  const s = latex.trim();
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      const nom = m?.[1] ?? '';
      i += 1 + nom.length;
      if (nom === 'frac' || nom === 'dfrac' || nom === 'tfrac') {
        const [a, i1] = argument(s, i);
        const [b, i2] = argument(s, i1);
        i = i2;
        const [ha, hb] = [latexVersTexte(a), latexVersTexte(b)];
        sortie += `${simple(ha) ? ha : `(${ha})`}/${simple(hb) ? hb : `(${hb})`}`;
      } else if (nom === 'sqrt') {
        const [a, i1] = argument(s, i);
        i = i1;
        const h = latexVersTexte(a);
        sortie += simple(h) ? `√${h}` : `√(${h})`;
      } else if (nom === 'mathbb') {
        const [a, i1] = argument(s, i);
        i = i1;
        sortie += ENSEMBLES[a] ?? a;
      } else if (['text', 'mathrm', 'textbf', 'mathbf', 'operatorname', 'mathit', 'boldsymbol', 'overline', 'vec', 'widehat', 'hat', 'bar'].includes(nom)) {
        const [a, i1] = argument(s, i);
        i = i1;
        const h = latexVersTexte(a);
        sortie += nom === 'vec' ? `${h}⃗` : nom === 'overline' || nom === 'bar' ? `${h}̅` : nom === 'widehat' || nom === 'hat' ? `${h}̂` : h;
      } else if (nom === 'left' || nom === 'right' || nom === 'displaystyle' || nom === 'limits') {
        // délimiteurs et mise en forme : on garde seulement le caractère qui suit
      } else if (nom === ',' || nom === ';' || nom === ':' || nom === ' ' || nom === 'quad' || nom === 'qquad') {
        sortie += ' ';
      } else if (nom === '{' || nom === '}' || nom === '%' || nom === '$' || nom === '&' || nom === '#' || nom === '_') {
        sortie += nom;
      } else if (nom === '\\') {
        sortie += ' ; ';
      } else {
        sortie += SYMBOLES[nom] ?? nom;
      }
    } else if (c === '^' || c === '_') {
      const [a, i1] = argument(s, i + 1);
      i = i1;
      sortie += convertirCar(latexVersTexte(a), c === '^' ? EXPOSANTS : INDICES, c);
    } else if (c === '{' || c === '}') {
      i++;
    } else if (c === '~') {
      sortie += ' ';
      i++;
    } else {
      sortie += c;
      i++;
    }
  }
  return sortie.replace(/\s+/g, ' ').trim();
}

/** Texte avec formules entre $…$ (énoncés de quiz) : formules converties, le reste gardé. */
export function texteAvecFormules(texte: string): string {
  return texte.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_, a: string | undefined, b: string | undefined) => latexVersTexte(a ?? b ?? ''));
}

type Noeud = { type?: string; props?: Record<string, unknown>; content?: unknown; children?: Noeud[]; text?: string; styles?: Record<string, unknown>; href?: string };

function segments(contenu: unknown): Segment[] {
  if (!Array.isArray(contenu)) return [];
  return (contenu as Noeud[]).flatMap((n): Segment[] => {
    if (n.type === 'text') {
      const st = n.styles ?? {};
      return n.text ? [{ texte: n.text, gras: !!st.bold || undefined, italique: !!st.italic || undefined, souligne: !!st.underline || undefined, code: !!st.code || undefined }] : [];
    }
    if (n.type === 'link') return segments(n.content).map((s) => ({ ...s, souligne: true }));
    if (n.type === 'inlineMath' || n.type === 'math') return [{ texte: latexVersTexte(String(n.props?.latex ?? '')), math: true }];
    return [];
  });
}

const aDuTexte = (s: Segment[]) => s.some((x) => x.texte.trim());

/** Blocs BlockNote → blocs de l'app. Les types inconnus sont ignorés ; les enfants suivent leur parent avec un retrait. */
export function normaliserBlocs(noeuds: unknown[], retrait = 0): Bloc[] {
  const sortie: Bloc[] = [];
  let numero = 0;
  for (const n of noeuds as Noeud[]) {
    const props = n.props ?? {};
    if (n.type !== 'numberedListItem') numero = 0;
    switch (n.type) {
      case 'heading': {
        const s = segments(n.content);
        if (aDuTexte(s)) sortie.push({ type: 'titre', niveau: Math.min(3, Math.max(1, Number(props.level) || 2)) as 1 | 2 | 3, segments: s });
        break;
      }
      case 'paragraph': {
        const s = segments(n.content);
        if (aDuTexte(s)) sortie.push({ type: 'paragraphe', segments: s, retrait });
        break;
      }
      case 'bulletListItem':
      case 'numberedListItem':
      case 'checkListItem': {
        const s = segments(n.content);
        if (n.type === 'numberedListItem') numero++;
        sortie.push({
          type: 'puce',
          segments: s,
          retrait,
          numero: n.type === 'numberedListItem' ? numero : undefined,
          coche: n.type === 'checkListItem' ? !!props.checked : undefined,
        });
        break;
      }
      case 'quote': {
        const s = segments(n.content);
        if (aDuTexte(s)) sortie.push({ type: 'citation', segments: s });
        break;
      }
      case 'codeBlock':
        sortie.push({ type: 'code', texte: segments(n.content).map((s) => s.texte).join('') });
        break;
      case 'table': {
        const lignes = ((n.content as { rows?: { cells?: unknown[] }[] } | undefined)?.rows ?? []).map((r) =>
          (r.cells ?? []).map((cellule) => (Array.isArray(cellule) ? segments(cellule) : segments((cellule as Noeud).content))),
        );
        if (lignes.length) sortie.push({ type: 'tableau', lignes });
        break;
      }
      case 'image':
        if (typeof props.url === 'string' && props.url) sortie.push({ type: 'image', url: props.url, legende: typeof props.caption === 'string' && props.caption ? props.caption : undefined });
        break;
      case 'divider':
        sortie.push({ type: 'separateur' });
        break;
      default:
        break;
    }
    if (n.children?.length) sortie.push(...normaliserBlocs(n.children, retrait + 1));
  }
  return sortie;
}
