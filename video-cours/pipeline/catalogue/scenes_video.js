// Catalogue des scènes : une fonction de rendu par scène (HTML + SVG), pilotée par le temps t (secondes).
// Chaque scène reçoit ses paramètres (variante A ou B) et dessine son état à l'instant t.

const K = (tex, disp = true) => katex.renderToString(tex, { throwOnError: false, displayMode: disp });
const KI = tex => katex.renderToString(tex, { throwOnError: false, displayMode: false });
const pr = (t, t0, d = 0.6) => { const x = Math.min(1, Math.max(0, (t - t0) / d)); return 1 - Math.pow(1 - x, 3); };
const fd = (t, t0, d = 0.6, dy = 18) => { const k = pr(t, t0, d); return `opacity:${k.toFixed(3)};transform:translateY(${((1 - k) * dy).toFixed(1)}px)`; };
const lerp = (a, b, k) => a + (b - a) * k;
const VERT = '#10B981', JAUNE = '#FFD83D', ENCRE = '#0A0A0A';
// Taille de texte selon la longueur : un texte long réduit sa taille au lieu de déborder du cadre.
const tailleTexte = (s, base) => { const n = String(s).length; return n <= 120 ? base : n <= 200 ? Math.round(base * 0.75) : Math.round(base * 0.6); };
const riche = s => (/[\\^_{}]/.test(s) ? KI(s) : s);
// Texte avec formules entre $...$ : chaque partie LaTeX est rendue en ligne.
const mathe = s => String(s).replace(/\$([^$]+)\$/g, (_, tex) => KI(tex));

function fleche(x1, y1, x2, y2, k, couleur = ENCRE, w = 6) {
  const ex = lerp(x1, x2, k), ey = lerp(y1, y2, k);
  const a = Math.atan2(y2 - y1, x2 - x1), h = 22;
  const p1 = [ex - h * Math.cos(a - 0.45), ey - h * Math.sin(a - 0.45)];
  const p2 = [ex - h * Math.cos(a + 0.45), ey - h * Math.sin(a + 0.45)];
  return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${couleur}" stroke-width="${w}" stroke-linecap="round"/>` +
    (k > 0.05 ? `<polygon points="${ex},${ey} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}" fill="${couleur}"/>` : '');
}
const tracer = (d, k, couleur = ENCRE, w = 6, extra = '') =>
  `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - k).toFixed(4)}" fill="none" stroke="${couleur}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const cell = (x, y, c, t0, t, extra = '') => `<div style="position:absolute;${extra}">${''}</div>`;

const R = {};

R.titre = (p, t) => `
  <div style="position:absolute;left:0;top:90px;width:1740px;font-family:'Archivo Black';font-size:118px;line-height:1.05;${fd(t, 0.2, 0.8)}">${p.titre}</div>
  <div style="position:absolute;left:0;top:300px;height:20px;border:3px solid ${ENCRE};background:${VERT};width:${Math.round(pr(t, 0.9, 0.9) * 900)}px"></div>
  ${p.sousTitre ? `<div style="position:absolute;left:0;top:360px;font-size:46px;${fd(t, 1.8, 0.6)}">${p.sousTitre}</div>` : ''}`;

R.phrase = (p, t) => `
  <div style="position:absolute;left:0;top:140px;width:1700px;font-size:${tailleTexte(p.texte, 76)}px;line-height:1.4">
    ${(String(p.texte).match(/\$[^$]+\$|\S+/g) || []).map((m, i) => `<span style="display:inline-block;margin-right:14px;${fd(t, 0.2 + i * 0.18, 0.4, 8)}">${mathe(m)}</span>`).join('')}
  </div>`;

R.definition = (p, t) => `
  <div class="bloc jaune" style="position:absolute;left:0;top:30px;width:560px;${fd(t, 0.2)}"><div class="petit">Terme</div><div class="gros">${p.terme}</div></div>
  <div class="bloc" style="position:absolute;left:0;top:220px;width:1700px;${fd(t, 1.2)}"><div style="font-size:50px;line-height:1.35">${riche(p.texte)}</div></div>
  ${p.exemple ? `<div class="bloc vert" style="position:absolute;left:0;top:470px;width:1700px;font-size:44px;${fd(t, 2.9)}"><b>Exemple :</b> <span style="font-size:48px">${riche(p.exemple)}</span></div>` : ''}`;

R.points = (p, t) => {
  const n = p.points.length, pas = n > 4 ? 112 : 160;
  return p.points.map((s, i) => `
    <div style="position:absolute;left:0;top:${20 + i * pas}px;width:1700px;display:flex;align-items:center;gap:36px;${fd(t, 0.4 + i * 0.9)}">
      <div style="width:56px;height:56px;flex:none;border:4px solid ${ENCRE};border-radius:8px;background:${pr(t, 0.9 + i * 0.9, 0.3) > 0.5 ? VERT : '#FFFFFF'}"></div>
      <div style="font-size:${n > 4 ? 42 : 52}px;font-weight:700">${mathe(s)}</div></div>`).join('');
};

R.formule = (p, t) => `
  <div style="position:absolute;left:0;right:0;top:120px;text-align:center;font-size:${String(p.tex).length > 60 ? 58 : String(p.tex).length > 30 ? 80 : 110}px;${fd(t, 0.3, 0.9)}">${K(p.tex)}</div>`;

R.demonstration = (p, t) => {
  const n = p.etapes.length, pas = n > 4 ? 104 : 140;
  return p.etapes.map((e, i) => `
    <div class="bloc" style="position:absolute;left:0;top:${i * pas}px;width:1700px;height:${pas - 16}px;box-sizing:border-box;display:flex;align-items:center;gap:30px;padding:0 30px;${fd(t, 0.3 + i * 1.1)}">
      <div style="width:60px;height:60px;flex:none;border-radius:50%;border:3px solid ${ENCRE};background:${i === n - 1 ? JAUNE : VERT};display:flex;align-items:center;justify-content:center;font-family:'Archivo Black';font-size:30px">${i + 1}</div>
      <div style="font-size:44px">${K(e, false)}</div></div>`).join('');
};

R.cas = (p, t) => {
  const libelles = ['Delta < 0', 'Delta = 0', 'Delta > 0'];
  const textes = ['Aucune solution', 'Une solution double', 'Deux solutions'];
  const decal = [1, 0, -1];
  const pts = off => { let d = ''; for (let x = -2; x <= 2.001; x += 0.1) d += (d ? 'L' : 'M') + (150 + x * 60).toFixed(1) + ',' + (210 - (x * x + off) * 40).toFixed(1); return d; };
  return [0, 1, 2].map(i => {
    const actif = i === p.actif, k = pr(t, 0.9, 0.5);
    const estime = actif ? JAUNE : '#FFFFFF';
    const opac = actif ? 1 : (k > 0 ? 0.3 : 1);
    return `<div class="bloc" style="position:absolute;left:${i * 580}px;top:0;width:540px;height:560px;background:${estime};opacity:${opac};${fd(t, 0.2 + i * 0.25)}">
      <div class="petit">${libelles[i]}</div>
      <svg width="480" height="300" viewBox="0 0 300 300" style="margin-top:16px">
        <line x1="0" y1="210" x2="300" y2="210" stroke="${ENCRE}" stroke-width="3"/>
        <path d="${pts(decal[i])}" fill="none" stroke="${ENCRE}" stroke-width="6"/>
      </svg>
      <div class="gros" style="margin-top:18px;font-size:44px">${textes[i]}</div></div>`;
  }).join('');
};

R.recap = (p, t) => {
  const n = p.etapes.length, pas = n > 4 ? 104 : 140;
  return p.etapes.map((e, i) => `
    <div class="bloc ${i === n - 1 ? 'vert' : ''}" style="position:absolute;left:0;top:${i * pas}px;width:1700px;height:${pas - 16}px;box-sizing:border-box;display:flex;align-items:center;padding:0 32px;${fd(t, 0.3 + i * 0.9)}">
      <div style="font-size:48px;font-weight:700">${i + 1}. ${riche(e)}</div></div>`).join('');
};

R.formuleLigne = (p, t) => `
  <div style="position:absolute;left:0;top:200px;width:1700px;font-size:60px;line-height:1.7;${fd(t, 0.2)}">
    ${p.texte} <span style="background:${JAUNE};padding:4px 16px;border:3px solid ${ENCRE};border-radius:8px;${fd(t, 1.2, 0.5, 0)}">${KI(p.tex)}</span> ${p.suite || ''}
  </div>`;

R.tableau = (p, t) => {
  const lignes = p.lignes.map((l, i) => `<tr style="${fd(t, 0.4 + i * 0.6, 0.4, 0)};background:${i === p.surlignee ? JAUNE : '#FFFFFF'}">${l.map(c => `<td>${mathe(c)}</td>`).join('')}</tr>`).join('');
  return `<table style="position:absolute;left:0;top:40px;width:1740px;font-size:44px"><thead><tr>${p.entetes.map(h => `<th style="font-weight:700">${mathe(h)}</th>`).join('')}</tr></thead><tbody>${lignes}</tbody></table>`;
};

R.comparaison = (p, t) => {
  const lignes = p.criteres.map((c, i) => `<tr style="${fd(t, 0.6 + i * 0.7, 0.4, 0)}"><td style="font-weight:700">${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td></tr>`).join('');
  return `<table style="position:absolute;left:0;top:40px;width:1740px;font-size:44px">
    <thead><tr><th></th>${p.colonnes.map(h => `<th style="font-weight:700">${h}</th>`).join('')}</tr></thead>
    <tbody>${lignes}</tbody></table>`;
};

R.qcm = (p, t) => {
  const opts = p.options.map((o, i) => {
    const bon = i === p.reponse && t >= 3.4, autre = t >= 3.4 && i !== p.reponse;
    return `<div class="bloc ${bon ? 'vert' : ''}" style="position:absolute;left:0;top:${260 + i * 84}px;width:1000px;height:72px;box-sizing:border-box;display:flex;align-items:center;gap:24px;padding:0 24px;opacity:${autre ? 0.35 : 1};${fd(t, 0.8 + i * 0.4, 0.4, 0)}">
      <div style="width:44px;height:44px;flex:none;border:3px solid ${ENCRE};border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Archivo Black';font-size:26px">${String.fromCharCode(65 + i)}</div>
      <div style="font-size:40px">${o}</div></div>`;
  }).join('');
  return `<div class="bloc" style="position:absolute;left:0;top:0;width:1740px;height:200px;box-sizing:border-box;padding:30px 36px;${fd(t, 0.2)}"><div class="petit">Question</div><div style="font-size:48px;font-weight:700;margin-top:10px">${p.question}</div></div>${opts}`;
};

R.schemaAnnote = (p, t) => {
  const cx = 520, cy = 310;
  const cible = i => { const a = (-70 + i * (140 / Math.max(1, p.etiquettes.length - 1))) * Math.PI / 180; return [cx + Math.cos(a) * 170, cy + Math.sin(a) * 170]; };
  const svg = p.etiquettes.map((_, i) => {
    const [x2, y2] = cible(i), y1 = 150 + i * 100;
    return fleche(1100, y1 + 22, x2, y2, pr(t, 0.6 + i * 1.0, 0.8), ENCRE, 5);
  }).join('');
  const labels = p.etiquettes.map((e, i) => `<div style="position:absolute;left:1130px;top:${150 + i * 100}px;font-size:44px;font-weight:700;${fd(t, 1.0 + i * 1.0, 0.5, 0)}">${e}</div>`).join('');
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <rect x="${cx - 240}" y="${cy - 200}" width="480" height="400" rx="200" fill="${VERT}" stroke="${ENCRE}" stroke-width="5" opacity="${pr(t, 0.1, 0.8)}"/>
    <circle cx="${cx - 20}" cy="${cy - 10}" r="70" fill="${JAUNE}" stroke="${ENCRE}" stroke-width="5" opacity="${pr(t, 0.4, 0.6)}"/>
    ${svg}</svg>${labels}`;
};

