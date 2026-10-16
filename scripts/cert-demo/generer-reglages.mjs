// Extrait les paramètres de seed (`cert_settings`) de la migration du profil TOEIC pour le mode démo : une seule source,
// aucune valeur recopiée à la main.
// Usage : node scripts/cert-demo/generer-reglages.mjs <migration.sql> > src/services/certification/demo/reglages.json
import { readFileSync } from 'node:fs';

const sql = readFileSync(process.argv[2], 'utf8');
const bloc = sql.slice(sql.indexOf('insert into public.cert_settings'), sql.indexOf('on conflict (key) do nothing', sql.indexOf('insert into public.cert_settings')));
const lignes = [];
for (const m of bloc.matchAll(/\('([a-z0-9_]+)',\s*'((?:[^']|'')*)'\)/g)) {
  lignes.push({ key: m[1], value: JSON.parse(m[2].replace(/''/g, "'")) });
}
console.log(JSON.stringify(lignes));
