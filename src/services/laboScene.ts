/**
 * Scènes déclaratives libres du labo « chat interactif » (route 3 du benchmark « génération libre », 13/11/2026).
 *
 * Le moteur (Gemma 4, côté fonction « conversation ») compose librement une scène en JSON : paramètres
 * (curseurs), variables calculées par des expressions, éléments dessinés (lignes, cercles, chemins avec flux,
 * courbes, ressorts, groupes tournés…) et affichages de grandeurs. L'app ne reçoit que des DONNÉES : aucun
 * code n'est exécuté — les expressions sont analysées par le petit parseur ci-dessous (grammaire fermée :
 * nombres, identifiants déclarés, opérateurs usuels et une liste blanche de fonctions), puis évaluées par
 * notre moteur. Les valeurs affichées sont donc toujours calculées par l'app, jamais écrites par le modèle :
 * un affichage ne peut pas contredire le dessin.
 *
 * Ce module porte le contrat (types), la validation/normalisation (`validerScene`, appliquée par l'écran à
 * toute scène reçue — la fonction valide déjà côté serveur, l'app revérifie par prudence) et les aides de
 * rendu (contexte d'évaluation, géométrie du ressort, échantillonnage des courbes et des chemins à flux).
 */

// ---------------------------------------------------------------------------
// Contrat de la scène (mêmes champs que le format du banc d'essai)
// ---------------------------------------------------------------------------

export type SceneParametre = { id: string; etiquette: string; min: number; max: number; pas: number; defaut: number };
export type SceneVariable = { id: string; expression: string };

export type SceneElementBase = { couleur?: string; remplissage?: string; contour?: string; epaisseur?: number };
export type SceneElement =
  | (SceneElementBase & { type: 'ligne'; x1: number | string; y1: number | string; x2: number | string; y2: number | string })
  | (SceneElementBase & { type: 'cercle'; cx: number | string; cy: number | string; r: number | string })
  | (SceneElementBase & { type: 'rectangle'; x: number | string; y: number | string; largeur: number | string; hauteur: number | string })
  | (SceneElementBase & { type: 'polygone'; points: [number | string, number | string][] })
  | (SceneElementBase & { type: 'texte'; x: number | string; y: number | string; contenu: string; taille?: number; ancre?: 'start' | 'middle' | 'end' })
  | (SceneElementBase & {
      type: 'chemin';
      d: string;
      flux?: { vitesse: number | string; nombre: number; rayon: number; couleur?: string };
    })
  | (SceneElementBase & {
      type: 'courbe';
      fonction: string;
      xmin: number | string;
      xmax: number | string;
      origine: [number, number];
      echelle: [number, number];
    })
  | (SceneElementBase & { type: 'ressort'; x1: number | string; y1: number | string; x2: number | string; y2: number | string; spires?: number })
  | { type: 'groupe'; rotation?: { angle: number | string; cx: number; cy: number }; elements: SceneElement[] };

export type SceneAffichage = { etiquette: string; expression: string; unite?: string; decimales: number };

export type SceneChat = {
  titre: string;
  largeur: number;
  hauteur: number;
  parametres: SceneParametre[];
  variables: SceneVariable[];
  elements: SceneElement[];
  affichages: SceneAffichage[];
};

/** Portée d'évaluation : paramètres, variables calculées, temps `t` (secondes), `x` dans les courbes. */
export type PorteeScene = Record<string, number>;

// ---------------------------------------------------------------------------
// Expressions : parseur sûr (aucun eval) — nombres, identifiants, + - * / % ^,
// parenthèses, appels parmi une liste blanche de fonctions, constante pi.
// ---------------------------------------------------------------------------

type Noeud =
  | { k: 'nombre'; v: number }
  | { k: 'ident'; nom: string }
  | { k: 'neg'; a: Noeud }
  | { k: 'bin'; op: string; a: Noeud; b: Noeud }
  | { k: 'appel'; nom: string; args: Noeud[] };

const FONCTIONS: Record<string, { min: number; max: number; f: (...args: number[]) => number }> = {
  sin: { min: 1, max: 1, f: Math.sin },
  cos: { min: 1, max: 1, f: Math.cos },
  tan: { min: 1, max: 1, f: Math.tan },
  asin: { min: 1, max: 1, f: Math.asin },
  acos: { min: 1, max: 1, f: Math.acos },
  atan: { min: 1, max: 1, f: Math.atan },
  sqrt: { min: 1, max: 1, f: Math.sqrt },
  abs: { min: 1, max: 1, f: Math.abs },
  exp: { min: 1, max: 1, f: Math.exp },
  log: { min: 1, max: 1, f: Math.log },
  pow: { min: 2, max: 2, f: (a, b) => Math.pow(a, b) },
  min: { min: 1, max: 8, f: (...a) => Math.min(...a) },
  max: { min: 1, max: 8, f: (...a) => Math.max(...a) },
};
export const FONCTIONS_SCENE = Object.keys(FONCTIONS);

