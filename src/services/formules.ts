import AsyncStorage from '@react-native-async-storage/async-storage';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';

/**
 * Essai de rendu des formules (Benny, 01/10) : le LaTeX des leçons et exercices (nœuds `inlineMath`) est dessiné en
 * SVG par MathJax, sans réseau ni WebView, puis posé dans la ligne de texte. Les formules simples (une lettre, `f'(x) > 0`)
 * restent en texte ; seules les formules à deux étages (fraction, racine, limite, somme…) passent par le rendu.
 * Désactivé par défaut : un réglage permet de comparer avec le texte actuel.
 */

/** Formules qui gagnent à être dessinées : celles qui ne tiennent pas sur une ligne de texte. */
const COMPLEXE = /\\(d?t?frac|sqrt|lim|sum|int|iint|oint|prod|binom|begin|overrightarrow|overline|underbrace|overbrace|left|vec|widehat)(?![a-zA-Z])/;
export const estComplexe = (latex: string) => COMPLEXE.test(latex);

export type FormuleSvg = { xml: string; largeurEx: number; hauteurEx: number; descenteEx: number };

let convertir: ((latex: string) => FormuleSvg | null) | null = null;
const cache = new Map<string, FormuleSvg | null>();

function preparer() {
  const adaptateur = liteAdaptor();
  RegisterHTMLHandler(adaptateur);
  const doc = mathjax.document('', { InputJax: new TeX({ packages: ['base', 'ams'] }), OutputJax: new SVG({ fontCache: 'none' }) });
  return (latex: string): FormuleSvg | null => {
    const noeud = doc.convert(latex, { display: false });
    const html = adaptateur.outerHTML(noeud);
    const svg = /<svg[\s\S]*<\/svg>/.exec(html)?.[0];
    if (!svg || /data-mjx-error|merror/.test(svg)) return null;
    const nombre = (re: RegExp) => Number(re.exec(svg)?.[1] ?? NaN);
    const largeurEx = nombre(/width="([\d.]+)ex"/);
    const hauteurEx = nombre(/height="([\d.]+)ex"/);
    const descenteEx = -nombre(/vertical-align: (-?[\d.]+)ex/) || 0;
    if (!Number.isFinite(largeurEx) || !Number.isFinite(hauteurEx)) return null;
    return { xml: svg.replace(/ style="[^"]*"/, ''), largeurEx, hauteurEx, descenteEx };
  };
}

/** SVG d'une formule et ses dimensions en ex ; null si MathJax ne la comprend pas (on garde alors le texte). */
export function formuleSvg(latex: string): FormuleSvg | null {
  if (cache.has(latex)) return cache.get(latex) ?? null;
  let r: FormuleSvg | null = null;
  try {
    convertir ??= preparer();
    r = convertir(latex);
  } catch {
    r = null;
  }
  cache.set(latex, r);
  return r;
}

// Réglage d'essai : texte (par défaut) ou rendu mathématique.
export const CLE_FORMULES = 'affichage.formules';
let rendu = false;
const abonnes = new Set<() => void>();
export const lireRenduFormules = () => rendu;
export function abonnerRenduFormules(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
export async function chargerRenduFormules(): Promise<boolean> {
  rendu = (await AsyncStorage.getItem(CLE_FORMULES).catch(() => null)) === 'rendu';
  abonnes.forEach((f) => f());
  return rendu;
}
export async function definirRenduFormules(v: boolean): Promise<void> {
  rendu = v;
  abonnes.forEach((f) => f());
  await AsyncStorage.setItem(CLE_FORMULES, v ? 'rendu' : 'texte').catch(() => {});
}
