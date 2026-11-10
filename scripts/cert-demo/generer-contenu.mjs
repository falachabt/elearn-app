// Génère le contenu embarqué du mode démo (Expo web) à partir de la démo TOEIC : questions, groupes, transcriptions.
// Usage : node scripts/cert-demo/generer-contenu.mjs <dossier-demo> > src/services/certification/demo/contenu.json
// Les médias ne sont PAS embarqués (ils restent sur R2) ; le fichier n'entre jamais dans un build de production.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dossier = process.argv[2];
if (!dossier) {
  console.error('Usage : node generer-contenu.mjs <dossier-demo>');
  process.exit(1);
}
const html = readFileSync(path.join(dossier, 'index.html'), 'utf8');
const debut = html.indexOf('const EXAM = ') + 'const EXAM = '.length;
let profondeur = 0;
let fin = debut;
for (let i = debut, chaine = false, echappe = false; i < html.length; i++) {
  const c = html[i];
  if (chaine) {
    if (echappe) echappe = false;
    else if (c === '\\') echappe = true;
    else if (c === '"') chaine = false;
    continue;
  }
  if (c === '"') chaine = true;
  else if (c === '[' || c === '{') profondeur++;
  else if (c === ']' || c === '}') {
    profondeur--;
    if (profondeur === 0) {
      fin = i + 1;
      break;
    }
  }
}
const parties = JSON.parse(html.slice(debut, fin));
const TYPES = { 1: 'photo', 2: 'question_reponse', 3: 'conversation', 4: 'expose', 5: 'phrase', 6: 'texte_trous', 7: 'passage' };
const NOTIONS = {
  1: ['demo_photos', 'Décrire une photo (démo)', 'methode'],
  2: ['demo_question_reponse', 'Question et réponse (démo)', 'methode'],
  3: ['demo_conversations', 'Comprendre une conversation (démo)', 'methode'],
  4: ['demo_exposes', 'Comprendre un exposé (démo)', 'methode'],
  5: ['demo_phrases', 'Phrases à compléter (démo)', 'grammaire'],
  6: ['demo_textes', 'Textes à trous (démo)', 'grammaire'],
  7: ['demo_passages', 'Passages de lecture (démo)', 'methode'],
};
const groupes = [];
const questions = [];
for (const p of parties) {
  for (const it of p.items) {
    let groupe = null;
    if (it.audio || it.image || it.doc || it.docs) {
      groupe = `g-${it.id}`;
      groupes.push({
        id: groupe,
        part: p.id,
        audio_path: it.audio ? `toeic/${it.audio}` : null,
        image_path: it.image ? `toeic/${it.image}` : null,
        image_alt: it.alt ?? null,
        passage: it.doc ? { docs: [it.doc] } : it.docs ? { docs: it.docs, multi: !!it.multi } : null,
        transcript: it.transcript ?? null,
      });
    }
    for (const q of it.qs) {
      questions.push({ id: `q-${q.n}`, part: p.id, type: TYPES[p.id], number: q.n, group: groupe, stem: q.q, options: q.opts, correct: q.a, explanation: q.ex ?? null, notion: p.id });
    }
  }
}
const notions = Object.entries(NOTIONS).map(([part, [code, title, family]]) => ({ id: `n-${part}`, code, title, family, part: Number(part) }));
console.log(JSON.stringify({ groupes, questions, notions }));