type Jeton = { t: 'n' | 'id' | 'op' | 'lp' | 'rp' | 'virg'; v: string };

function jetons(source: string): Jeton[] {
  const sortie: Jeton[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j++;
      sortie.push({ t: 'n', v: source.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      sortie.push({ t: 'id', v: source.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '(') { sortie.push({ t: 'lp', v: c }); i++; continue; }
    if (c === ')') { sortie.push({ t: 'rp', v: c }); i++; continue; }
    if (c === ',') { sortie.push({ t: 'virg', v: c }); i++; continue; }
    if ('+-*/%^'.includes(c)) { sortie.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`Caractère interdit dans l'expression : ${c}`);
  }
  return sortie;
}

/** Analyse une expression ; lève une erreur si la syntaxe sort de la grammaire fermée. */
export function analyserExpression(source: string): { noeud: Noeud; identifiants: string[] } {
  if (typeof source !== 'string' || !source.trim() || source.length > 200) throw new Error('Expression vide ou trop longue');
  const liste = jetons(source);
  const identifiants = new Set<string>();
  let pos = 0;
  const courant = () => liste[pos];
  const manger = () => liste[pos++];

  function primaire(): Noeud {
    const j = manger();
    if (!j) throw new Error('Expression incomplète');
    if (j.t === 'n') {
      const v = Number(j.v);
      if (!Number.isFinite(v)) throw new Error('Nombre illisible');
      return { k: 'nombre', v };
    }
    if (j.t === 'lp') {
      const e = addition();
      if (manger()?.t !== 'rp') throw new Error('Parenthèse non fermée');
      return e;
    }
    if (j.t === 'id') {
      if (courant()?.t === 'lp') {
        manger();
        const spec = FONCTIONS[j.v];
        if (!spec) throw new Error(`Fonction non autorisée : ${j.v}`);
        const args: Noeud[] = [];
        if (courant()?.t !== 'rp') {
          args.push(addition());
          while (courant()?.t === 'virg') { manger(); args.push(addition()); }
        }
        if (manger()?.t !== 'rp') throw new Error('Parenthèse non fermée');
        if (args.length < spec.min || args.length > spec.max) throw new Error(`Nombre d'arguments invalide pour ${j.v}`);
        return { k: 'appel', nom: j.v, args };
      }
      identifiants.add(j.v);
      return { k: 'ident', nom: j.v };
    }
    throw new Error('Expression mal formée');
  }
  function unaire(): Noeud {
    if (courant()?.t === 'op' && courant()?.v === '-') { manger(); return { k: 'neg', a: unaire() }; }
    if (courant()?.t === 'op' && courant()?.v === '+') { manger(); return unaire(); }
    return primaire();
  }
  function puissance(): Noeud {
    const base = unaire();
    if (courant()?.t === 'op' && courant()?.v === '^') { manger(); return { k: 'bin', op: '^', a: base, b: puissance() }; }
    return base;
  }
  function produit(): Noeud {
    let a = puissance();
    while (courant()?.t === 'op' && ['*', '/', '%'].includes(courant()!.v)) {
      const op = manger().v;
      a = { k: 'bin', op, a, b: puissance() };
    }
    return a;
  }
  function addition(): Noeud {
    let a = produit();
    while (courant()?.t === 'op' && ['+', '-'].includes(courant()!.v)) {
      const op = manger().v;
      a = { k: 'bin', op, a, b: produit() };
    }
    return a;
  }

  const noeud = addition();
  if (pos !== liste.length) throw new Error('Expression mal formée (reste non lu)');
  return { noeud, identifiants: [...identifiants] };
}

/** Évalue un arbre d'expression dans une portée ; NaN si un identifiant manque (la validation l'a déjà exclu). */
export function evaluerNoeud(noeud: Noeud, portee: PorteeScene): number {
  switch (noeud.k) {
    case 'nombre': return noeud.v;
    case 'ident': return noeud.nom === 'pi' ? Math.PI : (portee[noeud.nom] ?? NaN);
    case 'neg': return -evaluerNoeud(noeud.a, portee);
    case 'appel': return FONCTIONS[noeud.nom].f(...noeud.args.map((a) => evaluerNoeud(a, portee)));
    case 'bin': {
      const a = evaluerNoeud(noeud.a, portee);
      const b = evaluerNoeud(noeud.b, portee);
      if (noeud.op === '+') return a + b;
      if (noeud.op === '-') return a - b;
      if (noeud.op === '*') return a * b;
      if (noeud.op === '/') return a / b;
      if (noeud.op === '%') return a % b;
      return Math.pow(a, b);
    }
  }
}

/** Évalue une valeur de scène (nombre direct ou expression) ; 0 si le résultat n'est pas fini. */
export function evaluerValeur(valeur: number | string, portee: PorteeScene): number {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : 0;
  try {
    const v = evaluerNoeud(analyserExpression(valeur).noeud, portee);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Validation et normalisation d'une scène reçue (miroir de la validation serveur)
// ---------------------------------------------------------------------------

const COULEUR_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVES = new Set(['pi', 't', 'x', ...FONCTIONS_SCENE]);

const chaineBornee = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const nombreFini = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const couleurSure = (v: unknown): string | undefined => (typeof v === 'string' && COULEUR_HEX.test(v.trim()) ? v.trim() : undefined);

/** Vérifie qu'une expression n'utilise que les identifiants autorisés et qu'elle s'évalue en fini dans la portée témoin. */
function expressionValide(source: string, autorises: Set<string>, temoin: PorteeScene, autoriserX = false): boolean {
  try {
    const { noeud, identifiants } = analyserExpression(source);
    for (const id of identifiants) {
      if (id === 'pi') continue;
      if (id === 'x' && autoriserX) continue;
      if (!autorises.has(id)) return false;
    }
    return Number.isFinite(evaluerNoeud(noeud, temoin));
  } catch {
    return false;
  }
}

/**
 * Valide et normalise une scène brute (JSON du modèle) ; renvoie null si le cœur de la scène sort du
 * contrat : schéma borné, expressions à identifiants déclarés seulement, valeurs finies aux réglages par
 * défaut comme aux bornes des curseurs, chemins limités aux commandes simples (M L H V C Q Z, absolues ou
 * relatives). Normalisations (la scène survit, délestée de ce qui serait faux ou inerte) : une variable
 * inexploitable et référencée par RIEN est abandonnée, un affichage inexploitable est abandonné, et un
 * paramètre qu'aucune expression ne référence (curseur inerte) est retiré.
 */
export function validerScene(brut: unknown): SceneChat | null {
  if (!brut || typeof brut !== 'object') return null;
  const s = brut as Record<string, unknown>;
  const titre = chaineBornee(s.titre, 80);
  if (!titre) return null;
  const largeur = Math.min(460, Math.max(200, nombreFini(s.largeur) ?? 420));
  const hauteur = Math.min(420, Math.max(160, nombreFini(s.hauteur) ?? 320));

  // Paramètres (curseurs) : identifiants uniques, non réservés, bornes cohérentes.
  const parametres: SceneParametre[] = [];
  const idsParams = new Set<string>();
  for (const p of (Array.isArray(s.parametres) ? s.parametres : []).slice(0, 6)) {
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    const id = chaineBornee(o.id, 12);
    const min = nombreFini(o.min);
    const max = nombreFini(o.max);
    if (!IDENT.test(id) || RESERVES.has(id) || idsParams.has(id) || min === null || max === null || !(min < max)) return null;
    const pasBrut = nombreFini(o.pas);
    const pas = pasBrut !== null && pasBrut > 0 ? pasBrut : (max - min) / 50;
    const defautBrut = nombreFini(o.defaut);
    parametres.push({
      id,
      etiquette: chaineBornee(o.etiquette, 40) || id,
      min,
      max,
      pas,
      defaut: Math.min(max, Math.max(min, defautBrut ?? min)),
    });
    idsParams.add(id);
  }

  // Portées témoins : réglages par défaut puis coins min/max des curseurs, à deux temps de l'animation.
  const porteeDefaut: PorteeScene = { t: 0 };
  for (const p of parametres) porteeDefaut[p.id] = p.defaut;
  const porteesTemoins: PorteeScene[] = [porteeDefaut];
  for (const coin of ['min', 'max'] as const) {
    const copie: PorteeScene = { t: 1.7 };
    for (const p of parametres) copie[p.id] = p[coin];
    porteesTemoins.push(copie);
  }

  // Variables : expressions chaînées (une variable peut utiliser les précédentes), finies dans chaque témoin.
  // Une variable dont l'EXPRESSION est inexploitable (le piège classique : « x » utilisé hors d'un élément
  // courbe, par exemple « f = a*log(x) ») ne tue plus la scène d'office : elle est mise de côté. Si un
  // élément ou un affichage la référence, sa propre validation échouera et la scène sera rejetée ; si rien
  // ne la référence, elle est simplement abandonnée et la scène survit (incident du 13/11/2026 : les scènes
  // du logarithme mouraient toutes sur ce point, et la réponse partait en texte seul sans aucun visuel).
  const variables: SceneVariable[] = [];
  const idsConnus = new Set<string>([...idsParams, 't']);
  const idsRejetes = new Set<string>();
  for (const v of (Array.isArray(s.variables) ? s.variables : []).slice(0, 12)) {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const id = chaineBornee(o.id, 12);
    const expression = chaineBornee(o.expression, 200);
    if (!IDENT.test(id) || RESERVES.has(id) || idsConnus.has(id) || idsRejetes.has(id) || !expression) return null;
    let valide = true;
    for (const temoin of porteesTemoins) {
      if (!expressionValide(expression, idsConnus, temoin)) { valide = false; break; }
    }
    if (!valide) {
      idsRejetes.add(id);
      continue;
    }
    variables.push({ id, expression });
    idsConnus.add(id);
    for (const temoin of porteesTemoins) temoin[id] = evaluerValeur(expression, temoin);
  }

  // Éléments : bornes de nombre (groupe = profondeur 1, enfants comptés), champs et expressions vérifiés.
  let compteur = 0;
  const validerCoord = (v: unknown): number | string | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim()) {
      for (const temoin of porteesTemoins) if (!expressionValide(v, idsConnus, temoin)) return null;
      return v;
    }
    return null;
  };
  const styleSur = (o: Record<string, unknown>): SceneElementBase => {
    const base: SceneElementBase = {};
    const c = couleurSure(o.couleur);
    const r = couleurSure(o.remplissage);
    const ct = couleurSure(o.contour);
    if (c) base.couleur = c;
    if (r) base.remplissage = r;
    if (ct) base.contour = ct;
    const ep = nombreFini(o.epaisseur);
    if (ep !== null) base.epaisseur = Math.min(12, Math.max(0.5, ep));
    return base;
  };
  const validerElements = (liste: unknown, profondeur: number): SceneElement[] | null => {
    if (!Array.isArray(liste)) return null;
    const sortie: SceneElement[] = [];
    for (const brutEl of liste) {
      if (++compteur > 40) return null;
      if (!brutEl || typeof brutEl !== 'object') return null;
      const o = brutEl as Record<string, unknown>;
      const base = styleSur(o);
      if (o.type === 'ligne' || o.type === 'ressort') {
        const x1 = validerCoord(o.x1); const y1 = validerCoord(o.y1); const x2 = validerCoord(o.x2); const y2 = validerCoord(o.y2);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
        if (o.type === 'ligne') sortie.push({ ...base, type: 'ligne', x1, y1, x2, y2 });
        else {
          const spires = nombreFini(o.spires);
          sortie.push({ ...base, type: 'ressort', x1, y1, x2, y2, spires: Math.min(24, Math.max(3, Math.round(spires ?? 9))) });
        }
      } else if (o.type === 'cercle') {
        const cx = validerCoord(o.cx); const cy = validerCoord(o.cy); const r = validerCoord(o.r);
        if (cx === null || cy === null || r === null) return null;
        sortie.push({ ...base, type: 'cercle', cx, cy, r });
      } else if (o.type === 'rectangle') {
        const x = validerCoord(o.x); const y = validerCoord(o.y); const l = validerCoord(o.largeur); const h = validerCoord(o.hauteur);
        if (x === null || y === null || l === null || h === null) return null;
        sortie.push({ ...base, type: 'rectangle', x, y, largeur: l, hauteur: h });
      } else if (o.type === 'polygone') {
        if (!Array.isArray(o.points) || o.points.length < 3 || o.points.length > 24) return null;
        const points: [number | string, number | string][] = [];
        for (const pt of o.points) {
          if (!Array.isArray(pt) || pt.length !== 2) return null;
          const px = validerCoord(pt[0]); const py = validerCoord(pt[1]);
          if (px === null || py === null) return null;
          points.push([px, py]);
        }
        sortie.push({ ...base, type: 'polygone', points });
      } else if (o.type === 'texte') {
        const x = validerCoord(o.x); const y = validerCoord(o.y);
        const contenu = chaineBornee(o.contenu, 120);
        if (x === null || y === null || !contenu) return null;
        // Les {variables} interpolées doivent exister.
        for (const m of contenu.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
          if (m[1] !== 'pi' && !idsConnus.has(m[1])) return null;
        }
        const taille = nombreFini(o.taille);
        const el: Extract<SceneElement, { type: 'texte' }> = { ...base, type: 'texte', x, y, contenu };
        if (taille !== null) el.taille = Math.min(28, Math.max(9, taille));
        if (o.ancre === 'start' || o.ancre === 'middle' || o.ancre === 'end') el.ancre = o.ancre;
        sortie.push(el);
      } else if (o.type === 'chemin') {
        const d = chaineBornee(o.d, 300);
        if (!d || analyserChemin(d) === null) return null;
        const el: Extract<SceneElement, { type: 'chemin' }> = { ...base, type: 'chemin', d };
        if (o.flux && typeof o.flux === 'object') {
          const f = o.flux as Record<string, unknown>;
          const vitesse = validerCoord(f.vitesse ?? 40);
          const nombre = nombreFini(f.nombre);
          const rayon = nombreFini(f.rayon);
          if (vitesse === null) return null;
          el.flux = {
            vitesse,
            nombre: Math.min(12, Math.max(1, Math.round(nombre ?? 5))),
            rayon: Math.min(8, Math.max(1, rayon ?? 3)),
          };
          const cf = couleurSure(f.couleur);
          if (cf) el.flux.couleur = cf;
        }
        sortie.push(el);
      } else if (o.type === 'courbe') {
        const fonction = chaineBornee(o.fonction, 200);
        const xmin = validerCoord(o.xmin ?? -5); const xmax = validerCoord(o.xmax ?? 5);
        if (!fonction || xmin === null || xmax === null) return null;
        // x est autorisé dans la fonction ; les autres identifiants doivent être déclarés.
        let noeudFonction: Noeud;
        try {
          const analyse = analyserExpression(fonction);
          noeudFonction = analyse.noeud;
          for (const id of analyse.identifiants) if (id !== 'pi' && id !== 'x' && !idsConnus.has(id)) return null;
        } catch { return null; }
        // La fonction doit être finie sur une majorité de l'intervalle, aux réglages témoins.
        let okMajorite = false;
        for (const temoin of porteesTemoins) {
          const a = evaluerValeur(xmin, temoin); const b = evaluerValeur(xmax, temoin);
          if (!(a < b)) continue;
          let finis = 0;
          for (let i = 0; i <= 20; i++) {
            const x = a + ((b - a) * i) / 20;
            if (Number.isFinite(evaluerNoeud(noeudFonction, { ...temoin, x }))) finis++;
          }
          if (finis >= 14) { okMajorite = true; break; }
        }
        if (!okMajorite) return null;
        const origineBrute = Array.isArray(o.origine) ? o.origine : [largeur / 2, hauteur / 2];
        const echelleBrute = Array.isArray(o.echelle) ? o.echelle : [25, 25];
        const ox = nombreFini(origineBrute[0]); const oy = nombreFini(origineBrute[1]);
        const ex = nombreFini(echelleBrute[0]); const ey = nombreFini(echelleBrute[1] ?? echelleBrute[0]);
        if (ox === null || oy === null || ex === null || ey === null || ex <= 0 || ey <= 0) return null;
        sortie.push({ ...base, type: 'courbe', fonction, xmin, xmax, origine: [ox, oy], echelle: [ex, ey] });
      } else if (o.type === 'groupe') {
        if (profondeur >= 1) return null;
        const enfants = validerElements(o.elements, profondeur + 1);
        if (enfants === null) return null;
        const el: Extract<SceneElement, { type: 'groupe' }> = { type: 'groupe', elements: enfants };
        if (o.rotation && typeof o.rotation === 'object') {
          const r = o.rotation as Record<string, unknown>;
          const angle = validerCoord(r.angle ?? 0);
          const cx = nombreFini(r.cx); const cy = nombreFini(r.cy);
          if (angle === null || cx === null || cy === null) return null;
          el.rotation = { angle, cx, cy };
        }
        sortie.push(el);
      } else {
        return null; // type inconnu : la scène entière est rejetée (le serveur rejoue ou retombe sur le texte)
      }
    }
    return sortie;
  };
  const elements = validerElements(s.elements, 0);
  if (elements === null || elements.length === 0) return null;

  // Affichages : expressions finies dans chaque témoin. Un affichage inexploitable (par exemple « f(x) » =
  // « a*log(x) », « x » n'existant pas hors courbe) est ABANDONNÉ, pas fatal : c'est un relevé décoratif,
  // la scène reste juste sans lui (même incident du 13/11/2026).
  const affichages: SceneAffichage[] = [];
  for (const a of (Array.isArray(s.affichages) ? s.affichages : []).slice(0, 6)) {
    if (!a || typeof a !== 'object') return null;
    const o = a as Record<string, unknown>;
    const etiquette = chaineBornee(o.etiquette, 40);
    const expression = chaineBornee(o.expression, 200);
    if (!etiquette || !expression) return null;
    let valide = true;
    for (const temoin of porteesTemoins) if (!expressionValide(expression, idsConnus, temoin)) { valide = false; break; }
    if (!valide) continue;
    const dec = nombreFini(o.decimales);
    const aff: SceneAffichage = { etiquette, expression, decimales: Math.min(4, Math.max(0, Math.round(dec ?? 2))) };
    const unite = chaineBornee(o.unite, 8);
    if (unite) aff.unite = unite;
    affichages.push(aff);
  }

  // Paramètres réellement référencés : un curseur qui ne change RIEN (ni un élément, ni une variable
  // conservée, ni un affichage conservé) est un faux bouton pour l'élève — le paramètre orphelin est
  // retiré de la scène plutôt que d'être affiché inerte (retour de Benny du 13/11/2026 : « il ne fait rien »).
  const utilises = new Set<string>();
  const refsDe = (source: string) => {
    try {
      for (const id of analyserExpression(source).identifiants) utilises.add(id);
    } catch { /* chaîne non expression (couleur, texte libre…) : déjà traitée par la validation */ }
  };
  const collecter = (liste: SceneElement[]) => {
    const coord = (v: number | string | undefined) => {
      if (typeof v === 'string') refsDe(v);
    };
    for (const el of liste) {
      switch (el.type) {
        case 'ligne':
        case 'ressort':
          coord(el.x1); coord(el.y1); coord(el.x2); coord(el.y2);
          break;
        case 'cercle':
          coord(el.cx); coord(el.cy); coord(el.r);
          break;
        case 'rectangle':
          coord(el.x); coord(el.y); coord(el.largeur); coord(el.hauteur);
          break;
        case 'polygone':
          for (const [px, py] of el.points) { coord(px); coord(py); }
          break;
        case 'texte':
          coord(el.x); coord(el.y);
          for (const m of el.contenu.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) utilises.add(m[1]);
          break;
        case 'chemin':
          if (el.flux) coord(el.flux.vitesse);
          break;
        case 'courbe':
          refsDe(el.fonction); coord(el.xmin); coord(el.xmax);
          break;
        case 'groupe':
          if (el.rotation) coord(el.rotation.angle);
          collecter(el.elements);
          break;
      }
    }
  };
  for (const v of variables) refsDe(v.expression);
  collecter(elements);
  for (const a of affichages) refsDe(a.expression);
  const parametresUtiles = parametres.filter((p) => utilises.has(p.id));

  return { titre, largeur, hauteur, parametres: parametresUtiles, variables, elements, affichages };
}

// ---------------------------------------------------------------------------
// Contexte d'évaluation pour le rendu (paramètres courants + temps)
// ---------------------------------------------------------------------------

/** Portée complète à l'instant t : paramètres, puis variables dans l'ordre de déclaration. */
export function contexteScene(scene: SceneChat, valeurs: Record<string, number>, t: number): PorteeScene {
  const portee: PorteeScene = { t };
  for (const p of scene.parametres) portee[p.id] = valeurs[p.id] ?? p.defaut;
  for (const v of scene.variables) portee[v.id] = evaluerValeur(v.expression, portee);
  return portee;
}

/** Formate un nombre « à la française » (virgule décimale), comme le reste du labo. */
export function formaterValeurScene(v: number, decimales = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(decimales).replace('.', ',');
}

/** Remplace les {identifiants} d'un texte de scène par leurs valeurs formatées (2 décimales). */
export function texteScene(contenu: string, portee: PorteeScene): string {
  return contenu.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, id: string) => {
    const v = id === 'pi' ? Math.PI : portee[id];
    return typeof v === 'number' ? formaterValeurScene(v) : m;
  });
}

// ---------------------------------------------------------------------------
// Géométrie : ressort en zigzag, courbe échantillonnée, chemin (pour le flux)
// ---------------------------------------------------------------------------

/** Points du zigzag d'un ressort entre deux extrémités (même tracé que le moteur du banc). */
export function pointsRessort(x1: number, y1: number, x2: number, y2: number, spires: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const amp = Math.min(9, len / (spires + 1));
  const pts: string[] = [`${x1},${y1}`];
  for (let i = 1; i <= spires; i++) {
    const f = i / (spires + 1);
    const signe = i % 2 === 0 ? -1 : 1;
    pts.push(`${(x1 + dx * f + px * amp * signe).toFixed(1)},${(y1 + dy * f + py * amp * signe).toFixed(1)}`);
  }
  pts.push(`${x2},${y2}`);
  return pts.join(' ');
}

/** Échantillonne y = fonction(x) en 81 points, convertis dans le repère de la scène. */
export function pointsCourbe(el: Extract<SceneElement, { type: 'courbe' }>, portee: PorteeScene): string {
  let noeud: Noeud;
  try {
    noeud = analyserExpression(el.fonction).noeud;
  } catch {
    return '';
  }
  const xmin = evaluerValeur(el.xmin, portee);
  const xmax = evaluerValeur(el.xmax, portee);
  const [ox, oy] = el.origine;
  const [ex, ey] = el.echelle;
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = xmin + ((xmax - xmin) * i) / 80;
    const y = evaluerNoeud(noeud, { ...portee, x });
    if (!Number.isFinite(y)) continue;
    pts.push(`${(ox + x * ex).toFixed(1)},${(oy - y * ey).toFixed(1)}`);
  }
  return pts.join(' ');
}

