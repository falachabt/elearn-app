#!/usr/bin/env node
// Captures de la feuille de mise à jour (route cachée /mise-a-jour, exportée avec EXPO_PUBLIC_APERCU=1)
// en clair et en sombre : maj-<etat>-<clair|sombre>.png. Chromium déjà installé (PW_CHROMIUM ou /opt/pw-browsers).
// Usage : node scripts/apercu-mise-a-jour.mjs [--sortie dossier] [--port 4174] [--sans-build]
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const sortie = resolve(option('--sortie', '/mnt/project-files/app/apercus'));
const port = Number(option('--port', '4174'));
const dossierExport = join(racine, 'dist-apercu');

function trouverChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const base = '/opt/pw-browsers';
  const dossier = existsSync(base) && readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const chemin = dossier && join(base, dossier, 'chrome-linux', 'chrome');
  if (!chemin || !existsSync(chemin)) throw new Error('Chromium introuvable : définissez PW_CHROMIUM.');
  return chemin;
}

function chargerPlaywright() {
  const r = createRequire(import.meta.url);
  try { return r('playwright'); } catch { /* repli : installation globale */ }
  const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(global, 'x.js'))('playwright');
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf' };
function servir(dossier) {
  const serveur = createServer((req, res) => {
    const chemin = join(dossier, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const fichier = existsSync(chemin) && statSync(chemin).isFile() ? chemin : join(dossier, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(fichier)] ?? 'application/octet-stream' });
    createReadStream(fichier).pipe(res);
  });
  return new Promise((ok) => serveur.listen(port, '127.0.0.1', () => ok(serveur)));
}

if (!args.includes('--sans-build')) {
  console.log('Export web (EXPO_PUBLIC_APERCU=1)…');
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dossierExport], {
    cwd: racine, stdio: 'inherit', env: { ...process.env, CI: '1', EXPO_PUBLIC_APERCU: '1' },
  });
}

const cas = [
  ['disponible', 'etat=disponible'],
  ['telechargement', 'etat=telechargement'],
  ['erreur', 'etat=erreur'],
  ['prete', 'etat=prete'],
  ['obligatoire', 'etat=disponible&obligatoire=1'],
  ['obligatoire-erreur', 'etat=erreur&obligatoire=1'],
];

mkdirSync(sortie, { recursive: true });
const serveur = await servir(dossierExport);
const { chromium } = chargerPlaywright();
const navigateur = await chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
try {
  for (const schema of ['light', 'dark']) {
    const suffixe = schema === 'light' ? 'clair' : 'sombre';
    const contexte = await navigateur.newContext({ locale: 'fr-FR', colorScheme: schema, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    for (const [nom, requete] of cas) {
      const page = await contexte.newPage();
      await page.goto(`http://127.0.0.1:${port}/mise-a-jour?${requete}`);
      await page.getByText(/^(Mise à jour|Update)/).first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(sortie, `maj-${nom}-${suffixe}.png`) });
      console.log(`Capture : maj-${nom}-${suffixe}.png`);
      await page.close();
    }
    await contexte.close();
  }
} finally {
  await navigateur.close();
  serveur.close();
}
