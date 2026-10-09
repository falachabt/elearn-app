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

/** Ecrans captureables : nom de fichier, route, titre de l'habillage. */
const ECRANS = [
  { nom: '01-accueil', route: '/', titre: ['Ta mission', 'du jour'] },
  { nom: '02-reviser', route: '/reviser', titre: ['Tous tes cours,', 'bien rangés'] },
  { nom: '03-mission', route: '/mission', titre: ['Réponds,', 'on corrige'] },
  { nom: '04-questions', route: '/questions', titre: ['Une question ?', 'On te répond'] },
  { nom: '05-moi', route: '/moi', titre: ['Ta progression', 'sous les yeux'] },
  { nom: '06-offres-pass', route: '/offres', titre: ['Choisis ton pass,', 'sans engagement'] },
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
    for (const { nom, route } of ECRANS) {
      await page.goto(url + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(9000);
      await page.screenshot({ path: join(dossier, `${nom}.png`) });
      const bandeau = await page.getByText('meilleure experience', { exact: false }).count();
      console.log('brut     ', nom, bandeau ? 'ATTENTION bandeau web present' : 'ok');
    }
    await contexte.close();
  }

  if (etapes.includes('habille') || etapes.includes('banniere')) {
    const dossier = join(sortie, etapes.includes('banniere') && !etapes.includes('habille') ? 'banniere' : 'habille');
    mkdirSync(dossier, { recursive: true });
    const fichier = (nom) => 'file:///' + join(racine, nom).replace(/\\/g, '/');
    const logo = fichier('assets/images/logo-horizontal-noir.png');
    const archivo = fichier('assets/fonts/ArchivoBlack.ttf');
    const grotesk = fichier('assets/fonts/SpaceGrotesk-Medium.ttf');
    const page = await navigateur.newPage();

    const rendre = async (html, largeurCible, hauteurCible, chemin) => {
      await page.setViewportSize({ width: largeurCible, height: hauteurCible });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
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
        const html = `<!doctype html><meta charset="utf-8"><style>
          @font-face{font-family:A;src:url('${archivo}')}
          @font-face{font-family:G;src:url('${grotesk}')}
          *{margin:0;padding:0;box-sizing:border-box}
          body{width:${largeur}px;height:${hauteur}px;background:#FFF7E3;border:8px solid #0A0A0A;position:relative;font-family:A}
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
      for (const [l, h] of [[5244, 2950], [3840, 1646]]) {
        const lg = Math.round(l * 0.3);
        const h1 = Math.round(h * 0.085);
        const h2 = Math.round(h * 0.042);
        const bande = Math.round(h * 0.1);
        const bloc = Math.round((lg * 333) / 893) + Math.round(h * 0.05) + Math.round(h1 * 1.15) + Math.round(h * 0.02) + Math.round(h2 * 1.3);
        const y = Math.round((h - bloc) / 2);
        const html = `<!doctype html><meta charset="utf-8"><style>
          @font-face{font-family:A;src:url('${archivo}')}
          @font-face{font-family:G;src:url('${grotesk}')}
          *{margin:0;padding:0;box-sizing:border-box}
          body{width:${l}px;height:${h}px;background:#FFF7E3;position:relative;overflow:hidden}
          .haut,.bas{position:absolute;left:0;width:100%;height:${bande}px;background:#10B981}
          .haut{top:0}.bas{bottom:0}
          img.logo{position:absolute;top:${y}px;left:50%;transform:translateX(-50%);width:${lg}px}
          h1{position:absolute;top:${y + Math.round((lg * 333) / 893) + Math.round(h * 0.05)}px;left:0;width:100%;text-align:center;font-family:A;font-size:${h1}px;font-weight:400;color:#0A0A0A}
          p{position:absolute;top:${y + Math.round((lg * 333) / 893) + Math.round(h * 0.05) + Math.round(h1 * 1.15) + Math.round(h * 0.02)}px;left:0;width:100%;text-align:center;font-family:G;font-size:${h2}px;color:#5C5C5C}
        </style>
        <div class="haut"></div><div class="bas"></div>
        <img class="logo" src="${logo}">
        <h1>Réussis ton concours.</h1>
        <p>Cours, missions et corrigés, au même endroit.</p>`;
        await rendre(html, l, h, join(dossierBanniere, `entete-${l}x${h}.png`));
      }
    }

    await page.close();
  }
} finally {
  await navigateur.close();
}

writeFileSync(join(sortie, 'LISEZ-MOI.txt'), `Captures App Store generees depuis ${url}\netapes : ${etapes.join(', ')}\n`);
console.log('TERMINE ->', sortie);