R.frise = (p, t) => {
  const n = p.evenements.length;
  const ligne = `<div style="position:absolute;left:100px;top:300px;height:10px;background:${ENCRE};width:${Math.round(pr(t, 0.2, 1.2) * 1540)}px"></div>`;
  const ev = p.evenements.map((e, i) => {
    const x = 100 + i * (1540 / (n - 1)), haut = i % 2 === 0;
    return `<div style="position:absolute;left:${x - 14}px;top:293px;width:28px;height:28px;border-radius:50%;border:4px solid ${ENCRE};background:${VERT};opacity:${pr(t, 0.6 + i * 0.7, 0.4)}"></div>
      <div class="bloc ${i % 2 ? 'jaune' : ''}" style="position:absolute;left:${x - 150}px;top:${haut ? 40 : 360}px;width:300px;text-align:center;${fd(t, 0.9 + i * 0.7, 0.5, haut ? 14 : -14)}">
        <div style="font-family:'Archivo Black';font-size:40px">${e.date}</div><div style="font-size:28px;margin-top:6px">${e.texte}</div></div>`;
  }).join('');
  return ligne + ev;
};

R.carte = (p, t) => {
  const contour = [[420, 80], [1400, 60], [1450, 470], [380, 500]].map(q => q.join(',')).join(' ');
  const zonesPts = [[[500, 120], [900, 100], [950, 380], [560, 420]], [[980, 140], [1300, 160], [1280, 430], [1000, 400]]];
  const zones = p.zones.map((nom, i) => {
    const pts = zonesPts[i].map(q => q.join(',')).join(' ');
    const k = pr(t, 0.6 + i * 1.2, 0.8);
    return `<polygon points="${pts}" fill="${i ? JAUNE : VERT}" stroke="${ENCRE}" stroke-width="5" opacity="${k}"/>
      <text x="${zonesPts[i][0][0] + 40}" y="${zonesPts[i][0][1] + 180}" font-family="Space Grotesk" font-weight="700" font-size="40" fill="${ENCRE}" opacity="${k}">${nom}</text>`;
  }).join('');
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <polygon points="${contour}" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="5" opacity="${pr(t, 0.1, 0.6)}"/>${zones}</svg>`;
};

R.grapheFonction = (p, t) => {
  const sx = x => 100 + (x - p.xmin) / (p.xmax - p.xmin) * 1540;
  const sy = y => 560 - (y - p.ymin) / (p.ymax - p.ymin) * 540;
  const pas = (p.xmax - p.xmin) / 300;
  let d = '';
  for (let x = p.xmin; x <= p.xmax + 1e-9; x += pas) d += (d ? 'L' : 'M') + sx(x).toFixed(1) + ',' + sy(p.a * x * x + p.b * x + p.c).toFixed(1);
  const xs = -p.b / (2 * p.a), ys = p.c - p.b * p.b / (4 * p.a);
  const D = p.b * p.b - 4 * p.a * p.c;
  let marques = '';
  if (p.racines && D >= 0) {
    [(-p.b - Math.sqrt(D)) / (2 * p.a), (-p.b + Math.sqrt(D)) / (2 * p.a)].forEach(r => {
      marques += `<circle cx="${sx(r)}" cy="${sy(0)}" r="13" fill="${JAUNE}" stroke="${ENCRE}" stroke-width="4" opacity="${pr(t, 3.2, 0.4)}"/>`;
    });
  }
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <line x1="100" y1="${sy(0)}" x2="1640" y2="${sy(0)}" stroke="${ENCRE}" stroke-width="3" opacity="0.5"/>
    <line x1="${sx(0)}" y1="20" x2="${sx(0)}" y2="600" stroke="${ENCRE}" stroke-width="3" opacity="0.5"/>
    ${tracer(d, pr(t, 0.3, 2.0), ENCRE, 8)}
    ${marques}
    <circle cx="${sx(xs)}" cy="${sy(ys)}" r="14" fill="${VERT}" stroke="${ENCRE}" stroke-width="4" opacity="${pr(t, 2.6, 0.4)}"/></svg>
    <div class="bloc vert" style="position:absolute;left:30px;top:10px;font-size:50px;${fd(t, 0.1)}">${K(p.tex, false)}</div>
    <div class="bloc jaune" style="position:absolute;right:30px;top:10px;font-size:36px;${fd(t, 2.8)}">Sommet : x = ${+xs.toFixed(2)}, y = ${+ys.toFixed(2)}</div>`;
};

