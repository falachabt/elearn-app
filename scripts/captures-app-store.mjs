#!/usr/bin/env node
// Captures d'ecran pour la fiche App Store, et habillage au style Elearn.
//
// Trois etapes independantes (--etapes brut,habille,banniere) :
//   brut     : capture les ecrans de l'app a 1206x2622 (6,3", la taille exigee par la section
//              « iPhone avec Dynamic Island » d'App Store Connect).
//   habille  : habille chaque capture (fond creme, bordure noire, logo, titre, cadre telephone).
//   banniere : rend la banniere d'en-tete de la page produit (5244x2950 et 3840x1646).
//
// Prerequis : l'app doit tourner quelque part (--url). Pour la version iOS des offres (prix Apple) :
//   EXPO_PUBLIC_SIMULER_IOS=1 npx expo start --web --port 8081
// puis :
//   node scripts/captures-app-store.mjs --url http://localhost:8081 --sortie <dossier>
//
// Pieges a connaitre (voir docs/assets-app-store.md) :
//   - les tailles exigees dependent de la SECTION affichee dans App Store Connect : les lire avant de produire ;
//   - `EXPO_PUBLIC_*` est figee a la compilation : la simulation iOS ne survit pas a un rechargement si on
//     l'active par l'interface, d'ou le drapeau d'environnement ;
//   - sans le script d'initialisation, la capture part sur l'ecran d'arrivee et affiche le bandeau web.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const url = option('--url', 'http://localhost:8081').replace(/\/$/, '');
const sortie = resolve(option('--sortie', join(racine, 'apercus-app-store')));
const etapes = option('--etapes', 'brut,habille,banniere').split(',').map((s) => s.trim());
const largeur = 1206;
const hauteur = 2622;

/** Ecrans de la fiche : nom de fichier (numerote = ordre d'upload), route, clics avant capture, titre de l'habillage. */
const ECRANS = [
  { nom: '1-accueil', route: '/', titre: ['Ta mission', 'du jour'] },
  { nom: '2-reviser', route: '/reviser', titre: ['Tous tes cours,', 'bien rangés'] },
  { nom: '3-mission', route: '/mission', titre: ['Réponds,', 'on corrige'] },
  { nom: '4-moi', route: '/moi', titre: ['Ta progression', 'sous les yeux'] },
  { nom: '5-offres-pass', route: '/offres', titre: ['Choisis ton pass,', 'sans engagement'] },
  // Les ecrans de cours n'ont pas d'URL directe (leur identifiant vient de la base) : on y arrive en cliquant.
  { nom: '6-cours-matiere', route: '/reviser', titre: ['79 cours', 'de Maths'], clics: [/^Maths/i] },
  { nom: '7-cours-lecons', titre: ['Chapitres', 'et leçons'], clics: [/leçon/i] },
];

/** Le profil local termine evite l'ecran d'arrivee ; `standalone` masque le bandeau « installe l'app ». */
const AMORCE = () => {
  try {
    Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
  } catch {}
  try {
    localStorage.setItem('profil.arrivee', JSON.stringify({ type: 'eleve', niveau: 'Tle', pays: 'CM', concours: null, termine: true }));
  } catch {}
};

function chargerPlaywright() {
  const r = createRequire(import.meta.url);
  try {
    return r('playwright-core');
  } catch {}
  try {
    return r('playwright');
  } catch {}
  const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(global, 'x.js'))('playwright');
}

/** Chromium : variable d'environnement, puis le cache de l'image de build, puis Chrome installe (Windows/macOS). */
function trouverChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  for (const base of ['/opt/pw-browsers', join(process.env.HOME ?? '', '.cache', 'ms-playwright')]) {
    if (!base || !existsSync(base)) continue;
    const dossier = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    for (const rel of ['chrome-linux/chrome', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const chemin = dossier && join(base, dossier, rel);
      if (chemin && existsSync(chemin)) return chemin;
    }
  }
  for (const chemin of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]) {
    if (existsSync(chemin)) return chemin;
  }
  throw new Error('Chromium introuvable : definissez PW_CHROMIUM.');
}

