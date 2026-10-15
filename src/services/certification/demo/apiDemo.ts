/**
 * Contenu embarqué pour essayer le profil TOEIC sur Expo web sans serveur. OUTIL DE DÉVELOPPEMENT : actif seulement si
 * `__DEV__` et `EXPO_PUBLIC_CERT_DEMO=1` (voir `api.ts`), absent des builds de production. Ne fabrique aucune règle :
 * les paramètres viennent de `reglages.json` (extrait de la migration), les formules de `certScore`. Les médias restent
 * sur R2 (`EXPO_PUBLIC_CERT_MEDIA_BASE`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CertApi } from '../api';
import { plageScore } from '../certScore';
import { lireReglages } from '../reglages';
import type { Examen, FinTentative, GroupeServi, MotsARevoir, QuestionServie, ReponseEnvoyee, ResultatReponse, Tentative } from '../types';
import contenu from './contenu.json';
import reglagesBruts from './reglages.json';

type Q = (typeof contenu.questions)[number];
type G = (typeof contenu.groupes)[number];
type Store = { tentatives: Record<string, { tentative: Tentative; reponses: Record<string, ReponseEnvoyee> }>; motsRates: number[] };

const CLE = 'cert.demo.store';
const EXAMEN: Examen = {
  code: 'toeic',
  name: 'TOEIC Listening and Reading',
  subtitle: 'Anglais des affaires',
  duration_min: 120,
  question_count: 200,
  goal_steps: [600, 700, 800, 900],
  sec_per_question: { listening: 27, reading: 45 },
};
const groupes = new Map<string, G>(contenu.groupes.map((g) => [g.id, g]));
const questions = new Map<string, Q>(contenu.questions.map((q) => [q.id, q]));
const notions = new Map(contenu.notions.map((n) => [n.part, { id: n.id, code: n.code, title: n.title, family: n.family as 'grammaire' | 'methode' }]));
const reglages = lireReglages(reglagesBruts as { key: string; value: unknown }[]);
const blueprint = (reglagesBruts as { key: string; value: unknown }[]).find((l) => l.key === 'diag_blueprint')!.value as Record<string, number>;

async function lire(): Promise<Store> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as Store;
  } catch {
    // magasin illisible : on repart de zéro
  }
  return { tentatives: {}, motsRates: [] };
}
const ecrire = (s: Store) => AsyncStorage.setItem(CLE, JSON.stringify(s)).catch(() => {});

function servir(q: Q): QuestionServie {
  const g = q.group ? groupes.get(q.group) : null;
  return {
    id: q.id,
    part: q.part,
    type: q.type,
    number: q.number,
    stem: q.stem,
    options: q.options,
    group: g ? { id: g.id, audio_path: g.audio_path, image_path: g.image_path, image_alt: g.image_alt, passage: g.passage as GroupeServi['passage'] } : null,
  };
}

/** Tirage par groupes entiers, dans l'ordre servi du plan : le dernier groupe est tronqué pour tomber juste. */
function tirer(partie: number, n: number): Q[] {
  const unites = new Map<string, Q[]>();
  for (const q of contenu.questions.filter((x) => x.part === partie)) {
    const cle = q.group ?? q.id;
    unites.set(cle, [...(unites.get(cle) ?? []), q]);
  }
  const melanges = [...unites.values()].sort(() => Math.random() - 0.5);
  const sortie: Q[] = [];
  for (const u of melanges) {
    if (sortie.length >= n) break;
    sortie.push(...u.slice(0, n - sortie.length));
  }
  return sortie;
}

function corriger(r: ReponseEnvoyee): ResultatReponse {
  const q = questions.get(r.question_id)!;
  const g = q.group ? groupes.get(q.group) : null;
  const juste = r.chosen === q.correct;
  return {
    question_id: q.id,
    client_uuid: r.client_uuid,
    correct: juste,
    skipped: r.chosen === null,
    correct_index: q.correct,
    trap: null,
    notion: notions.get(q.part) ?? null,
    notions: [],
    transcript: g?.transcript ?? null,
    replay: false,
  };
}

export const apiDemo: CertApi = {
  async listerExamens() {
    return [EXAMEN];
  },
  async lireReglages() {
    return reglagesBruts as { key: string; value: unknown }[];
  },
  async enregistrerPlan() {},
  async demarrerDiagnostic(clientUuid) {
    const s = await lire();
    const existante = s.tentatives[clientUuid];
    if (existante) return { ...existante.tentative, replay: true };
    const choisies = Object.entries(blueprint)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .flatMap(([partie, n]) => tirer(Number(partie), Number(n)));
    const tentative: Tentative = {
      attempt_id: `demo-${clientUuid}`,
      kind: 'diagnostic',
      part: null,
      length: choisies.length,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      credits_spent: 0,
      questions: choisies.map(servir),
      replay: false,
    };
    s.tentatives[clientUuid] = { tentative, reponses: {} };
    await ecrire(s);
    return tentative;
  },
  async envoyerReponses(reponses) {
    return reponses.map(corriger);
  },
  async terminerTentative(tentativeId, reponses) {
    const s = await lire();
    const entree = Object.values(s.tentatives).find((t) => t.tentative.attempt_id === tentativeId);
    const resultats = reponses.map(corriger);
    const parPartie: FinTentative['per_part'] = {};
    for (const res of resultats) {
      const q = questions.get(res.question_id)!;
      const e = (parPartie[String(q.part)] ??= { answered: 0, correct: 0 });
      e.answered += 1;
      e.correct += res.correct ? 1 : 0;
      if (!res.correct && (q.part === 5 || q.part === 7) && q.number % 3 === 0 && !s.motsRates.includes(q.number % 10)) s.motsRates.push(q.number % 10);
    }
    const somme = (parties: number[]) => parties.reduce((a, p) => ({ bonnes: a.bonnes + (parPartie[String(p)]?.correct ?? 0), repondues: a.repondues + (parPartie[String(p)]?.answered ?? 0) }), { bonnes: 0, repondues: 0 });
    const plage = plageScore(somme([1, 2, 3, 4]), somme([5, 6, 7]), reglages);
    if (entree) entree.tentative.status = 'finished';
    await ecrire(s);
    return {
      status: 'finished',
      attempt_id: tentativeId,
      kind: 'diagnostic',
      estimated: plage.estime,
      score: plage.estime ? plage.score : null,
      score_min: plage.estime ? plage.min : null,
      score_max: plage.estime ? plage.max : null,
      per_part: parPartie,
      results: resultats,
      replay: false,
    };
  },
  async motsARevoir(): Promise<MotsARevoir> {
    const s = await lire();
    return { total: s.motsRates.length, theme: s.motsRates.length ? 'bureau' : null };
  },
};
