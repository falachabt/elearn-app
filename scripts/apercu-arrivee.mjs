#!/usr/bin/env node
// Captures du parcours d'arrivée A4 à A7 en clair et en sombre : arrivee-<ecran>-<clair|sombre>.png.
// Export web avec le Supabase local (clé publique de démo) : lancer `npx supabase start` dans elearn-supabase avant.
// --parcours mission : accueil (C1), mission (C2) et fin de mission (C3) : mission-<ecran>-<clair|sombre>.png.
// --parcours reviser : onglet Réviser (D1), chapitres, leçon (D2) : reviser-<ecran>-<clair|sombre>.png (contenu local à semer).
// --parcours pass : écrans Offres (E1) et « Envoyer à mon parent » (E6) : pass-<ecran>-<clair|sombre>.png.
// Usage : node scripts/apercu-arrivee.mjs [--parcours arrivee|pass] [--sortie dossier] [--port 4175] [--sans-build]
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const sortie = resolve(option('--sortie', '/mnt/project-files/app/apercus'));
const port = Number(option('--port', '4175'));
const parcours = option('--parcours', 'arrivee');
const dossierExport = join(racine, 'dist-arrivee');

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

const URL_LOCALE = 'http://127.0.0.1:54321';
if (!args.includes('--sans-build')) {
  const statut = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { cwd: resolve(racine, '../elearn-supabase'), encoding: 'utf8' }));
  if (!String(statut.API_URL).startsWith(URL_LOCALE)) throw new Error('Supabase local introuvable : refus de viser un autre serveur.');
  console.log('Export web (Supabase local)…');
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dossierExport], {
    cwd: racine,
    stdio: 'inherit',
    env: { ...process.env, CI: '1', EXPO_PUBLIC_SUPABASE_URL: URL_LOCALE, EXPO_PUBLIC_SUPABASE_ANON_KEY: statut.ANON_KEY, EXPO_PUBLIC_FACEBOOK: '1' },
  });
}

mkdirSync(sortie, { recursive: true });
const serveur = await servir(dossierExport);
const { chromium } = chargerPlaywright();
const navigateur = await chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
const profil = JSON.stringify({ type: 'eleve', niveau: parcours === 'pass' ? 'Tle' : '3e', pays: 'CM', termine: parcours !== 'arrivee' });
try {
  for (const schema of ['light', 'dark']) {
    const suffixe = schema === 'light' ? 'clair' : 'sombre';
    const contexte = await navigateur.newContext({ locale: 'fr-FR', colorScheme: schema, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await contexte.addInitScript((p) => localStorage.setItem('profil.arrivee', p), profil);
    const page = await contexte.newPage();
    const capture = async (nom) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(sortie, `${parcours}-${nom}-${suffixe}.png`) });
      console.log(`Capture : ${parcours}-${nom}-${suffixe}.png`);
    };

    if (parcours === 'reviser') {
      await page.goto(`http://127.0.0.1:${port}/reviser`);
      await page.getByText('Maths', { exact: true }).waitFor({ timeout: 30000 });
      await capture('d1-matieres');
      await page.getByText('Maths', { exact: true }).click();
      await page.getByText('Statistiques').waitFor({ timeout: 15000 });
      await page.getByText('Statistiques').click();
      await page.getByText('Regroupement en classes').waitFor({ timeout: 15000 });
      await capture('chapitre');
      await page.getByText('Regroupement en classes').click();
      await page.getByText('Leçon suivante').waitFor({ timeout: 15000 });
      await capture('d2-lecon');
      await page.goto(`http://127.0.0.1:${port}/reviser`);
      await page.getByRole('tab', { name: 'Annales' }).click();
      await page.getByText('ENSPY 2024 · Mathématiques').waitFor({ timeout: 15000 });
      await capture('d3-annales');
      await page.getByText('ENSPY 2023 · Physique').click();
      await page.getByText('Correction détaillée').waitFor({ timeout: 15000 });
      await capture('d4-sujet');
      await contexte.close();
      continue;
    }

    if (parcours === 'mission') {
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.getByRole('button', { name: 'Commencer' }).waitFor({ timeout: 30000 });
      await capture('c1-accueil');
      await page.getByRole('button', { name: 'Commencer' }).click();
      await page.getByText('Choisis une réponse.').waitFor({ timeout: 30000 });
      for (let i = 0; i < 5; i++) {
        await page.getByText(['A', 'B', 'C', 'D', 'A'][i], { exact: true }).click();
        await page.getByRole('button', { name: 'Valider' }).click();
        if (i === 0) await capture('c2-correction');
        await page.getByRole('button', { name: i === 4 ? 'Terminer la mission' : 'Question suivante' }).click();
        if (i < 4) await page.getByText('Choisis une réponse.').waitFor();
      }
      await page.getByText('Mission terminée !').waitFor({ timeout: 15000 });
      await capture('c3-fin');
      await page.getByRole('button', { name: 'Terminer' }).last().click();
      await page.getByText('Mission du jour faite !').waitFor({ timeout: 15000 });
      await capture('c1-faite');
      await contexte.close();
      continue;
    }

    if (parcours === 'pass') {
      await page.goto(`http://127.0.0.1:${port}/offres`);
      await page.getByText('Conseillé').waitFor({ timeout: 30000 });
      await capture('e1-offres');
      await page.getByRole('button', { name: /^Payer/ }).click();
      await capture('e1-bientot');
      await page.getByRole('button', { name: 'Envoyer à mon parent' }).click();
      await page.getByText('Aperçu du message').waitFor({ timeout: 30000 });
      await page.getByLabel('Ton prénom (vu par ton parent)').fill('Aïcha');
      await capture('e6-parent');
      await page.getByRole('button', { name: 'Copier le lien' }).click();
      await page.getByText(/Lien valable jusqu/).waitFor({ timeout: 15000 });
      await capture('e6-lien-cree');
      await contexte.close();
      continue;
    }

    await page.goto(`http://127.0.0.1:${port}/mini-test`);
    await page.getByText('Choisis une réponse.').waitFor({ timeout: 30000 });
    await page.getByText('B', { exact: true }).click();
    await capture('a4-choix');
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Valider' }).click();
      if (i === 0) await capture('a4-correction');
      await page.getByRole('button', { name: i === 4 ? 'Voir mon score' : 'Question suivante' }).click();
      if (i < 4) {
        await page.getByText('Choisis une réponse.').waitFor();
        await page.getByText(['A', 'C', 'B', 'D'][i], { exact: true }).click();
      }
    }
    await page.getByText('Ton résultat').waitFor({ timeout: 15000 });
    await capture('a5-score');
    await page.getByText('Garde ton score et ta progression').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await capture('a6-sauvegarder');

    await page.goto(`http://127.0.0.1:${port}/compte/ancien`);
    await page.getByText('Tu avais déjà un compte Elearn ?').waitFor({ timeout: 30000 });
    await capture('a7-ancien-compte');
    await page.getByRole('button', { name: 'Retrouver mon compte' }).click();
    await capture('a7-erreurs');
    await contexte.close();
  }
} finally {
  await navigateur.close();
  serveur.close();
}