R.geometrie = (p, t) => {
  if (p.forme === 'triangle') {
    const A = [200, 520], B = [1100, 520], C = [200, 80];
    return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
      ${tracer(`M${A}L${B}L${C}Z`, pr(t, 0.2, 1.4), ENCRE, 7)}
      <polyline points="${200 + 40},${520} ${240},${520 - 40} ${200},${520 - 40}" fill="none" stroke="${ENCRE}" stroke-width="4" opacity="${pr(t, 1.6, 0.4)}"/>
      <polygon points="${200},${520} ${240},${520} ${240},${480}" fill="${VERT}" opacity="${pr(t, 1.6, 0.4)}"/>
      <text x="650" y="580" font-family="Archivo Black" font-size="50" fill="${ENCRE}" opacity="${pr(t, 1.8, 0.4)}">${p.cotes[0]}</text>
      <text x="120" y="310" font-family="Archivo Black" font-size="50" fill="${ENCRE}" opacity="${pr(t, 1.8, 0.4)}">${p.cotes[1]}</text>
      <text x="700" y="250" font-family="Archivo Black" font-size="50" fill="${ENCRE}" opacity="${pr(t, 1.8, 0.4)}">${p.cotes[2]}</text></svg>
      <div class="bloc jaune" style="position:absolute;left:1180px;top:120px;width:520px;font-size:50px;${fd(t, 2.6)}">${K(p.tex, false)}</div>`;
  }
  const r = p.rayon * 80, cx = 520, cy = 310;
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${VERT}" fill-opacity="${pr(t, 2.0, 0.8) * 0.5}" stroke="${ENCRE}" stroke-width="7" stroke-dasharray="${2 * Math.PI * r}" stroke-dashoffset="${(1 - pr(t, 0.2, 1.4)) * 2 * Math.PI * r}"/>
    ${fleche(cx, cy, cx + r, cy, pr(t, 1.0, 0.8), ENCRE, 6)}
    <circle cx="${cx}" cy="${cy}" r="8" fill="${ENCRE}"/></svg>
    <div style="position:absolute;left:${cx + r / 2 - 60}px;top:${cy - 70}px;font-family:'Archivo Black';font-size:44px;${fd(t, 1.9, 0.4, 0)}">r = ${p.rayon} cm</div>
    <div class="bloc jaune" style="position:absolute;left:1000px;top:200px;width:700px;font-size:52px;${fd(t, 2.8)}">${K(p.tex, false)}</div>`;
};

R.vecteur = (p, t) => {
  const O = [400, 480], u = 70;
  const P = (x, y) => [O[0] + x * u, O[1] - y * u];
  let grille = '';
  for (let x = -2; x <= 7; x++) grille += `<line x1="${P(x, -2)[0]}" y1="${P(0, -2)[1]}" x2="${P(x, -2)[0]}" y2="${P(0, 5)[1]}" stroke="${ENCRE}" stroke-opacity="0.12" stroke-width="2"/>`;
  for (let y = -2; y <= 5; y++) grille += `<line x1="${P(-2, y)[0]}" y1="${P(-2, y)[1]}" x2="${P(7, y)[0]}" y2="${P(7, y)[1]}" stroke="${ENCRE}" stroke-opacity="0.12" stroke-width="2"/>`;
  const [ux, uy] = p.u, [vx, vy] = p.v || [0, 0];
  let s = grille;
  s += fleche(O[0], O[1], ...P(ux, uy), pr(t, 0.4, 0.9), VERT, 9);
  s += `<text x="${P(ux, uy)[0] + 14}" y="${P(ux, uy)[1] - 14}" font-family="Archivo Black" font-size="40">u</text>`;
  if (p.somme) {
    s += fleche(O[0], O[1], ...P(vx, vy), pr(t, 1.6, 0.9), JAUNE, 9);
    s += `<text x="${P(vx, vy)[0] + 14}" y="${P(vx, vy)[1] - 14}" font-family="Archivo Black" font-size="40">v</text>`;
    s += `<polyline points="${P(ux, uy)} ${P(ux + vx, uy + vy)} ${P(vx, vy)}" fill="none" stroke="${ENCRE}" stroke-width="4" stroke-dasharray="12 10" opacity="${pr(t, 2.6, 0.5)}"/>`;
    s += fleche(O[0], O[1], ...P(ux + vx, uy + vy), pr(t, 3.2, 0.9), ENCRE, 8);
    s += `<text x="${P(ux + vx, uy + vy)[0] + 14}" y="${P(ux + vx, uy + vy)[1] - 14}" font-family="Archivo Black" font-size="40" opacity="${pr(t, 3.6, 0.4)}">u + v</text>`;
  }
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">${s}</svg>
    ${p.somme ? '' : `<div class="bloc jaune" style="position:absolute;left:1000px;top:150px;width:640px;font-size:52px;${fd(t, 2.2)}">${K(p.norme, false)}</div>`}`;
};

R.histogramme = (p, t) => {
  const n = p.classes.length, max = Math.max(...p.effectifs), w = 1500 / n - 40;
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <line x1="100" y1="540" x2="1640" y2="540" stroke="${ENCRE}" stroke-width="5"/>
    ${p.effectifs.map((e, i) => {
      const h = e / max * 430 * pr(t, 0.4 + i * 0.5, 0.8), x = 120 + i * (1500 / n);
      return `<rect x="${x}" y="${540 - h}" width="${w}" height="${h}" fill="${i % 2 ? JAUNE : VERT}" stroke="${ENCRE}" stroke-width="5"/>
        <text x="${x + w / 2}" y="${540 - h - 14}" text-anchor="middle" font-family="Archivo Black" font-size="40" opacity="${pr(t, 0.4 + i * 0.5 + 0.8, 0.3)}">${e}</text>
        <text x="${x + w / 2}" y="590" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="32">${p.classes[i]}</text>`;
    }).join('')}</svg>`;
};

R.suite = (p, t) => {
  const u = [p.u0];
  for (let k = 1; k < p.N; k++) u.push(p.a * u[k - 1] + p.b);
  const M = u[u.length - 1] * 1.08, s = 480 / M, X = x => 120 + x * s, Y = y => 560 - y * s;
  const pts = [[u[0], 0]];
  for (let k = 0; k < u.length - 1; k++) { pts.push([u[k], u[k + 1]]); pts.push([u[k + 1], u[k + 1]]); }
  const d = pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join('');
  const f = [];
  for (let x = 0; x <= M; x += M / 60) f.push([x, Math.min(M, p.a * x + p.b)]);
  const df = f.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join('');
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <line x1="120" y1="560" x2="${X(M)}" y2="560" stroke="${ENCRE}" stroke-width="4"/>
    <line x1="120" y1="560" x2="120" y2="${Y(M)}" stroke="${ENCRE}" stroke-width="4"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(M)}" y2="${Y(M)}" stroke="${ENCRE}" stroke-width="3" stroke-dasharray="10 10" opacity="0.6"/>
    <path d="${df}" fill="none" stroke="${VERT}" stroke-width="6" opacity="${pr(t, 0.2, 0.6)}"/>
    ${tracer(d, pr(t, 0.6, 3.2), ENCRE, 6)}
    ${u.map((v, k) => `<text x="${X(v) + 10}" y="${Y(v) - 12}" font-family="Archivo Black" font-size="34" opacity="${pr(t, 0.8 + k * 0.7, 0.3)}">u${k}=${v}</text>`).join('')}
    </svg>
    <div class="bloc jaune" style="position:absolute;left:1000px;top:40px;width:680px;font-size:48px;${fd(t, 0.1)}">${K(p.tex, false)}</div>`;
};

R.chute = (p, t) => {
  const tf = Math.sqrt(2 * p.h / 9.8), tau = Math.min(t / 4, 1) * tf;
  const hauteur = Math.max(0, p.h - 4.9 * tau * tau), v = 9.8 * tau, sc = Math.min(470 / p.h, 60);
  const sol = 580, yBalle = sol - hauteur * sc - 34;
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <line x1="200" y1="${sol}" x2="1540" y2="${sol}" stroke="${ENCRE}" stroke-width="6"/>
    <line x1="870" y1="${sol - p.h * sc}" x2="870" y2="${sol}" stroke="${ENCRE}" stroke-width="3" stroke-dasharray="8 8" opacity="0.5"/>
    <circle cx="870" cy="${yBalle}" r="34" fill="${VERT}" stroke="${ENCRE}" stroke-width="6"/>
    <line x1="1000" y1="${sol - p.h * sc}" x2="1000" y2="${sol}" stroke="${ENCRE}" stroke-width="4"/>
    <text x="1020" y="${sol - p.h * sc / 2}" font-family="Archivo Black" font-size="40">${p.h} m</text></svg>
    <div class="bloc" style="position:absolute;left:0;top:10px;width:520px;font-size:44px;${fd(t, 0.1)}"><div>Hauteur : ${+hauteur.toFixed(1)} m</div><div style="margin-top:8px">Vitesse : ${+v.toFixed(1)} m/s</div></div>`;
};

