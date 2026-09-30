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
const monochrome = (part) => carre({
  part,
  corps: `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff"/>${courbes.replace(/#047857/g, '#000')}</mask>` +
    `<g mask="url(#m)">${livre.replace(/fill="#fff"/, 'fill="#000"').replace(/stroke="#0A0A0A"/, 'stroke="#000"')}</g>`,
});

const rendus = [
  // iOS : carré plein, opaque (iOS applique lui-même le masque arrondi).
  ['icon.png', 1024, carre({ fond: EMERAUDE, part: 0.62, corps: glyphe }), false],
  // Android adaptative : avant-plan transparent dans la zone sûre (66 %), fond émeraude uni posé par app.json (backgroundColor).
  ['android-icon-foreground.png', 1024, carre({ part: 0.4, corps: glyphe }), true],
  ['android-icon-monochrome.png', 1024, monochrome(0.4), true],
  // Splash : symbole complet sur transparent, fond posé par app.json (clair / sombre).
  ['splash-icon.png', 1024, symbole(1024), true],
  ['favicon.png', 96, symbole(96), true],
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