const { chromium } = chargerPlaywright();
const navigateur = await chromium.launch({ executablePath: trouverChromium(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

try {
  if (etapes.includes('brut')) {
    const dossier = join(sortie, 'brut');
    mkdirSync(dossier, { recursive: true });
    const contexte = await navigateur.newContext({
      viewport: { width: largeur / 3, height: hauteur / 3 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'fr-FR',
      colorScheme: 'light',
    });
    await contexte.addInitScript(AMORCE);
    const page = await contexte.newPage();
    for (const { nom, route, clics } of ECRANS) {
      if (route) {
        await page.goto(url + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(9000);
      }
      for (const motif of clics ?? []) {
        const cible = page.getByText(motif).first();
        if (!(await cible.count())) {
          console.log('brut     ', nom, 'cible introuvable pour', String(motif));
          continue;
        }
        await cible.click({ timeout: 8000 }).catch((e) => console.log('brut     ', nom, 'clic impossible', String(e).slice(0, 90)));
        await page.waitForTimeout(8000);
      }
      await page.screenshot({ path: join(dossier, `${nom}.png`) });
      const bandeau = await page.getByText('meilleure experience', { exact: false }).count();
      console.log('brut     ', nom, bandeau ? 'ATTENTION bandeau web present' : 'ok');
    }
    await contexte.close();
  }

  if (etapes.includes('habille') || etapes.includes('banniere')) {
    const dossier = join(sortie, etapes.includes('banniere') && !etapes.includes('habille') ? 'banniere' : 'habille');
    mkdirSync(dossier, { recursive: true });
    // Polices, logo et captures integres en data URI. Depuis une page construite par setContent (origine
    // about:blank), Chromium REFUSE de charger une police en file:// (CORS) : le rendu retombe alors
    // silencieusement sur une police systeme, et tous les textes perdent la typo de la marque.
    const donnee = (nom, type) => `data:${type};base64,` + readFileSync(join(racine, nom)).toString('base64');
    const logo = donnee('assets/images/logo-horizontal-noir.png', 'image/png');
    const archivo = donnee('assets/fonts/ArchivoBlack.ttf', 'font/ttf');
    const grotesk = donnee('assets/fonts/SpaceGrotesk-Medium.ttf', 'font/ttf');
    const page = await navigateur.newPage();

    const rendre = async (html, largeurCible, hauteurCible, chemin) => {
      await page.setViewportSize({ width: largeurCible, height: hauteurCible });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Sans ce controle, un echec de chargement de police passe inapercu : le rendu retombe sur une police systeme.
      const polices = await page.evaluate(() => Array.from(document.fonts).map((f) => `${f.family}:${f.status}`).join(' '));
      if (/error|unloaded/.test(polices)) console.log('POLICES  ', polices);
      await page.screenshot({ path: chemin });
      console.log('rendu    ', chemin.replace(sortie, '.'));
    };

    if (etapes.includes('habille')) {
      const b = 14; // épaisseur du châssis
      const interieureH = 2010 - 2 * b;
      const interieureL = Math.round((interieureH * largeur) / hauteur);
      for (const { nom, titre } of ECRANS) {
        const brut = join(sortie, 'brut', `${nom}.png`);
        if (!existsSync(brut)) {
          console.log('habille  ', nom, 'ignore (capture brute absente)');
          continue;
        }
        const ecran = 'data:image/png;base64,' + readFileSync(brut).toString('base64');
        // Pas de bordure au bord de l'image : App Store Connect arrondit les coins des captures (~10 % de la
        // largeur), ce qui rogne une bordure noire collée au bord et abime le style neo-brutal. Le style passe
        // par le titre, le trait emeraude et le chassis noir du telephone.
        const html = `<!doctype html><meta charset="utf-8"><style>
          @font-face{font-family:A;src:url('${archivo}')}
          @font-face{font-family:G;src:url('${grotesk}')}
          *{margin:0;padding:0;box-sizing:border-box}
          body{width:${largeur}px;height:${hauteur}px;background:#FFF7E3;position:relative;font-family:A}
          img.logo{position:absolute;top:64px;left:50%;transform:translateX(-50%);width:300px}
          h1{position:absolute;top:230px;left:0;width:100%;text-align:center;font-size:108px;line-height:1.06;color:#0A0A0A;font-weight:400}
          .bar{position:absolute;top:${230 + Math.round(108 * 1.06 * titre.length) + 12}px;left:50%;transform:translateX(-50%);width:240px;height:14px;background:#10B981;border-radius:7px}
          .phone{position:absolute;top:550px;left:50%;transform:translateX(-50%);width:${interieureL + 2 * b}px;height:2010px;background:#0A0A0A;border-radius:96px;padding:${b}px}
          .phone img{width:100%;height:100%;border-radius:84px;display:block}
        </style>
        <img class="logo" src="${logo}">
        <h1>${titre.join('<br>')}</h1><div class="bar"></div>
        <div class="phone"><img src="${ecran}"></div>`;
        await rendre(html, largeur, hauteur, join(dossier, `${nom}.png`));
      }
    }

    if (etapes.includes('banniere')) {
      const dossierBanniere = join(sortie, 'banniere');
      mkdirSync(dossierBanniere, { recursive: true });
      // Tout le contenu reste dans le CENTRE de l'image. App Store Connect affiche cette banniere dans une zone
      // plus etroite que l'asset et la recadre : un contenu qui va jusqu'aux bords (accroche a gauche, telephone a
      // droite) se fait couper et disparait. Centre, il survit a n'importe quel recadrage — c'est ce qui marchait
      // dans la toute premiere version, entierement centree.
      const L = 5244;
      const H = 2950;
      const style = `
          @font-face{font-family:A;src:url('${archivo}')}
          @font-face{font-family:G;src:url('${grotesk}')}
          *{margin:0;padding:0;box-sizing:border-box}
          body{background:#FFF7E3;overflow:hidden}
          .scene{position:relative;width:${L}px;height:${H}px;background-color:#FFF7E3;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='104' height='104'%3E%3Ccircle cx='8' cy='8' r='6' fill='%230A0A0A' fill-opacity='0.14'/%3E%3C/svg%3E");display:flex;align-items:center;justify-content:center;overflow:hidden}
          .centre{width:2400px;text-align:center}
          .logo{display:block;width:1150px;margin:0 auto}
          h1{font-family:A;font-weight:400;font-size:286px;line-height:1.1;color:#0A0A0A;margin-top:94px}
          .surligne{background:#FFD83D;border:10px solid #0A0A0A;border-radius:26px;box-shadow:14px 14px 0 #0A0A0A;padding:0 30px}
          p{font-family:G;font-size:106px;line-height:1.35;color:#5C5C5C;margin-top:72px}`;
      const scene = `
        <div class="centre">
          <img class="logo" src="${logo}">
          <h1>Réussis ton<br><span class="surligne">concours.</span></h1>
          <p>Cours, missions et corrigés,<br>au même endroit.</p>
        </div>`;

      await rendre(`<!doctype html><meta charset="utf-8"><style>${style}</style><div class="scene">${scene}</div>`, L, H, join(dossierBanniere, `entete-${L}x${H}.png`));

      // Version large 2,33:1 : meme composition, mise a l'echelle puis recadree au centre (le point focal y est).
      const grand = 3840;
      const haut = 1646;
      const echelle = grand / L;
      const decalage = Math.round((((H - Math.round(L / (grand / haut))) / 2) * grand) / L);
      const htmlLarge = `<!doctype html><meta charset="utf-8"><style>${style}
          body{width:${grand}px;height:${haut}px}
          .cadre{position:absolute;left:0;top:-${decalage}px;transform:scale(${echelle});transform-origin:0 0}
        </style><div class="cadre"><div class="scene">${scene}</div></div>`;
      await rendre(htmlLarge, grand, haut, join(dossierBanniere, `entete-${grand}x${haut}.png`));
    }

    await page.close();
  }
} finally {
  await navigateur.close();
}

writeFileSync(join(sortie, 'LISEZ-MOI.txt'), `Captures App Store generees depuis ${url}\netapes : ${etapes.join(', ')}\n`);
console.log('TERMINE ->', sortie);