R.forces = (p, t) => {
  const cx = 870, cy = 250, s = 1.0;
  let svg = `<rect x="${cx - 130}" y="${cy - 70}" width="260" height="140" rx="14" fill="${VERT}" stroke="${ENCRE}" stroke-width="6"/>`;
  let sx = 0, sy = 0;
  p.forces.forEach((f, i) => {
    const L = f.len * s, ex = cx + f.dx * L, ey = cy + f.dy * L;
    sx += f.dx * L; sy += f.dy * L;
    svg += fleche(cx, cy, ex, ey, pr(t, 0.4 + i * 0.8, 0.8), ENCRE, 9);
    svg += `<text x="${ex + (f.dx >= 0 ? 16 : -60)}" y="${ey + (f.dy >= 0 ? 52 : -18)}" font-family="Archivo Black" font-size="46" opacity="${pr(t, 0.6 + i * 0.8, 0.4)}">${f.nom}</text>`;
  });
  if (p.resultante) {
    svg += fleche(cx, cy, cx + sx, cy + sy, pr(t, 3.4, 0.9), JAUNE, 10);
    svg += `<text x="${cx + sx + 16}" y="${cy + sy - 16}" font-family="Archivo Black" font-size="46" opacity="${pr(t, 3.8, 0.4)}">F</text>`;
  }
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">${svg}</svg>
    <div class="bloc jaune" style="position:absolute;left:0;bottom:0;width:1200px;font-size:44px;${fd(t, 3.0)}">${p.legende || 'F = somme des forces'}</div>`;
};

R.circuit = (p, t) => {
  const x0 = 260, y0 = 140, W = 1220, H = 340, Pm = 2 * (W + H);
  const pt = s => {
    let d = s * Pm;
    if (d < W) return [x0 + d, y0];
    d -= W; if (d < H) return [x0 + W, y0 + d];
    d -= H; if (d < W) return [x0 + W - d, y0 + H];
    d -= W; return [x0, y0 + H - d];
  };
  let dots = '';
  for (let i = 0; i < 8; i++) {
    if (t < 0.6) break;
    const [x, y] = pt(((t * 0.12) + i / 8) % 1);
    dots += `<circle cx="${x}" cy="${y}" r="10" fill="${VERT}" stroke="${ENCRE}" stroke-width="3"/>`;
  }
  const res = p.resistances === 2
    ? `<rect x="${x0 + 540}" y="${y0 - 36}" width="120" height="72" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="6"/>
       <rect x="${x0 + 740}" y="${y0 - 36}" width="120" height="72" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="6"/>`
    : `<rect x="${x0 + 560}" y="${y0 - 36}" width="160" height="72" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="6"/>`;
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    ${tracer(`M${x0},${y0}L${x0 + W},${y0}L${x0 + W},${y0 + H}L${x0},${y0 + H}Z`, pr(t, 0.1, 1.0), ENCRE, 7)}
    <line x1="${x0 + 220}" y1="${y0 - 40}" x2="${x0 + 220}" y2="${y0 + 40}" stroke="${ENCRE}" stroke-width="10" opacity="${pr(t, 0.6, 0.4)}"/>
    <line x1="${x0 + 250}" y1="${y0 - 22}" x2="${x0 + 250}" y2="${y0 + 22}" stroke="${ENCRE}" stroke-width="6" opacity="${pr(t, 0.6, 0.4)}"/>
    ${res}
    <circle cx="${x0 + W}" cy="${y0 + H / 2}" r="44" fill="${JAUNE}" fill-opacity="${pr(t, 1.2, 0.6)}" stroke="${ENCRE}" stroke-width="6"/>
    ${dots}</svg>
    <div class="bloc" style="position:absolute;left:0;bottom:0;width:1740px;font-size:40px;${fd(t, 0.3)}">${p.label}</div>`;
};

