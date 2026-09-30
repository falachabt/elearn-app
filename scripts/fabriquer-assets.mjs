#!/usr/bin/env node
// Fabrique les images de l'app (icône, icône adaptative Android, splash, favicon, logos) dans assets/images
// à partir du kit de marque. Rendu par Chromium (Playwright) : aucun autre outil d'image requis.
//
// Usage : node scripts/fabriquer-assets.mjs [--kit /mnt/project-files/marketing/kit]
// Le kit n'est jamais modifié : on lit logo-symbole.svg et on copie les logos horizontaux.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const kit = resolve(args.includes('--kit') ? args[args.indexOf('--kit') + 1] : '/mnt/project-files/marketing/kit');
const sortie = join(racine, 'assets', 'images');
mkdirSync(sortie, { recursive: true });

// Couleurs du guide de design (palette.emeraude[500], papier[50], encre[900]).
const EMERAUDE = '#10B981';

function chargerPlaywright() {
  const r = createRequire(import.meta.url);
  try { return r('playwright'); } catch { /* repli : installation globale */ }
  const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(global, 'x.js'))('playwright');
}
function trouverChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const base = '/opt/pw-browsers';
  const dossier = existsSync(base) && readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const chemin = dossier && join(base, dossier, 'chrome-linux', 'chrome');
  if (!chemin || !existsSync(chemin)) throw new Error('Chromium introuvable : définissez PW_CHROMIUM.');
  return chemin;
}