type SegmentChemin =
  | { k: 'ligne'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'cubique'; x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number }
  | { k: 'quad'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number };

export type EchantillonneurChemin = { longueur: number; pointA: (distance: number) => { x: number; y: number } };

/**
 * Analyse un chemin SVG limité aux commandes M L H V C Q Z (absolues ou relatives) et prépare
 * l'échantillonnage par longueur (pour faire circuler le flux : courant, eau…). Renvoie null si le
 * chemin contient autre chose (arc, courbe lissée…) ou est mal formé.
 */
export function analyserChemin(d: string): EchantillonneurChemin | null {
  const jetonsChemin = d.match(/[MLHVCQZmlhvcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  // La relecture doit couvrir exactement la chaîne (hors espaces et virgules) : sinon, contenu suspect.
  if (!jetonsChemin || jetonsChemin.join('') !== d.replace(/[\s,]/g, '')) return null;
  const segments: SegmentChemin[] = [];
  let i = 0;
  let commande = '';
  let cx = 0;
  let cy = 0;
  let departX = 0;
  let departY = 0;
  const lireNombre = (): number | null => {
    if (i >= jetonsChemin.length) return null;
    const v = Number(jetonsChemin[i]);
    if (Number.isNaN(v)) return null;
    i++;
    return v;
  };
  try {
    while (i < jetonsChemin.length) {
      const tk = jetonsChemin[i];
      if (/[A-Za-z]/.test(tk)) { commande = tk; i++; }
      if (!commande) return null;
      const rel = commande === commande.toLowerCase();
      const C = commande.toUpperCase();
      if (C === 'Z') {
        if (cx !== departX || cy !== departY) segments.push({ k: 'ligne', x1: cx, y1: cy, x2: departX, y2: departY });
        cx = departX; cy = departY;
        commande = '';
        continue;
      }
      if (C === 'M') {
        const x = lireNombre(); const y = lireNombre();
        if (x === null || y === null) return null;
        cx = rel ? cx + x : x; cy = rel ? cy + y : y;
        departX = cx; departY = cy;
        commande = rel ? 'l' : 'L'; // les paires suivantes d'un M sont des lignes implicites
        continue;
      }
      if (C === 'L') {
        const x = lireNombre(); const y = lireNombre();
        if (x === null || y === null) return null;
        const nx = rel ? cx + x : x; const ny = rel ? cy + y : y;
        segments.push({ k: 'ligne', x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx; cy = ny;
        continue;
      }
      if (C === 'H') {
        const x = lireNombre();
        if (x === null) return null;
        const nx = rel ? cx + x : x;
        segments.push({ k: 'ligne', x1: cx, y1: cy, x2: nx, y2: cy });
        cx = nx;
        continue;
      }
      if (C === 'V') {
        const y = lireNombre();
        if (y === null) return null;
        const ny = rel ? cy + y : y;
        segments.push({ k: 'ligne', x1: cx, y1: cy, x2: cx, y2: ny });
        cy = ny;
        continue;
      }
      if (C === 'C') {
        const v = [lireNombre(), lireNombre(), lireNombre(), lireNombre(), lireNombre(), lireNombre()];
        if (v.some((n) => n === null)) return null;
        const [a, b, c2, d2, e, f] = v as number[];
        const seg: SegmentChemin = rel
          ? { k: 'cubique', x1: cx, y1: cy, cx1: cx + a, cy1: cy + b, cx2: cx + c2, cy2: cy + d2, x2: cx + e, y2: cy + f }
          : { k: 'cubique', x1: cx, y1: cy, cx1: a, cy1: b, cx2: c2, cy2: d2, x2: e, y2: f };
        segments.push(seg);
        cx = seg.x2; cy = seg.y2;
        continue;
      }
      if (C === 'Q') {
        const v = [lireNombre(), lireNombre(), lireNombre(), lireNombre()];
        if (v.some((n) => n === null)) return null;
        const [a, b, e, f] = v as number[];
        const seg: SegmentChemin = rel
          ? { k: 'quad', x1: cx, y1: cy, cx: cx + a, cy: cy + b, x2: cx + e, y2: cy + f }
          : { k: 'quad', x1: cx, y1: cy, cx: a, cy: b, x2: e, y2: f };
        segments.push(seg);
        cx = seg.x2; cy = seg.y2;
        continue;
      }
      return null; // commande non supportée (A, S, T…)
    }
  } catch {
    return null;
  }
  if (segments.length === 0) return null;

  const pointSegment = (seg: SegmentChemin, u: number): { x: number; y: number } => {
    if (seg.k === 'ligne') return { x: seg.x1 + (seg.x2 - seg.x1) * u, y: seg.y1 + (seg.y2 - seg.y1) * u };
    if (seg.k === 'quad') {
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      return { x: a * seg.x1 + b * seg.cx + c * seg.x2, y: a * seg.y1 + b * seg.cy + c * seg.y2 };
    }
    const a = Math.pow(1 - u, 3);
    const b = 3 * Math.pow(1 - u, 2) * u;
    const c = 3 * (1 - u) * u * u;
    const d2 = u * u * u;
    return { x: a * seg.x1 + b * seg.cx1 + c * seg.cx2 + d2 * seg.x2, y: a * seg.y1 + b * seg.cy1 + c * seg.cy2 + d2 * seg.y2 };
  };
  const longueurSegment = (seg: SegmentChemin): number => {
    let total = 0;
    let precedent = pointSegment(seg, 0);
    for (let s = 1; s <= 16; s++) {
      const p = pointSegment(seg, s / 16);
      total += Math.hypot(p.x - precedent.x, p.y - precedent.y);
      precedent = p;
    }
    return total;
  };
  const longueurs = segments.map(longueurSegment);
  const longueur = longueurs.reduce((a, b) => a + b, 0);
  if (!(longueur > 0)) return null;
  return {
    longueur,
    pointA: (distance: number) => {
      let reste = ((distance % longueur) + longueur) % longueur;
      for (let s = 0; s < segments.length; s++) {
        if (reste <= longueurs[s] || s === segments.length - 1) {
          const u = longueurs[s] > 0 ? Math.min(1, reste / longueurs[s]) : 0;
          return pointSegment(segments[s], u);
        }
        reste -= longueurs[s];
      }
      return pointSegment(segments[segments.length - 1], 1);
    },
  };
}

// ---------------------------------------------------------------------------
// Lisibilité des couleurs de scène : le modèle compose sur fond clair ; en thème sombre, un trait ou un
// texte sombre devient invisible sur le fond de la zone. Le moteur substitue l'encre du thème quand la
// couleur de la scène est trop proche du fond réel (celui de la zone, ou le remplissage de la forme
// pleine qui se trouve sous un texte). Les remplissages eux-mêmes ne sont jamais retouchés.
// ---------------------------------------------------------------------------

/** Luminance relative d'une couleur hexadécimale (#rgb ou #rrggbb) : 0 = noir, 1 = blanc. */
export function luminanceCouleur(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Garde la couleur de la scène si elle se détache du fond, sinon retombe sur l'encre du thème. */
export function couleurContrastee(couleur: string, fond: string, encre: string): string {
  return Math.abs(luminanceCouleur(couleur) - luminanceCouleur(fond)) < 0.18 ? encre : couleur;
}

/**
 * Remplissage de la forme pleine (rectangle ou cercle) la plus haute qui contient le point (x, y),
 * pour juger le contraste d'un texte posé dessus ; undefined si le texte flotte sur le fond de la zone.
 * La rotation des groupes est ignorée (approximation assumée : elle est rare sur les étiquettes).
 */
export function remplissageSous(elements: SceneElement[], x: number, y: number, portee: PorteeScene): string | undefined {
  let trouve: string | undefined;
  const visite = (liste: SceneElement[]) => {
    for (const el of liste) {
      if (el.type === 'rectangle' && el.remplissage) {
        const rx = evaluerValeur(el.x, portee);
        const ry = evaluerValeur(el.y, portee);
        if (x >= rx && x <= rx + evaluerValeur(el.largeur, portee) && y >= ry && y <= ry + evaluerValeur(el.hauteur, portee)) trouve = el.remplissage;
      } else if (el.type === 'cercle' && el.remplissage) {
        const dx = x - evaluerValeur(el.cx, portee);
        const dy = y - evaluerValeur(el.cy, portee);
        const r = evaluerValeur(el.r, portee);
        if (dx * dx + dy * dy <= r * r) trouve = el.remplissage;
      } else if (el.type === 'groupe') {
        visite(el.elements);
      }
    }
  };
  visite(elements);
  return trouve;
}