R.grapheMouvement = (p, t) => {
  const sx = s => 150 + s * 250, sy = val => (p.mode === 'x' ? 560 - val * 16 : 560 - val * 28);
  const f = s => (p.mode === 'x' ? 0.75 * s * s : 3 * s);
  let d = '';
  for (let s = 0; s <= 6.001; s += 0.05) d += (d ? 'L' : 'M') + sx(s).toFixed(1) + ',' + sy(f(s)).toFixed(1);
  const fin = 6 * pr(t, 0.5, 3.2);
  let aire = '';
  if (p.mode === 'v') {
    let poly = `${sx(0)},560`;
    for (let s = 0; s <= fin + 1e-6; s += 0.05) poly += ` ${sx(s).toFixed(1)},${sy(f(s)).toFixed(1)}`;
    poly += ` ${sx(fin).toFixed(1)},560`;
    aire = `<polygon points="${poly}" fill="${VERT}" fill-opacity="0.55"/>`;
  }
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <line x1="150" y1="560" x2="1640" y2="560" stroke="${ENCRE}" stroke-width="5"/>
    <line x1="150" y1="560" x2="150" y2="20" stroke="${ENCRE}" stroke-width="5"/>
    ${aire}
    ${tracer(d, pr(t, 0.4, 3.0), ENCRE, 8)}
    ${[0, 2, 4, 6].map(s => `<text x="${sx(s) - 10}" y="600" font-family="Space Grotesk" font-weight="700" font-size="30">${s} s</text>`).join('')}
    </svg>
    <div class="bloc jaune" style="position:absolute;right:20px;top:0;font-size:52px;${fd(t, 0.1)}">${K(p.tex, false)}</div>
    ${p.mode === 'v' ? `<div class="bloc vert" style="position:absolute;left:260px;top:40px;font-size:40px;${fd(t, 3.4)}">Aire sous la courbe = distance parcourue</div>` : ''}`;
};

R.neutralisation = (p, t) => {
  const k = pr(t, 1.0, 2.0);
  let gouttes = '';
  for (let i = 0; i < 6; i++) {
    const x1 = 300 + (i % 3) * 70, y1 = 260 + Math.floor(i / 3) * 90;
    const x2 = 850 + (i % 3) * 20, y2 = 300 + Math.floor(i / 3) * 50;
    gouttes += `<circle cx="${lerp(x1, x2, k)}" cy="${lerp(y1, y2, k)}" r="14" fill="${VERT}" stroke="${ENCRE}" stroke-width="3" opacity="${1 - pr(t, 3.0, 0.8) * 0.7}"/>`;
    const x3 = 1250 + (i % 3) * 70;
    gouttes += `<circle cx="${lerp(x3, 1000 + (i % 3) * 20, k)}" cy="${lerp(y1, y2, k)}" r="14" fill="${JAUNE}" stroke="${ENCRE}" stroke-width="3" opacity="${1 - pr(t, 3.0, 0.8) * 0.7}"/>`;
  }
  const eau = [0, 1, 2, 3].map(i => `<circle cx="${780 + i * 60}" cy="${380 - (i % 2) * 40}" r="24" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="4" opacity="${pr(t, 3.2 + i * 0.2, 0.5)}"/>`).join('');
  const teinte = p.virage ? `${JAUNE}` : VERT;
  const couleur = p.virage ? `rgb(${Math.round(lerp(255, 16, pr(t, 2.5, 1.2)))},${Math.round(lerp(216, 185, pr(t, 2.5, 1.2)))},${Math.round(lerp(61, 129, pr(t, 2.5, 1.2)))})` : teinte;
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">
    <path d="M200,140 L560,140 L560,520 Q560,560 520,560 L240,560 Q200,560 200,520Z" fill="${VERT}" fill-opacity="0.35" stroke="${ENCRE}" stroke-width="6"/>
    <path d="M1180,140 L1540,140 L1540,520 Q1540,560 1500,560 L1220,560 Q1180,560 1180,520Z" fill="${JAUNE}" fill-opacity="0.35" stroke="${ENCRE}" stroke-width="6"/>
    <path d="M580,330 L1160,330 L1160,520 Q1160,560 1120,560 L620,560 Q580,560 580,520Z" fill="${couleur}" stroke="${ENCRE}" stroke-width="5" opacity="${pr(t, 0.2, 0.3)}"/>
    ${gouttes}${eau}</svg>
    <div class="bloc" style="position:absolute;left:0;bottom:0;width:1740px;font-size:50px;text-align:center;${fd(t, 0.5)}">${K(p.tex, false)}</div>
    ${p.virage ? `<div class="bloc jaune" style="position:absolute;right:0;top:0;font-size:38px;${fd(t, 3.0)}">Couleur : jaune → vert</div>` : ''}`;
};

R.equation = (p, t) => `
  <div style="position:absolute;left:0;right:0;top:0;text-align:center;font-size:90px;${fd(t, 0.2)}">${K(p.tex)}</div>
  <table style="position:absolute;left:370px;top:200px;width:1000px;font-size:44px">
    <thead><tr><th>Élément</th><th>Avant</th><th>Après</th></tr></thead>
    <tbody>${p.bilan.map((b, i) => `<tr style="${fd(t, 2.0 + i * 0.6, 0.4, 0)}"><td style="font-weight:700">${b[0]}</td><td>${b[1]}</td><td>${b[2]}</td></tr>`).join('')}</tbody></table>`;

