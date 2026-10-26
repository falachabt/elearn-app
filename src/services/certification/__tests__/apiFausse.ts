import type { CertApi } from '../api';
import type { Examen, FinTentative, QuestionServie, ReponseEnvoyee, ResultatReponse, Tentative } from '../types';
import { LIGNES_SEED } from './fixtures';
import type { DemarrageMini, EtatGains, MotCarnetServi, NotionFiche, Revision, ResultatGain, ResultatMot, SeanceServie, Stats, TentativeListee } from '../types';

export const EXAMEN_TEST: Examen = {
  code: 'toeic',
  name: 'TOEIC Listening and Reading',
  subtitle: 'Anglais des affaires',
  duration_min: 120,
  question_count: 200,
  goal_steps: [600, 700, 800, 900],
  sec_per_question: { listening: 27, reading: 45 },
};

/** Répartition du plan de diagnostic utilisée par les tests (jeu d'entrée, pas une règle du code) : le plan servi, 21 questions. */
export const PLAN_TEST: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 5 };

/**
 * Formes de groupes de la banque, reprises dans le jeu de test : parties 3 et 4 en conversations de 3, partie 6 en
 * texte à trous de 4, partie 7 en documents de 2 puis 3. Les autres parties restent une question par groupe (1, 2)
 * ou sans groupe (5).
 */
const TAILLES_GROUPES: Record<number, number[]> = { 3: [3], 4: [3], 6: [4], 7: [2, 3] };

export function questionsTest(plan: Record<number, number> = PLAN_TEST): QuestionServie[] {
  const sortie: QuestionServie[] = [];
  let n = 1;
  for (const [partieBrute, nombre] of Object.entries(plan)) {
    const partie = Number(partieBrute);
    const tailles = TAILLES_GROUPES[partie];
    if (!tailles) {
      for (let i = 0; i < nombre; i++) {
        sortie.push({
          id: `q-${n}`,
          part: partie,
          type: 'phrase',
          number: n,
          stem: `Question ${n}`,
          options: ['a', 'b', 'c', 'd'],
          group: partie <= 4 ? { id: `g-${n}`, audio_path: `toeic/audio/p${partie}_${n}.mp3`, image_path: null, image_alt: null, passage: null } : null,
        });
        n++;
      }
      continue;
    }
    let restes = nombre;
    let g = 0;
    while (restes > 0) {
      const taille = Math.min(tailles[g % tailles.length], restes);
      const idGroupe = `g-${partie}-${g + 1}`;
      const numeros: number[] = [];
      for (let i = 0; i < taille; i++) {
        numeros.push(n);
        n++;
      }
      // Le texte à trous de la partie 6 porte un marqueur « {k} » par question du groupe, comme la banque servie.
      const passage =
        partie === 6
          ? { kind: 'Texte', head: `Texte ${idGroupe}`, text: numeros.map((_, i) => `Phrase ${i + 1} du texte avec un {${i + 1}} à compléter.`).join(' ') }
          : { kind: 'Document', head: `Document ${idGroupe}`, text: `Contenu du document ${idGroupe}.` };
      for (const numero of numeros) {
        sortie.push({
          id: `q-${numero}`,
          part: partie,
          type: partie === 6 ? 'texte_trous' : 'phrase',
          number: numero,
          stem: `Question ${numero}`,
          options: ['a', 'b', 'c', 'd'],
          group: { id: idGroupe, audio_path: partie <= 4 ? `toeic/audio/${idGroupe}.mp3` : null, image_path: null, image_alt: null, passage },
        });
      }
      restes -= taille;
      g++;
    }
  }
  return sortie;
}

export const STATS_VIDE = (periode: Stats['periode']): Stats => ({
  status: 'empty', periode, reponsesTotal: 0, score: null, barres: [], tendance: null, parties: [], minutesSeances: 0, minutesLecture: 0,
  joursSur7: 0, seances: 0, serieJours: 0, mots: { aRevoir: 0, enCours: 0, connus: 0 }, calculeLe: null,
});

