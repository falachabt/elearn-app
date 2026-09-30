#!/usr/bin/env node
// Vérifie la session invité (connexion anonyme) de l'app web contre le Supabase LOCAL
// parcourt l'arrivée, la création de compte e-mail (conversion invité -> compte), le code de parrainage (?ref=), la déconnexion et la reconnexion, et prend des captures clair et sombre.
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
const echecs = [];
const verifier = (condition, message) => {
  console.log(`${condition ? 'OK   ' : 'ECHEC'} ${message}`);
  if (!condition) echecs.push(message);
};
const visible = (page, texte) => page.getByText(texte).filter({ visible: true }).first();
const uuid = (v) => sql(v).trim();

try {
  for (const schema of ['light', 'dark']) {
    const suffixe = schema === 'light' ? 'clair' : 'sombre';
    const contexte = await navigateur.newContext({ locale: 'fr-FR', colorScheme: schema, viewport: { width: 390, height: 844 } });
    const page = await contexte.newPage();
    page.on('pageerror', (e) => erreursConsole.push(e.message));
    page.on('console', (m) => m.type() === 'error' && erreursConsole.push(m.text()));
    const capture = async (nom) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(sortie, `compte-${nom}-${suffixe}.png`) });
      console.log(`Capture : compte-${nom}-${suffixe}.png`);
    };
    const code = `AMI${schema === 'light' ? '2026' : '2027'}`;
    const email = `e2e-${schema}-${Date.now()}@example.com`;

    // 1. Premier lancement avec un lien de parrainage (?ref=) : parcours d'arrivée, aucun compte demandé.
    await page.goto(`http://127.0.0.1:${port}/?ref=${code.toLowerCase()}`);
    await page.getByRole('button', { name: 'Je suis élève' }).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.endsWith('-auth-token')), null, { timeout: 30000 });
    verifier(await page.evaluate(() => !!localStorage.getItem('parrainage.code')), `[${schema}] code de parrainage du lien conservé localement`);
    await capture('bienvenue');
    const idInvite = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).user.id);
    verifier(uuid(`select is_anonymous from auth.users where id = '${idInvite}'`) === 't', `[${schema}] session invité anonyme créée`);

    await page.getByRole('button', { name: 'Je suis élève' }).click();
    await page.getByRole('button', { name: 'Continuer' }).waitFor();
    await capture('classe');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Explorer sans commencer' }).waitFor();
    await capture('premier-resultat');
    await page.getByRole('button', { name: 'Explorer sans commencer' }).click();

    // 2. Onglets, Moi en invité.
    await page.getByRole('tab', { name: /Accueil/ }).waitFor({ timeout: 30000 });
    await page.getByRole('tab', { name: /Moi/ }).click();
    await page.getByRole('button', { name: 'Créer un compte' }).waitFor();
    await capture('moi-invite');

    // 3. Création de compte : erreurs lisibles, puis conversion de l'invité.
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await page.getByLabel('Adresse e-mail').waitFor();
    await page.getByLabel('Adresse e-mail').fill('pas-un-email');
    await page.getByLabel('Mot de passe', { exact: true }).fill('123');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await visible(page, /semble incorrecte/).waitFor();
    await capture('creer-erreurs');
    verifier((await page.getByLabel('Code de parrainage (facultatif)').inputValue()) === code, `[${schema}] code de parrainage prérempli dans le formulaire`);
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-e2e');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await visible(page, 'Compte sauvegardé').waitFor({ timeout: 30000 });
    await capture('moi-connecte');

    const ligne = sql(`select id, is_anonymous, email from auth.users where email = '${email}'`);
    const [idCompte, anonyme] = ligne.split('|');
    verifier(idCompte === idInvite && anonyme === 'f', `[${schema}] l'invité est converti en compte permanent (même identifiant : ${idCompte === idInvite})`);
    verifier(uuid(`select code from public.referrals where referee_id = '${idInvite}'`) === code, `[${schema}] code de parrainage enregistré par trigger dans referrals`);

    // 4. Paramètres (sons et vibrations).
    await page.getByRole('button', { name: 'Sons et vibrations' }).click();
    await page.getByRole('switch', { name: 'Sons' }).first().waitFor();
    await capture('parametres');
    await page.goBack();

    // 5. Déconnexion, nouvelle session invité, puis reconnexion avec le même compte.
    await page.getByRole('tab', { name: /Moi/ }).click();
    await page.getByRole('button', { name: 'Me déconnecter' }).click();
    await page.getByRole('button', { name: 'Créer un compte' }).waitFor({ timeout: 30000 });
    const idApres = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).user.id);
    verifier(idApres !== idInvite, `[${schema}] déconnexion : nouvelle session invité distincte`);
    await page.getByRole('button', { name: 'J’ai déjà un compte' }).click();
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Me connecter' }).click();
    await visible(page, /incorrect/).waitFor({ timeout: 30000 });
    await capture('connexion-erreur');
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-e2e');
    await page.getByRole('button', { name: 'Me connecter' }).click();
    await visible(page, 'Compte sauvegardé').waitFor({ timeout: 30000 });
    const idFinal = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).user.id);
    verifier(idFinal === idInvite, `[${schema}] reconnexion : on retrouve le même compte`);

    // 6. Captures des onglets (comme avant).
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
const bannieres = erreursConsole.filter((e) => /session|supabase|auth|anonym/i.test(e) && !/status of 400|Invalid login/i.test(e));
console.log(`Utilisateurs anonymes : ${avant} -> ${apres}`);
verifier(apres > avant, 'au moins un utilisateur anonyme créé');
verifier(bannieres.length === 0, `aucune erreur console liée à la session${bannieres.length ? ' : ' + bannieres.join(' | ') : ''}`);
if (echecs.length) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s).`);
  process.exit(1);
}
console.log('OK : parcours d’arrivée, création de compte (conversion invité), parrainage et reconnexion fonctionnels contre Supabase local.');
process.exit(0);