R.molecule = (p, t) => {
  const liaisons = p.liaisons.map((q, i) => {
    const a = p.atomes[q[0]], b = p.atomes[q[1]];
    return fleche(a.x, a.y, b.x, b.y, pr(t, 0.3 + i * 0.5, 0.7), ENCRE, 9);
  }).join('');
  const atomes = p.atomes.map((a, i) => `<circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${a.c}" stroke="${ENCRE}" stroke-width="6" opacity="${pr(t, 1.6 + i * 0.4, 0.5)}"/>
    <text x="${a.x}" y="${a.y + 16}" text-anchor="middle" font-family="Archivo Black" font-size="${a.r > 60 ? 60 : 40}" opacity="${pr(t, 1.6 + i * 0.4, 0.5)}">${a.s}</text>`).join('');
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">${liaisons}${atomes}</svg>
    <div class="bloc" style="position:absolute;left:0;top:0;font-size:48px;${fd(t, 0.1)}">${p.nom}</div>`;
};

R.cycle = (p, t) => {
  const n = p.etapes.length, cx = 870, cy = 290, rayon = n > 4 ? 250 : 220, large = n > 4 ? 230 : 300;
  const pos = i => { const a = (-90 + i * 360 / n) * Math.PI / 180; return [cx + Math.cos(a) * rayon, cy + Math.sin(a) * rayon]; };
  let fl = '';
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pos(i), [x2, y2] = pos((i + 1) % n);
    fl += fleche(x1, y1, x2, y2, pr(t, 0.8 + i * 0.7, 0.6), ENCRE, 6);
  }
  const noeuds = p.etapes.map((e, i) => {
    const [x, y] = pos(i);
    return `<div class="bloc ${i === n - 1 ? 'jaune' : ''}" style="position:absolute;left:${x - large / 2}px;top:${y - 40}px;width:${large}px;height:80px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;font-size:30px;font-weight:700;padding:6px;${fd(t, 0.3 + i * 0.7, 0.4, 0)}">${e}</div>`;
  }).join('');
  return `<svg width="1740" height="620" style="position:absolute;left:0;top:0">${fl}</svg>${noeuds}`;
};

R.dialogue = (p, t) => {
  const n = p.repliques.length, pas = n > 2 ? 150 : 200;
  return p.repliques.map((r, i) => {
    const gauche = i % 2 === 0;
    return `<div class="bloc ${gauche ? '' : 'vert'}" style="position:absolute;left:${gauche ? 0 : 640}px;top:${i * pas}px;width:1100px;box-sizing:border-box;padding:18px 30px;${fd(t, 0.3 + i * 1.1, 0.5, gauche ? -14 : 14)}">
      <div class="petit">${r.nom}</div><div style="font-size:46px;margin-top:6px">${r.texte}</div></div>`;
  }).join('');
};

R.conjugaison = (p, t) => `
  <div style="position:absolute;left:0;top:0;font-size:52px;font-weight:700;${fd(t, 0.1)}">${p.verbe} · ${p.temps}</div>
  <table style="position:absolute;left:0;top:110px;width:1000px;font-size:44px">
    <tbody>${p.formes.map((f, i) => `<tr style="${fd(t, 0.6 + i * 0.6, 0.4, 0)}"><td style="font-weight:700;text-align:left">${f[0]}</td><td style="text-align:left">${f[1]}</td></tr>`).join('')}</tbody></table>`;

R.vocabulaire = (p, t) => p.mots.map((m, i) => {
  const col = i % 2, ligne = Math.floor(i / 2);
  return `<div class="bloc" style="position:absolute;left:${col * 860}px;top:${ligne * 180}px;width:820px;height:150px;box-sizing:border-box;display:flex;align-items:center;gap:30px;padding:16px 24px;${fd(t, 0.4 + i * 0.6)}">
    <div style="width:118px;height:118px;flex:none;border:3px solid ${ENCRE};border-radius:10px;background:${i % 2 ? JAUNE : VERT};display:flex;align-items:center;justify-content:center;font-family:'Archivo Black';font-size:64px">${m.mot.charAt(0).toUpperCase()}</div>
    <div><div style="font-size:52px;font-weight:700">${m.mot}</div><div style="font-size:38px;color:#5B5B55">${m.trad}</div></div></div>`;
}).join('');

R.secours = (p, t) => `
  <div style="position:absolute;left:0;top:0;width:${p.image ? 980 : 1740}px;${fd(t, 0.1)}">
    <div class="gros" style="font-size:72px">${p.titre}</div>
    <div style="font-size:42px;line-height:1.4;margin-top:22px">${p.texte}</div></div>
  ${p.image ? `<div class="bloc" style="position:absolute;left:1080px;top:0;width:660px;height:360px;box-sizing:border-box;background:${VERT};${fd(t, 0.2)}">
    <svg width="600" height="300" viewBox="0 0 600 300"><polygon points="20,280 240,70 380,220 460,140 580,280" fill="${JAUNE}" stroke="${ENCRE}" stroke-width="6"/><circle cx="470" cy="70" r="36" fill="#FFFFFF" stroke="${ENCRE}" stroke-width="6"/></svg></div>` : ''}
  <div style="position:absolute;left:0;bottom:0;width:1740px">${p.points.map((s, i) => `<div style="font-size:42px;font-weight:700;margin-top:10px;${fd(t, 1.2 + i * 0.9)}">— ${s}</div>`).join('')}</div>`;

// Le rendu s'appuie sur une seule fonction par identifiant de scène.
// Identifiants du catalogue (kebab-case) vers les fonctions de rendu.
window.RENDU = {
  'titre': R.titre, 'phrase': R.phrase, 'definition': R.definition, 'points-cles': R.points,
  'formule': R.formule, 'demonstration': R.demonstration, 'cas': R.cas, 'recap': R.recap,
  'formule-en-ligne': R.formuleLigne, 'tableau': R.tableau, 'comparaison': R.comparaison,
  'qcm-rappel': R.qcm, 'schema-annote': R.schemaAnnote, 'frise-chronologique': R.frise,
  'carte': R.carte, 'graphique-fonction': R.grapheFonction, 'geometrie-figure': R.geometrie,
  'vecteur': R.vecteur, 'statistiques-histogramme': R.histogramme, 'suite-escalier': R.suite,
  'mouvement-chute': R.chute, 'vecteurs-forces': R.forces, 'circuit-electrique': R.circuit,
  'graphique-mouvement': R.grapheMouvement, 'reaction-neutralisation': R.neutralisation,
  'equation-reaction': R.equation, 'molecule': R.molecule, 'cycle': R.cycle,
  'dialogue-2-voix': R.dialogue, 'conjugaison': R.conjugaison, 'vocabulaire-image': R.vocabulaire,
  'secours-generique': R.secours,
};

// Titres et paramètres : A et B. Les champs "approx" signalent une première version à relire.
window.CATALOGUE = [
  { id: 'titre', famille: 'texte', titre: 'Titre', auto: 'oui', difficulte: 'facile',
    A: { label: 'Titre seul', p: { titre: 'Les fonctions affines' } },
    B: { label: 'Titre avec sous-titre', p: { titre: 'Racines d’un polynôme', sousTitre: 'Seconde · équations du second degré' } } },
  { id: 'phrase', famille: 'texte', titre: 'Phrase', auto: 'oui', difficulte: 'facile',
    A: { label: 'Une phrase courte', p: { texte: 'Une phrase, un sous-titre, le texte apparaît mot après mot.' } },
    B: { label: 'Une phrase longue', p: { texte: 'Le discriminant décide du nombre de solutions de l’équation, et chaque cas se lit directement sur le signe de ce nombre.' } } },
  { id: 'definition', famille: 'texte', titre: 'Définition', auto: 'oui', difficulte: 'facile',
    A: { label: 'Définition avec exemple', p: { terme: 'Fonction affine', texte: 'Fonction de la forme f(x) = ax + b, où a et b sont deux réels.', exemple: 'f(x) = 2x + 1' } },
    B: { label: 'Définition sans exemple', p: { terme: 'Limite', texte: 'Valeur vers laquelle f(x) se rapproche quand x s’approche d’une valeur.' } } },
  { id: 'points-cles', famille: 'texte', titre: 'Points clés', auto: 'oui', difficulte: 'facile',
    A: { label: 'Trois points', p: { points: ['Le coefficient a donne la pente', 'Le coefficient b donne l’ordonnée à l’origine', 'La courbe est une droite'] } },
    B: { label: 'Cinq points', p: { points: ['Le signe de a', 'Le sommet', 'L’axe de symétrie', 'Les racines', 'Le tableau de signes'] } } },
  { id: 'formule', famille: 'formules', titre: 'Formule', auto: 'oui', difficulte: 'facile',
    A: { label: 'Discriminant', p: { tex: '\\Delta = b^2 - 4ac' } },
    B: { label: 'Solution', p: { tex: 'x = \\dfrac{-b}{2a}' } } },
  { id: 'demonstration', famille: 'formules', titre: 'Démonstration pas à pas', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Trois étapes', p: { etapes: ['a x^2 + b x + c = a\\left(x^2 + \\dfrac{b}{a}x\\right) + c', 'x^2 + \\dfrac{b}{a}x = \\left(x + \\dfrac{b}{2a}\\right)^2 - \\dfrac{b^2}{4a^2}', 'a x^2 + b x + c = a\\left(x + \\dfrac{b}{2a}\\right)^2 - \\dfrac{\\Delta}{4a}'] } },
    B: { label: 'Cinq étapes', p: { etapes: ['\\text{On pose } \\Delta = b^2 - 4ac', '\\text{Si } \\Delta \\ge 0 \\text{, on factorise}', 'a x^2 + b x + c = a(x - x_1)(x - x_2)', 'x_{1,2} = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}', '\\text{Le signe de } \\Delta \\text{ fixe le nombre de solutions}'] } } },
  { id: 'cas', famille: 'formules', titre: 'Cas selon le signe', auto: 'oui', difficulte: 'facile',
    A: { label: 'Cas Delta négatif', p: { actif: 0 } },
    B: { label: 'Cas Delta positif', p: { actif: 2 } } },
  { id: 'recap', famille: 'formules', titre: 'Récapitulatif', auto: 'oui', difficulte: 'facile',
    A: { label: 'Trois étapes', p: { etapes: ['Calculer le discriminant', 'Lire le signe de Delta', 'Trouver les solutions'] } },
    B: { label: 'Cinq étapes', p: { etapes: ['Repérer a, b et c', 'Calculer Delta', 'Comparer Delta à zéro', 'Appliquer la formule', 'Vérifier en remplaçant'] } } },
  { id: 'formule-en-ligne', famille: 'formules', titre: 'Formule en ligne', auto: 'partiel', difficulte: 'facile',
    A: { label: 'Carré dans une phrase', p: { texte: 'Le carré de x s’écrit', tex: 'x^2', suite: 'et se lit « x au carré ».' } },
    B: { label: 'Racine dans une phrase', p: { texte: 'Une racine carrée se note', tex: '\\sqrt{\\Delta}', suite: 'quand Delta est positif.' } } },
  { id: 'tableau', famille: 'tableaux', titre: 'Tableau', auto: 'oui', difficulte: 'facile',
    A: { label: 'Trois colonnes, ligne surlignée', p: { entetes: ['Forme', 'Exemple', 'Courbe'], lignes: [['ax + b', '2x + 1', 'droite'], ['ax²', 'x²', 'parabole'], ['a/x', '1/x', 'hyperbole'], ['√x', '√x', 'demi-parabole']], surlignee: 1 } },
    B: { label: 'Deux colonnes', p: { entetes: ['Nombre', 'Carré'], lignes: [['2', '4'], ['3', '9'], ['5', '25'], ['7', '49'], ['10', '100']], surlignee: null } } },
  { id: 'comparaison', famille: 'tableaux', titre: 'Comparaison', auto: 'oui', difficulte: 'facile',
    A: { label: 'Quatre critères', p: { colonnes: ['Fonction affine', 'Fonction carré'], criteres: [['Forme', 'ax + b', 'ax² + bx + c'], ['Courbe', 'Droite', 'Parabole'], ['Variation', 'Monotone', 'Change de sens'], ['Sommet', 'Aucun', 'Un']] } },
    B: { label: 'Deux critères', p: { colonnes: ['Dérivée', 'Valeur'], criteres: [['Pour ax + b', 'a', 'constante'], ['Pour ax²', '2ax', 'variable']] } } },
  { id: 'qcm-rappel', famille: 'tableaux', titre: 'QCM de rappel', auto: 'oui', difficulte: 'facile',
    A: { label: 'Quatre options', p: { question: 'Quelle est la courbe de f(x) = 2x + 1 ?', options: ['Une droite', 'Une parabole', 'Une hyperbole', 'Un cercle'], reponse: 0 } },
    B: { label: 'Trois options', p: { question: 'Combien de solutions si Delta est négatif ?', options: ['Aucune', 'Une', 'Deux'], reponse: 0 } } },
  { id: 'schema-annote', famille: 'schemas', titre: 'Schéma annoté', auto: 'partiel', difficulte: 'moyenne', approx: true,
    A: { label: 'Deux étiquettes', p: { etiquettes: ['Noyau', 'Membrane'] } },
    B: { label: 'Quatre étiquettes', p: { etiquettes: ['Noyau', 'Membrane', 'Cytoplasme', 'Paroi'] } } },
  { id: 'frise-chronologique', famille: 'schemas', titre: 'Frise chronologique', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Quatre dates', p: { evenements: [{ date: '1789', texte: 'Révolution française' }, { date: '1804', texte: 'Code civil' }, { date: '1848', texte: 'Abolition de l’esclavage' }, { date: '1905', texte: 'Séparation des Églises' }] } },
    B: { label: 'Six dates', p: { evenements: [{ date: '1815', texte: 'Congrès de Vienne' }, { date: '1830', texte: 'Révolution de Juillet' }, { date: '1848', texte: 'Printemps des peuples' }, { date: '1871', texte: 'Commune de Paris' }, { date: '1889', texte: 'Exposition universelle' }, { date: '1914', texte: 'Début de la guerre' }] } } },
  { id: 'carte', famille: 'schemas', titre: 'Carte', auto: 'partiel', difficulte: 'élevée', approx: true,
    A: { label: 'Une zone colorée', p: { zones: ['Zone nord'] } },
    B: { label: 'Deux zones colorées', p: { zones: ['Zone nord', 'Zone sud'] } } },
  { id: 'graphique-fonction', famille: 'maths', titre: 'Graphique de fonction', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Parabole à deux racines', p: { tex: 'y = x^2 - 4x + 3', a: 1, b: -4, c: 3, xmin: -1, xmax: 5, ymin: -4, ymax: 10, racines: true } },
    B: { label: 'Parabole tournée vers le bas', p: { tex: 'y = -x^2 + 2', a: -1, b: 0, c: 2, xmin: -3, xmax: 3, ymin: -8, ymax: 4, racines: true } } },
  { id: 'geometrie-figure', famille: 'maths', titre: 'Figure géométrique', auto: 'partiel', difficulte: 'élevée', approx: true,
    A: { label: 'Triangle rectangle', p: { forme: 'triangle', cotes: ['b', 'a', 'c'], tex: 'c^2 = a^2 + b^2' } },
    B: { label: 'Cercle et aire', p: { forme: 'cercle', rayon: 2.5, tex: 'A = \\pi r^2' } } },
  { id: 'vecteur', famille: 'maths', titre: 'Vecteur', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Somme de deux vecteurs', p: { u: [2, 1], v: [-1, 3], somme: true } },
    B: { label: 'Norme d’un vecteur', p: { u: [3, -2], somme: false, norme: '\\|\\vec{u}\\| = \\sqrt{3^2 + (-2)^2}' } } },
  { id: 'statistiques-histogramme', famille: 'maths', titre: 'Histogramme', auto: 'oui', difficulte: 'facile',
    A: { label: 'Cinq classes', p: { classes: ['0-5', '5-10', '10-15', '15-20', '20-25'], effectifs: [3, 7, 12, 6, 2] } },
    B: { label: 'Trois classes', p: { classes: ['0-10', '10-20', '20-30'], effectifs: [8, 15, 9] } } },
  { id: 'suite-escalier', famille: 'maths', titre: 'Suite en escalier', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Suite u(n+1) = 2u(n) + 1', p: { u0: 0, a: 2, b: 1, N: 5, tex: 'u_{n+1} = 2u_n + 1' } },
    B: { label: 'Suite u(n+1) = u(n) + 3', p: { u0: 1, a: 1, b: 3, N: 4, tex: 'u_{n+1} = u_n + 3' } } },
  { id: 'mouvement-chute', famille: 'physique', titre: 'Chute libre', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Chute de 10 m', p: { h: 10 } },
    B: { label: 'Chute de 45 m', p: { h: 45 } } },
  { id: 'vecteurs-forces', famille: 'physique', titre: 'Vecteurs de forces', auto: 'oui', difficulte: 'élevée',
    A: { label: 'Poids et réaction', p: { forces: [{ nom: 'P', dx: 0, dy: 1, len: 170 }, { nom: 'R', dx: 0, dy: -1, len: 170 }], resultante: false, legende: 'P + R = 0' } },
    B: { label: 'Trois forces et somme', p: { forces: [{ nom: 'F1', dx: 1, dy: 0, len: 170 }, { nom: 'F2', dx: 0.6, dy: -0.8, len: 130 }, { nom: 'F3', dx: -0.8, dy: 0.6, len: 110 }], resultante: true, legende: 'F = F1 + F2 + F3' } } },
  { id: 'circuit-electrique', famille: 'physique', titre: 'Circuit électrique', auto: 'partiel', difficulte: 'élevée', approx: true,
    A: { label: 'Pile, une résistance, un interrupteur', p: { resistances: 1, label: 'Pile, résistance et interrupteur en série : le courant circule dans toute la boucle.' } },
    B: { label: 'Deux résistances en dérivation', p: { resistances: 2, label: 'Deux résistances en dérivation : le courant se répartit entre les deux branches.' } } },
  { id: 'graphique-mouvement', famille: 'physique', titre: 'Graphique de mouvement', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Position x(t)', p: { mode: 'x', tex: 'x(t) = 0{,}75\\,t^2' } },
    B: { label: 'Vitesse v(t) et aire', p: { mode: 'v', tex: 'v(t) = 3t' } } },
  { id: 'reaction-neutralisation', famille: 'chimie', titre: 'Neutralisation', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Acide et base', p: { virage: false, tex: '\\mathrm{H^+} + \\mathrm{OH^-} \\rightarrow \\mathrm{H_2O}' } },
    B: { label: 'Avec changement de couleur', p: { virage: true, tex: '\\mathrm{H^+} + \\mathrm{OH^-} \\rightarrow \\mathrm{H_2O}' } } },
  { id: 'equation-reaction', famille: 'chimie', titre: 'Équation de réaction', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Hydrogène et oxygène', p: { tex: '2\\,\\mathrm{H_2} + \\mathrm{O_2} \\rightarrow 2\\,\\mathrm{H_2O}', bilan: [['H', 4, 4], ['O', 2, 2]] } },
    B: { label: 'Méthane', p: { tex: '\\mathrm{CH_4} + 2\\,\\mathrm{O_2} \\rightarrow \\mathrm{CO_2} + 2\\,\\mathrm{H_2O}', bilan: [['C', 1, 1], ['H', 4, 4], ['O', 4, 4]] } } },
  { id: 'molecule', famille: 'chimie', titre: 'Molécule', auto: 'partiel', difficulte: 'élevée', approx: true,
    A: { label: 'Eau', p: { nom: 'Eau H₂O : deux liaisons', atomes: [{ s: 'O', x: 870, y: 300, c: JAUNE, r: 72 }, { s: 'H', x: 620, y: 430, c: '#FFFFFF', r: 48 }, { s: 'H', x: 1120, y: 430, c: '#FFFFFF', r: 48 }], liaisons: [[0, 1], [0, 2]] } },
    B: { label: 'Méthane CH₄ : quatre liaisons', p: { nom: 'Méthane CH₄ : quatre liaisons', atomes: [{ s: 'C', x: 870, y: 300, c: VERT, r: 72 }, { s: 'H', x: 620, y: 150, c: '#FFFFFF', r: 46 }, { s: 'H', x: 1120, y: 150, c: '#FFFFFF', r: 46 }, { s: 'H', x: 620, y: 470, c: '#FFFFFF', r: 46 }, { s: 'H', x: 1120, y: 470, c: '#FFFFFF', r: 46 }], liaisons: [[0, 1], [0, 2], [0, 3], [0, 4]] } } },
  { id: 'cycle', famille: 'vivant', titre: 'Cycle', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Cycle cellulaire, quatre phases', p: { etapes: ['Phase G1', 'Phase S', 'Phase G2', 'Mitose'] } },
    B: { label: 'Cycle de l’azote, cinq étapes', p: { etapes: ['Azote de l’air', 'Fixation', 'Ammonification', 'Nitrification', 'Dénitrification'] } } },
  { id: 'dialogue-2-voix', famille: 'langues', titre: 'Dialogue à deux voix', auto: 'oui', difficulte: 'moyenne',
    A: { label: 'Deux répliques', p: { repliques: [{ nom: 'Ana', texte: 'Hi Tom, did you finish the homework?' }, { nom: 'Tom', texte: 'Not yet. I was reading a book.' }] } },
    B: { label: 'Quatre répliques', p: { repliques: [{ nom: 'Ana', texte: 'Hi Tom, did you finish the homework?' }, { nom: 'Tom', texte: 'Not yet. I was reading a book.' }, { nom: 'Ana', texte: 'Which book is it?' }, { nom: 'Tom', texte: 'A history book about Rome.' }] } } },
  { id: 'conjugaison', famille: 'langues', titre: 'Conjugaison', auto: 'oui', difficulte: 'facile',
    A: { label: 'Être, présent', p: { verbe: 'être', temps: 'Présent', formes: [['je', 'suis'], ['tu', 'es'], ['il / elle', 'est'], ['nous', 'sommes'], ['vous', 'êtes'], ['ils / elles', 'sont']] } },
    B: { label: 'Avoir, passé composé', p: { verbe: 'avoir', temps: 'Passé composé', formes: [['j’', 'ai eu'], ['tu', 'as eu'], ['il / elle', 'a eu']] } } },
  { id: 'vocabulaire-image', famille: 'langues', titre: 'Vocabulaire avec image', auto: 'partiel', difficulte: 'facile', approx: true,
    A: { label: 'Trois mots', p: { mots: [{ mot: 'chat', trad: 'cat' }, { mot: 'chien', trad: 'dog' }, { mot: 'oiseau', trad: 'bird' }] } },
    B: { label: 'Quatre mots', p: { mots: [{ mot: 'pomme', trad: 'apple' }, { mot: 'livre', trad: 'book' }, { mot: 'soleil', trad: 'sun' }, { mot: 'eau', trad: 'water' }] } } },
  { id: 'secours-generique', famille: 'secours', titre: 'Scène de secours', auto: 'oui', difficulte: 'facile',
    A: { label: 'Titre, texte, image, trois points', p: { titre: 'Le théorème de Pythagore', texte: 'Dans un triangle rectangle, le carré de l’hypoténuse est égal à la somme des carrés des deux autres côtés.', image: true, points: ['Hypoténuse', 'Côtés de l’angle droit', 'Relation'] } },
    B: { label: 'Titre, texte, sans image, cinq points', p: { titre: 'Les verbes du premier groupe', texte: 'Les verbes en -er forment la majorité des verbes français.', image: false, points: ['Infinitif en -er', 'Terminaisons en -e, -es, -e, -ons, -ez, -ent', 'Radical stable', 'Exceptions : aller', 'Accords au présent'] } } },
];

window.FAMILLES = {
  texte: 'Texte et définition', formules: 'Formules et démonstrations', tableaux: 'Tableaux, listes, comparaisons',
  schemas: 'Schémas et frises', maths: 'Mathématiques', physique: 'Physique', chimie: 'Chimie',
  vivant: 'Vivant et anatomie', langues: 'Langues et grammaire', secours: 'Scène de secours',
};

// Affiche la scène i (0-based), variante 'A' ou 'B', à l'instant t.
window.montrer = (i, variante, t) => {
  const s = window.CATALOGUE[i], v = s[variante];
  const cadre = document.getElementById('cadre');
  const badges = `<span class="badge">Automatisable : ${s.auto}</span><span class="badge">Difficulté : ${s.difficulte}</span>${s.approx ? '<span class="badge jaune">Première version</span>' : ''}`;
  cadre.innerHTML = `
    <div class="entete">
      <div class="num">${String(i + 1).padStart(2, '0')}</div>
      <div class="droite"><div class="famille">${window.FAMILLES[s.famille]}</div><h1>${s.titre}</h1><div class="badges">${badges}</div></div>
    </div>
    <div class="variante"><span class="pastille">Variante ${variante}</span> ${v.label}</div>
    <div class="corps">${window.RENDU[s.id](v.p, t)}</div>
    <div class="pied">${i + 1} / ${window.CATALOGUE.length}</div>`;
};