// Symbole complet (tuile émeraude arrondie + livre + courbe), sans les métadonnées C2PA du fichier source.
const svg = readFileSync(join(kit, 'logo-symbole.svg'), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');
const interieur = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const tuile = interieur.match(/<rect[^>]*\/>/)[0];
const glyphe = interieur.replace(tuile, ''); // livre blanc + courbe verte, sans la tuile
const livre = glyphe.match(/<path d="M15 17[^>]*\/>/)[0]; // forme du livre
const courbes = glyphe.replace(livre, '');
// Centre du glyphe (livre) en unités du SVG 64x64 : x 13,75–50,25 ; y 15,75–50,9.
const CX = 32, CY = 33.3, LARGEUR_GLYPHE = 36.5;

/** SVG carré 1024 : fond optionnel, glyphe centré occupant `part` de la largeur. */
function carre({ fond, part, corps }) {
  const s = LARGEUR_GLYPHE / part;
  const vb = `${CX - s / 2} ${CY - s / 2} ${s} ${s}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${vb}">${fond ? `<rect x="-100" y="-100" width="300" height="300" fill="${fond}"/>` : ''}${corps}</svg>`;
}
const symbole = (taille) => `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 64 64">${interieur}</svg>`;
// Monochrome Android : silhouette opaque du livre, courbe évidée (seul le canal alpha compte).
const monochrome = (part, couleur = '#000') => carre({
  part,
  corps: `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/>${courbes.replace(/#047857/g, '#000')}</mask>` +
    `<g mask="url(#m)">${livre.replace(/fill="#fff"/, `fill="${couleur}"`).replace(/stroke="#0A0A0A"/, `stroke="${couleur}"`)}</g>`,
});

const rendus = [
  // iOS : carré plein, opaque (iOS applique lui-même le masque arrondi).
  ['icon.png', 1024, carre({ fond: EMERAUDE, part: 0.62, corps: glyphe }), false],
  // Android adaptative : avant-plan transparent dans la zone sûre (66 %), fond émeraude uni posé par app.json (backgroundColor).
  ['android-icon-foreground.png', 1024, carre({ part: 0.4, corps: glyphe }), true],
  ['android-icon-monochrome.png', 1024, monochrome(0.4), true],
  // Icône de notification Android : silhouette blanche 96x96 sur transparent (Android ne garde que l'alpha).
  ['notification-icon.png', 96, monochrome(0.8, '#fff'), true],
  // Splash : logo plat (sans tuile arrondie) sur transparent, fond posé par app.json (clair / sombre).
  ['splash-icon.png', 1024, carre({ part: 0.9, corps: glyphe }), true],
  // Favicon : carré plein cadre émeraude (le navigateur l'affiche tel quel).
  ['favicon.png', 96, carre({ fond: EMERAUDE, part: 0.66, corps: glyphe }), false],
  ['logo-symbole.png', 512, symbole(512), true],
];

const navigateur = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
try {
  for (const [nom, taille, contenu, transparent] of rendus) {
    const page = await navigateur.newPage({ viewport: { width: taille, height: taille } });
    await page.setContent(`<style>html,body{margin:0;background:${transparent ? 'transparent' : '#fff'}}svg{display:block;width:${taille}px;height:${taille}px}</style>${contenu}`);
    await page.screenshot({ path: join(sortie, nom), omitBackground: transparent });
    await page.close();
    console.log(`assets/images/${nom} (${taille}x${taille}${transparent ? ', transparent' : ''})`);
  }
} finally {
  await navigateur.close();
}

for (const nom of ['logo-horizontal-blanc.png', 'logo-horizontal-noir.png']) {
  copyFileSync(join(kit, nom), join(sortie, nom));
  console.log(`assets/images/${nom} (copie du kit)`);
}

// Aperçu : --apercu [fichier.png] pose les icônes sous un masque rond et un masque squircle (et en carré brut),
// avec le cercle de sécurité Android (66 %) ; le splash sur fond clair et sombre ; l'icône de notification.
if (args.includes('--apercu')) {
  const suivant = args[args.indexOf('--apercu') + 1];
  const fichier = resolve(suivant && !suivant.startsWith('--') ? suivant : '/mnt/project-files/app/apercus/icones-apercu.png');
  mkdirSync(join(fichier, '..'), { recursive: true });
  const b64 = (n) => `data:image/png;base64,${readFileSync(join(sortie, n)).toString('base64')}`;
  const squircle = 'border-radius:22.37%'; // iOS ; superellipse approchée
  const tuile = (contenu, forme, extra = '') => `<div class="t" style="${forme};${extra}">${contenu}</div>`;
  const img = (n) => `<img src="${b64(n)}">`;
  const adaptative = `<div class="fond">${img('android-icon-foreground.png')}<div class="sur"></div></div>`;
  const mono = `<div class="fond" style="background:#d9e4dd">${`<img style="filter:brightness(0) saturate(100%) invert(22%) sepia(40%) saturate(900%) hue-rotate(110deg)" src="${b64('android-icon-monochrome.png')}">`}</div>`;
  const ligne = (titre, cellules) => `<section><h3>${titre}</h3><div class="l">${cellules.join('')}</div></section>`;
  const html = `<style>
    body{margin:0;padding:24px;background:#f3f4f6;font:14px system-ui;width:1260px}
    h3{margin:14px 0 8px}.l{display:flex;gap:20px;align-items:center}
    .t{width:180px;height:180px;overflow:hidden;position:relative;box-shadow:0 2px 6px #0004}
    .t img,.fond img{width:100%;height:100%;display:block}
    .fond{width:100%;height:100%;background:#10B981;position:relative}
    .sur{position:absolute;left:17%;top:17%;width:66%;height:66%;border:2px dashed #ff2d55;border-radius:50%}
    .s{width:240px;height:380px;display:flex;align-items:center;justify-content:center;border-radius:12px}
    .s img{width:200px;height:200px;flex:none}.n{width:96px;height:96px;background:#374151;border-radius:12px}
  </style>
  ${ligne('iOS icon.png : carré brut, masque squircle, masque rond', [tuile(img('icon.png'), 'border-radius:0'), tuile(img('icon.png'), squircle), tuile(img('icon.png'), 'border-radius:50%')])}
  ${ligne('Android adaptative (fond émeraude + avant-plan) : cercle, squircle, carré arrondi ; pointillé rouge = zone de sécurité 66 %', [tuile(adaptative, 'border-radius:50%'), tuile(adaptative, squircle), tuile(adaptative, 'border-radius:12%'), tuile(adaptative, 'border-radius:0')])}
  ${ligne('Android 13+ monochrome (thème), favicon, icône de notification (blanc sur gris)', [tuile(mono, 'border-radius:50%'), tuile(img('favicon.png'), 'width:96px;height:96px;border-radius:0'), `<div class="n"><img src="${b64('notification-icon.png')}"></div>`])}
  ${ligne('Splash clair et sombre (image 200 px posée sur le fond)', [`<div class="s" style="background:#FFF7E3"><img src="${b64('splash-icon.png')}"></div>`, `<div class="s" style="background:#141614"><img src="${b64('splash-icon.png')}"></div>`])}`;
  const nav2 = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
  try {
    const page = await nav2.newPage({ viewport: { width: 1310, height: 900 } });
    await page.setContent(html);
    await page.screenshot({ path: fichier, fullPage: true });
    console.log(`aperçu : ${fichier}`);
  } finally {
    await nav2.close();
  }
}