export type Appels = {
  demarrer: number; terminer: number; plans: unknown[]; envois: number; series: unknown[]; mots: string[]; explications: string[];
  notionsOuvertes: { id: string; secondes: number }[]; resultatsMots: ResultatMot[][]; seances: unknown[]; compositions: { minutes: number; eviter: number | null }[];
  minis: { partie: number | null; longueur: number }[]; abandons: { id: string; raison: string }[]; gainsReclames: string[]; stats: number[];
};

/** API en mémoire : la bonne réponse est toujours l'option 0 ; les notions suivent la partie. */
export function creerApiFausse(options: {
  echecsTerminer?: number; echecDemarrer?: boolean; echecsEnvoi?: number; echecSerie?: boolean; serieVide?: boolean; mots?: { total: number; theme: string | null };
  revision?: Revision | 'echec'; carnet?: MotCarnetServi[] | 'echec'; seance?: SeanceServie | 'echec'; fiche?: NotionFiche | 'echec'; echecsMots?: number;
  mini?: 'insufficient' | 'account_required' | 'echec'; stats?: Stats | 'echec'; gains?: EtatGains | 'echec'; reclamation?: ResultatGain; tentatives?: TentativeListee[] | 'echec';
  /** Tentatives relues par identifiant (`lireTentative`), par exemple le diagnostic terminé d'un compte reconnecté. */
  tentativeParId?: Record<string, Tentative>;
  abandon?: { rembourse: boolean };
  /** Surcharges de réglages `cert_settings` (par clé), fusionnées dans les lignes du seed. */
  reglages?: Record<string, unknown>;
  /** Série : les questions servies partagent un même groupe (conversation ou texte), comme les parties 3, 4, 6 et 7. */
  groupeSerie?: boolean;
} = {}) {
  const appels: Appels = { demarrer: 0, terminer: 0, plans: [], envois: 0, series: [], mots: [], explications: [], notionsOuvertes: [], resultatsMots: [], seances: [], compositions: [], minis: [], abandons: [], gainsReclames: [], stats: [] };
  const minis = new Map<string, { part: number | null; length: number; questions: QuestionServie[] }>();
  let echecs = options.echecsTerminer ?? 0;
  let echecsEnvoi = options.echecsEnvoi ?? 0;
  let echecsMots = options.echecsMots ?? 0;
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
      if (!options.reglages) return LIGNES_SEED;
      const surcharges = options.reglages;
      const lignes = LIGNES_SEED.map((l) => (surcharges[l.key] !== undefined ? { ...l, value: surcharges[l.key] } : l));
      for (const [key, value] of Object.entries(surcharges)) {
        if (!LIGNES_SEED.some((l) => l.key === key)) lignes.push({ key, value });
      }
      return lignes;
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
      if (options.serieVide) return [];
      const choisies = questions.filter((q) => (perimetre.part ? q.part === perimetre.part : true)).slice(0, taille ?? 3);
      return options.groupeSerie ? choisies.map((q) => ({ ...q, group: { id: 'gserie', audio_path: null, image_path: null, image_alt: null, passage: null } })) : choisies;
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
      const mini = minis.get(id);
      // Mini-test par partie : pas de fourchette de score (E-38) ; mixte : fourchette large.
      const sansScore = mini ? mini.part !== null : false;
      return {
        status: 'finished', attempt_id: id, kind: mini ? 'mini' : 'diagnostic', estimated: !sansScore,
        score: sansScore ? null : 700, score_min: sansScore ? null : 650, score_max: sansScore ? null : 730, per_part: per, results: resultats, replay: false,
      };
    },
    async motsARevoir() {
      return options.mots ?? { total: 0, theme: null };
    },
    async lireRevision() {
      if (options.revision === 'echec') throw new Error('réseau');
      return options.revision ?? { notions: [], parties: [] };
    },
    async lireCarnet() {
      if (options.carnet === 'echec') throw new Error('réseau');
      return options.carnet ?? [];
    },
    async composerSeance(_exam, minutes, _jour, eviter) {
      appels.compositions.push({ minutes, eviter });
      if (options.seance === 'echec') throw new Error('réseau');
      return options.seance ? { ...options.seance, minutes } : { minutes, blocs: [], pourquoi: { erreurs: 0, notion: null, motsEchus: 0 } };
    },
    async lireNotion() {
      if (options.fiche === 'echec' || !options.fiche) throw new Error('réseau');
      return options.fiche;
    },
    async ouvrirNotion(id, secondes) {
      appels.notionsOuvertes.push({ id, secondes });
    },
    async envoyerResultatsMots(resultats) {
      if (echecsMots > 0) {
        echecsMots--;
        throw new Error('réseau');
      }
      appels.resultatsMots.push(resultats);
    },
    async terminerSeance(clientUuid, _exam, composition) {
      appels.seances.push({ clientUuid, composition });
    },
    async listerTests() {
      return [];
    },
    async demarrerTest(): Promise<DemarrageMini> {
      throw new Error('non prévu dans ce test');
    },
    async listerDefsTests() {
      return [];
    },
    async demarrerDefTest(): Promise<DemarrageMini> {
      throw new Error('non prévu dans ce test');
    },
    async demarrerMini(clientUuid, _exam, partie, longueur): Promise<DemarrageMini> {
      appels.minis.push({ partie, longueur });
      if (options.mini === 'echec') throw new Error('réseau');
      if (options.mini === 'account_required') return { status: 'account_required', tentative: null, cout: null, solde: null };
      if (options.mini === 'insufficient') return { status: 'insufficient', tentative: null, cout: 2, solde: 0 };
      const choisies = (partie ? questions.filter((q) => q.part === partie) : questions).slice(0, longueur);
      const id = `mini-${clientUuid}`;
      minis.set(id, { part: partie, length: longueur, questions: choisies });
      const tentative: Tentative = { attempt_id: id, kind: 'mini', part: partie, length: choisies.length, status: 'in_progress', started_at: new Date().toISOString(), credits_spent: 1, questions: choisies, replay: false };
      return { status: 'started', tentative, cout: 1, solde: 11 };
    },
    async lireTentative(id) {
      const prete = options.tentativeParId?.[id];
      if (prete) return prete;
      const m = minis.get(id);
      if (!m) throw new Error('tentative introuvable');
      return { attempt_id: id, kind: 'mini', part: m.part, length: m.questions.length, status: 'in_progress', started_at: new Date().toISOString(), credits_spent: 1, questions: m.questions, replay: false };
    },
    async abandonnerTentative(id, raison) {
      appels.abandons.push({ id, raison });
      return { statut: 'abandoned', rembourse: options.abandon?.rembourse ?? false, solde: 12 };
    },
    async listerTentatives() {
      if (options.tentatives === 'echec') throw new Error('réseau');
      return options.tentatives ?? [];
    },
    async lireProgressionTests() {
      return [
        { kind: 'half_listening', statut: 'pas_fait', tentatives: 0, dernierScore: null, meilleurScore: null, derniereDate: null, tentativeEnCours: false },
        { kind: 'half_reading', statut: 'pas_fait', tentatives: 0, dernierScore: null, meilleurScore: null, derniereDate: null, tentativeEnCours: false },
        { kind: 'full', statut: 'pas_fait', tentatives: 0, dernierScore: null, meilleurScore: null, derniereDate: null, tentativeEnCours: false },
      ];
    },
    async lireStats(_exam, periode) {
      appels.stats.push(periode);
      if (options.stats === 'echec') throw new Error('réseau');
      return options.stats ?? STATS_VIDE(periode);
    },
    async lireGains() {
      if (options.gains === 'echec') throw new Error('réseau');
      return options.gains ?? { plafond: 15, gagneSemaine: 0, serie: 0, gains: [] };
    },
    async reclamerGain(code) {
      appels.gainsReclames.push(code);
      return options.reclamation ?? { status: 'granted', montant: 2, gagneSemaine: 2, plafond: 15 };
    },
  };
  return { api, appels, questions };
}
