import type { CertApi } from '../api';
import type { Examen, FinTentative, QuestionServie, ReponseEnvoyee, ResultatReponse, Tentative } from '../types';
import { LIGNES_SEED } from './fixtures';

export const EXAMEN_TEST: Examen = {
  code: 'toeic',
  name: 'TOEIC Listening and Reading',
  subtitle: 'Anglais des affaires',
  duration_min: 120,
  question_count: 200,
  goal_steps: [600, 700, 800, 900],
  sec_per_question: { listening: 27, reading: 45 },
};

/** Répartition du plan de diagnostic utilisée par les tests (jeu d'entrée, pas une règle du code). */
export const PLAN_TEST: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 3, 5: 3, 6: 2, 7: 5 };

export function questionsTest(plan: Record<number, number> = PLAN_TEST): QuestionServie[] {
  const sortie: QuestionServie[] = [];
  let n = 1;
  for (const [partie, nombre] of Object.entries(plan)) {
    for (let i = 0; i < nombre; i++) {
      sortie.push({
        id: `q-${n}`,
        part: Number(partie),
        type: 'phrase',
        number: n,
        stem: `Question ${n}`,
        options: ['a', 'b', 'c', 'd'],
        group: Number(partie) <= 4 ? { id: `g-${n}`, audio_path: `toeic/audio/p${partie}_${n}.mp3`, image_path: null, image_alt: null, passage: null } : null,
      });
      n++;
    }
  }
  return sortie;
}

export type Appels = { demarrer: number; terminer: number; plans: unknown[]; envois: number; series: unknown[]; mots: string[]; explications: string[] };

/** API en mémoire : la bonne réponse est toujours l'option 0 ; les notions suivent la partie. */
export function creerApiFausse(options: { echecsTerminer?: number; echecDemarrer?: boolean; echecsEnvoi?: number; echecSerie?: boolean; mots?: { total: number; theme: string | null } } = {}) {
  const appels: Appels = { demarrer: 0, terminer: 0, plans: [], envois: 0, series: [], mots: [], explications: [] };
  let echecs = options.echecsTerminer ?? 0;
  let echecsEnvoi = options.echecsEnvoi ?? 0;
  const corriger = (reponses: ReponseEnvoyee[]): ResultatReponse[] =>
    reponses.map((r) => {
      const q = questions.find((x) => x.id === r.question_id)!;
      return {
        question_id: r.question_id,
        client_uuid: r.client_uuid,
        correct: r.chosen === 0,
        skipped: r.chosen === null,
        correct_index: 0,
        trap: q.part === 5 ? 'Piège de la forme du mot.' : null,
        notion: { id: `n-${q.part}`, code: `n${q.part}`, title: `Notion ${q.part}`, family: 'grammaire' },
        notions: [],
        words: q.part === 5 ? [{ id: `w-${q.number}`, word: `word${q.number}` }] : [],
        transcript: null,
        replay: false,
      };
    });
  const questions = questionsTest();
  const api: CertApi = {
    async listerExamens() {
      return [EXAMEN_TEST];
    },
    async lireReglages() {
      return LIGNES_SEED;
    },
    async enregistrerPlan(plan) {
      appels.plans.push(plan);
    },
    async demarrerDiagnostic(clientUuid) {
      appels.demarrer++;
      if (options.echecDemarrer) throw new Error('réseau');
      const t: Tentative = { attempt_id: `att-${clientUuid}`, kind: 'diagnostic', part: null, length: questions.length, status: 'in_progress', started_at: '2026-10-15T10:00:00Z', credits_spent: 0, questions, replay: false };
      return t;
    },
    async envoyerReponses(reponses) {
      appels.envois++;
      if (echecsEnvoi > 0) {
        echecsEnvoi--;
        throw new Error('réseau');
      }
      return corriger(reponses);
    },
    async lireSerie(perimetre, _exam, taille) {
      appels.series.push(perimetre);
      if (options.echecSerie) throw new Error('réseau');
      const choisies = questions.filter((q) => (perimetre.part ? q.part === perimetre.part : true)).slice(0, taille ?? 3);
      return choisies;
    },
    async ajouterMot(motId) {
      appels.mots.push(motId);
    },
    async terminerTentative(id, reponses: ReponseEnvoyee[]) {
      appels.terminer++;
      if (echecs > 0) {
        echecs--;
        throw new Error('réseau');
      }
      const resultats: ResultatReponse[] = reponses.map((r) => {
        const q = questions.find((x) => x.id === r.question_id)!;
        return {
          question_id: r.question_id,
          client_uuid: r.client_uuid,
          correct: r.chosen === 0,
          skipped: r.chosen === null,
          correct_index: 0,
          trap: null,
          notion: { id: `n-${q.part}`, code: `n${q.part}`, title: `Notion ${q.part}`, family: 'grammaire' },
          notions: [],
          transcript: null,
          replay: false,
        };
      });
      const per: FinTentative['per_part'] = {};
      for (const res of resultats) {
        const q = questions.find((x) => x.id === res.question_id)!;
        const e = (per[String(q.part)] ??= { answered: 0, correct: 0 });
        e.answered++;
        e.correct += res.correct ? 1 : 0;
      }
      return { status: 'finished', attempt_id: id, kind: 'diagnostic', estimated: true, score: 700, score_min: 650, score_max: 730, per_part: per, results: resultats, replay: false };
    },
    async motsARevoir() {
      return options.mots ?? { total: 0, theme: null };
    },
  };
  return { api, appels, questions };
}
