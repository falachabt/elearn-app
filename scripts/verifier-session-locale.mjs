#!/usr/bin/env node
// Vérifie la session invité (connexion anonyme) de l'app web contre le Supabase LOCAL
// et prend des captures des écrans Accueil, Réviser et Moi en clair et en sombre.
//
// Prérequis : Supabase local démarré avec enable_anonymous_sign_ins = true (dépôt elearn-supabase),
// `.env.local` renseigné avec l'URL et la clé anon LOCALES, Chromium déjà installé
// (PW_CHROMIUM ou /opt/pw-browsers/chromium-*), Playwright installé (local ou global via NODE_PATH),
// et Docker (psql est lancé dans le conteneur de base locale).
//
// Usage : node scripts/verifier-session-locale.mjs [--sortie dossier] [--port 4173] [--sans-build]
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const sortie = resolve(option('--sortie', '/mnt/project-files/app/apercus'));
const port = Number(option('--port', '4173'));
const conteneurDb = option('--conteneur-db', 'supabase_db_elearn');

function lireEnvLocal() {
  const fichier = join(racine, '.env.local');
  if (!existsSync(fichier)) throw new Error('.env.local introuvable (voir README).');
  return Object.fromEntries(
    readFileSync(fichier, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

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

function sql(requete) {
  return execFileSync('docker', ['exec', conteneurDb, 'psql', '-U', 'postgres', '-At', '-c', requete], { encoding: 'utf8' }).trim();
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

const env = lireEnvLocal();
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  throw new Error(`Refus : EXPO_PUBLIC_SUPABASE_URL (${url}) n'est pas une URL locale.`);
}

if (!args.includes('--sans-build')) {
  console.log('Export web…');
  execFileSync('npx', ['expo', 'export', '--platform', 'web'], { cwd: racine, stdio: 'inherit', env: { ...process.env, CI: '1' } });
}

const avant = Number(sql('select count(*) from auth.users where is_anonymous'));
mkdirSync(sortie, { recursive: true });
const serveur = await servir(join(racine, 'dist'));
const { chromium } = chargerPlaywright();
const navigateur = await chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
const erreursConsole = [];
let echec = false;

try {
  for (const schema of ['light', 'dark']) {
    const suffixe = schema === 'light' ? 'clair' : 'sombre';
    const contexte = await navigateur.newContext({ locale: 'fr-FR', colorScheme: schema, viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreursConsole.push(e.message));
    page.on('console', (m) => m.type() === 'error' && erreursConsole.push(m.text()));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('tab', { name: /Accueil/ }).waitFor({ timeout: 30000 });
    // Attendre que la session invité soit stockée par le client Supabase.
    await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.endsWith('-auth-token')), null, { timeout: 30000 });
    for (const [nom, onglet] of [['accueil', 'Accueil'], ['reviser', 'Réviser'], ['moi', 'Moi']]) {
      await page.getByRole('tab', { name: new RegExp(onglet) }).click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(sortie, `local-${nom}-${suffixe}.png`) });
      console.log(`Capture : local-${nom}-${suffixe}.png`);
    }
    await contexte.close();
  }
} finally {
  await navigateur.close();
  serveur.close();
}

const apres = Number(sql('select count(*) from auth.users where is_anonymous'));
const bannieres = erreursConsole.filter((e) => /session|supabase|auth|anonym/i.test(e));
console.log(`Utilisateurs anonymes : ${avant} -> ${apres}`);
if (apres <= avant) { console.error('ÉCHEC : aucun utilisateur anonyme créé.'); echec = true; }
if (bannieres.length) { console.error('ÉCHEC : erreurs console liées à la session :\n' + bannieres.join('\n')); echec = true; }
if (!echec) console.log('OK : session invité fonctionnelle contre Supabase local.');
process.exit(echec ? 1 : 0);
