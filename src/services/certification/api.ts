import { getSupabase } from '../supabase';
import type { LigneReglage } from './reglages';
import { jourDe, type Jour } from './jours';
import type { EtatMaitrise } from './certMaitrise';
import type { BlocServi, DemarrageMini, EtatGains, Examen, PeriodeStats, ResultatGain, Stats, TentativeListee, FinTentative, MotCarnetServi, MotsARevoir, NotionFiche, PlanEleve, QuestionServie, ReponseEnvoyee, ResultatMot, ResultatReponse, Revision, SeanceServie, Tentative } from './types';

/**
 * Accès aux données du profil TOEIC. Une seule interface : le serveur (RPC `cert_*`) en production, et un contenu
 * embarqué pour les essais sur Expo web (outil de développement, voir `demo/`). Les écrans ne connaissent que ceci.
 */
/** Périmètre d'une série : une partie, une notion, ou rien (mélange). */
export type PerimetreSerie = {
  part?: number;
  notion?: string;
  /** Questions ratées à rejouer (F6) au lieu d'un tirage. */
  rejeu?: boolean;
  /** Les trois questions d'ancrage de la notion (C5) au lieu d'un tirage. */
  ancrage?: boolean;
};
export type ExplicationAchetee = { statut: 'spent' | 'unlimited' | 'already' | 'free' | 'insufficient'; cout: number; solde: number; contenu: { explanation: string | null; trap: string | null } | null };

export interface CertApi {
  listerExamens(): Promise<Examen[]>;
  lireReglages(): Promise<LigneReglage[]>;
  enregistrerPlan(plan: Partial<PlanEleve> & { exam: string; effacerDate?: boolean }): Promise<void>;
  demarrerDiagnostic(clientUuid: string, exam: string, jourLocal: Jour): Promise<Tentative>;
  envoyerReponses(reponses: ReponseEnvoyee[]): Promise<ResultatReponse[]>;
  terminerTentative(tentativeId: string, reponses: ReponseEnvoyee[]): Promise<FinTentative>;
  /** Série d'entraînement (B1 à B7) : par partie ou par notion, sans la bonne réponse. */
  lireSerie(perimetre: PerimetreSerie, exam: string, taille?: number): Promise<QuestionServie[]>;
  /** Ajoute un mot clé au carnet, en boîte 1 (B9). Idempotent. */
  ajouterMot(motId: string, jourLocal: Jour): Promise<void>;
  /** Explication détaillée payante. Absent en production : la dépense passe alors par `credits.depenser`. */
  acheterExplication?(questionId: string): Promise<ExplicationAchetee>;
  /** Mots du carnet en boîte 1 (« à revoir ») et leur thème le plus fréquent. */
  motsARevoir(): Promise<MotsARevoir>;
  /** Notions avec état (F3) et maîtrise des sept parties (F4) : C2, C3, C4. */
  lireRevision(exam: string, jourLocal: Jour): Promise<Revision>;
  /** Carnet de l'élève (F5) : tous les mots, le filtrage se fait sur l'appareil. */
  lireCarnet(exam: string): Promise<MotCarnetServi[]>;
  /** Séance du jour (F7) composée selon la durée choisie. */
  composerSeance(exam: string, minutes: number, jourLocal: Jour, eviterPartie: number | null): Promise<SeanceServie>;
  /** Fiche d'une notion et ses questions d'ancrage (C5). */
  lireNotion(notionId: string): Promise<NotionFiche>;
  /** Enregistre l'ouverture d'une fiche (anti-répétition F7) et le temps de lecture. */
  ouvrirNotion(notionId: string, secondesLecture: number, jourLocal: Jour): Promise<void>;
  /** Notes d'une séance de mots (C8), idempotent par `clientUuid`. */
  envoyerResultatsMots(resultats: ResultatMot[]): Promise<void>;
  /** Enregistre la séance du jour terminée avec sa composition (D2). */
  terminerSeance(clientUuid: string, exam: string, composition: unknown, minutesActives: number, jourLocal: Jour): Promise<void>;
  /** Départ d'un mini-test (T2) : le serveur débite au lancement (idempotent par `clientUuid`). */
  demarrerMini(clientUuid: string, exam: string, partie: number | null, longueur: number, jourLocal: Jour): Promise<DemarrageMini>;
  /** Tentative en cours, pour la reprise (T3). */
  lireTentative(tentativeId: string): Promise<Tentative>;
  /** Abandon : rembourse dans la fenêtre prévue par les réglages. */
  abandonnerTentative(tentativeId: string, raison: 'user' | 'expired'): Promise<{ statut: Tentative['status']; rembourse: boolean; solde: number | null }>;
  /** Historique des tentatives (T4), plus récentes d'abord. */
  listerTentatives(exam: string): Promise<TentativeListee[]>;
  /** Statistiques (F11) d'une période : un seul appel. */
  lireStats(exam: string, periode: PeriodeStats, jourLocal: Jour): Promise<Stats>;
  /** Gains de crédits TOEIC (G1) et réclamation d'un gain. */
  lireGains(exam: string, jourLocal: Jour): Promise<EtatGains>;
  reclamerGain(code: string, exam: string, jourLocal: Jour): Promise<ResultatGain>;
}

const ETATS_SERVEUR: Record<string, EtatMaitrise> = { not_started: 'pas_commencee', fragile: 'fragile', progress: 'en_progres', acquired: 'acquise' };
const etatDepuisServeur = (e: string): EtatMaitrise => ETATS_SERVEUR[e] ?? 'pas_commencee';

function verifier<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

type Revisee = 'lireRevision' | 'lireCarnet' | 'composerSeance' | 'lireNotion' | 'ouvrirNotion' | 'envoyerResultatsMots' | 'terminerSeance';
type Testee = 'demarrerMini' | 'lireTentative' | 'abandonnerTentative' | 'listerTentatives' | 'lireStats' | 'lireGains' | 'reclamerGain';
const baseServeur: Omit<CertApi, Revisee | Testee> = {
  async listerExamens() {
    const res = await getSupabase().from('cert_exams').select('code,name,subtitle,duration_min,question_count,goal_steps,sec_per_question,sort').order('sort', { ascending: false });
    return verifier(res) as Examen[];
  },
  async lireReglages() {
    const res = await getSupabase().from('cert_settings').select('key,value');
    return verifier(res) as LigneReglage[];
  },
  async enregistrerPlan({ exam, objectif, dateTest, minutes, effacerDate }) {
    const res = await getSupabase().rpc('cert_set_plan', {
      p_exam: exam,
      p_goal: objectif ?? null,
      p_test_date: dateTest ?? null,
      p_minutes: minutes ?? null,
      p_clear_date: !!effacerDate,
    });
    verifier(res);
  },
  async demarrerDiagnostic(clientUuid, exam, jourLocal) {
    const res = await getSupabase().rpc('cert_diagnostic_start', { p_client_uuid: clientUuid, p_exam: exam, p_local_day: jourLocal });
    return verifier(res) as Tentative;
  },
  async envoyerReponses(reponses) {
    const res = await getSupabase().rpc('cert_submit_answers', { p_answers: reponses });
    return verifier(res) as ResultatReponse[];
  },
  async terminerTentative(tentativeId, reponses) {
    const res = await getSupabase().rpc('cert_attempt_finish', { p_attempt: tentativeId, p_answers: reponses });
    return verifier(res) as FinTentative;
  },
  async lireSerie(perimetre, exam, taille) {
    if (perimetre.rejeu) {
      const rejeu = await getSupabase().rpc('cert_replay_get', { p_count: taille ?? 10, p_today: jourDe(new Date()) });
      return verifier(rejeu) as QuestionServie[];
    }
    const res = await getSupabase().rpc('cert_series_get', { p_exam: exam, p_part: perimetre.part ?? null, p_notion: perimetre.notion ?? null, p_count: taille ?? null });
    return verifier(res) as QuestionServie[];
  },
  async ajouterMot(motId, jourLocal) {
    const res = await getSupabase().rpc('cert_word_add', { p_word: motId, p_local_day: jourLocal });
    verifier(res);
  },
  async motsARevoir() {
    const res = await getSupabase().from('cert_user_word').select('cert_words(theme)').eq('box', 1);
    const lignes = verifier(res) as unknown as { cert_words: { theme: string | null } | null }[];
    const compte = new Map<string, number>();
    for (const l of lignes) {
      const t = l.cert_words?.theme;
      if (t) compte.set(t, (compte.get(t) ?? 0) + 1);
    }
    const theme = [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    return { total: lignes.length, theme };
  },
};

const revisionServeur: Pick<CertApi, Revisee> = {
lireRevision: async (exam, jourLocal) => {
  const res = await getSupabase().rpc('cert_notions_list', { p_exam: exam, p_today: jourLocal });
  const j = verifier(res) as {
    notions: { id: string; code: string; title: string; family: NotionFiche['famille']; parts: number[]; duration_min: number | null; has_course: boolean; answers: number; correct: number; state: string; last_opened: string | null }[];
    parts: { part: number; answers: number; mastery: number; state: string }[];
  };
  return {
    notions: j.notions.map((n) => ({
      id: n.id, code: n.code, titre: n.title, famille: n.family, parties: n.parts, dureeMin: n.duration_min, fiche: n.has_course,
      reponses: n.answers, reussies: n.correct, etat: etatDepuisServeur(n.state), derniereOuverture: n.last_opened,
    })),
    parties: j.parts.map((p) => ({ partie: p.part, reponses: p.answers, m: Number(p.mastery), etat: etatDepuisServeur(p.state) })),
  };
},
lireCarnet: async (exam) => {
  const res = await getSupabase().rpc('cert_words_list', { p_exam: exam });
  const lignes = verifier(res) as { id: string; word: string; pos: string | null; def_fr: string; example: string | null; theme: string | null; audio_path: string | null; box: 1 | 2 | 3 | 4; next_review: string; seen: number; good: number; bad: number }[];
  return lignes.map((m) => ({
    id: m.id, mot: m.word, categorie: m.pos, definition: m.def_fr, exemple: m.example, theme: m.theme, audio: m.audio_path,
    boite: m.box, prochaineRevue: m.next_review, vus: m.seen, bons: m.good, mauvais: m.bad,
  }));
},
composerSeance: async (exam, minutes, jourLocal, eviterPartie) => {
  const res = await getSupabase().rpc('cert_session_compose', { p_exam: exam, p_minutes: minutes, p_today: jourLocal, p_avoid_part: eviterPartie });
  const j = verifier(res) as { minutes: number; blocks: Record<string, unknown>[]; why: { errors: number; notion: string | null; words_due: number } };
  const blocs: BlocServi[] = j.blocks.map((b) => {
    if (b.kind === 'course') return { type: 'cours', notionId: String(b.notion_id), titre: String(b.title), minutes: Number(b.minutes), erreurs: Number(b.errors) };
    if (b.kind === 'words') return { type: 'mots', nombre: Number(b.count), echus: Number(b.due) };
    if (b.kind === 'replay') return { type: 'rejeu', nombre: Number(b.count), partie: b.part === null || b.part === undefined ? null : Number(b.part) };
    return { type: 'serie', partie: Number(b.part), nombre: Number(b.count) };
  });
  return { minutes: j.minutes, blocs, pourquoi: { erreurs: j.why.errors, notion: j.why.notion, motsEchus: j.why.words_due } };
},
lireNotion: async (notionId) => {
  const res = await getSupabase().rpc('cert_notion_get', { p_notion: notionId });
  const j = verifier(res) as { id: string; code: string; family: NotionFiche['famille']; title: string; parts: number[]; course_md: string | null; duration_min: number | null; anchors: QuestionServie[] };
  return { id: j.id, code: j.code, famille: j.family, titre: j.title, parties: j.parts, markdown: j.course_md, dureeMin: j.duration_min, ancrages: j.anchors ?? [] };
},
ouvrirNotion: async (notionId, secondesLecture, jourLocal) => {
  const res = await getSupabase().rpc('cert_notion_open', { p_notion: notionId, p_read_seconds: secondesLecture, p_local_day: jourLocal });
  verifier(res);
},
envoyerResultatsMots: async (resultats) => {
  const res = await getSupabase().rpc('cert_word_result', {
    p_results: resultats.map((r) => ({ word_id: r.wordId, client_uuid: r.clientUuid, known: r.connu, local_day: r.jour })),
  });
  verifier(res);
},
terminerSeance: async (clientUuid, exam, composition, minutesActives, jourLocal) => {
  const res = await getSupabase().rpc('cert_session_complete', {
    p_client_uuid: clientUuid, p_exam: exam, p_composition: composition, p_active_minutes: minutesActives, p_local_day: jourLocal,
  });
  verifier(res);
},
};

const testsServeur: Pick<CertApi, Testee> = {
  demarrerMini: async (clientUuid, exam, partie, longueur, jourLocal) => {
    const res = await getSupabase().rpc('cert_mini_start', { p_client_uuid: clientUuid, p_part: partie, p_length: longueur, p_exam: exam, p_local_day: jourLocal });
    const j = verifier(res) as Record<string, unknown> & { status: DemarrageMini['status']; cost?: number; balance?: number };
    if (j.status === 'insufficient' || j.status === 'account_required') {
      return { status: j.status, tentative: null, cout: j.cost ?? null, solde: j.balance ?? null };
    }
    // Le statut de l'enveloppe (started, replay) remplace celui de la tentative : la tentative démarre toujours « en cours ».
    const tentative = { ...(j as unknown as Tentative), status: 'in_progress' as const, replay: j.status === 'replay' };
    return { status: j.status, tentative, cout: j.cost ?? null, solde: j.balance ?? null };
  },
  lireTentative: async (tentativeId) => {
    const res = await getSupabase().rpc('cert_attempt_get', { p_attempt: tentativeId });
    return { ...(verifier(res) as Tentative), replay: false };
  },
  abandonnerTentative: async (tentativeId, raison) => {
    const res = await getSupabase().rpc('cert_attempt_abandon', { p_attempt: tentativeId, p_reason: raison });
    const j = verifier(res) as { status: Tentative['status']; refunded: boolean; balance?: number };
    return { statut: j.status, rembourse: !!j.refunded, solde: j.balance ?? null };
  },
  listerTentatives: async (exam) => {
    const res = await getSupabase()
      .from('cert_mock_attempts')
      .select('id,kind,part,length,status,score_min,score_max,started_at,finished_at,per_part,time_per_part,credits_spent,refunded,questions')
      .eq('exam_code', exam)
      .order('started_at', { ascending: false })
      .limit(50);
    const lignes = verifier(res) as { id: string; kind: Tentative['kind']; part: number | null; length: number; status: Tentative['status']; score_min: number | null; score_max: number | null; started_at: string; finished_at: string | null; per_part: TentativeListee['perPart']; time_per_part: TentativeListee['timePerPart']; credits_spent: number; refunded: boolean; questions: string[] }[];
    return lignes.map((l) => ({
      id: l.id, kind: l.kind, part: l.part, length: l.length, status: l.status, scoreMin: l.score_min, scoreMax: l.score_max,
      startedAt: l.started_at, finishedAt: l.finished_at, perPart: l.per_part, timePerPart: l.time_per_part,
      creditsSpent: l.credits_spent, refunded: l.refunded, questions: l.questions ?? [],
    }));
  },
  lireStats: async (exam, periode, jourLocal) => {
    const res = await getSupabase().rpc('cert_stats_get', { p_period: periode, p_exam: exam, p_today: jourLocal });
    const j = verifier(res) as {
      status: Stats['status']; answers_total?: number;
      score?: { estimated: boolean; score_min: number | null; score_max: number | null };
      bars?: { end: string; score_min: number; score_max: number; mid: number }[]; trend?: Stats['tendance'];
      parts?: { part: number; answered: number; correct: number; rate: number | null; mastery: number; mastery_answers: number; state: string }[];
      time?: { session_minutes: number; reading_minutes: number };
      regularity?: { days_last_7: number; sessions: number; streak: number };
      words?: { to_review: number; in_progress: number; known: number }; generated_at?: string;
    };
    return {
      status: j.status,
      periode,
      reponsesTotal: j.answers_total ?? 0,
      score: j.score ? { estime: !!j.score.estimated, min: j.score.score_min, max: j.score.score_max } : null,
      barres: (j.bars ?? []).map((b) => ({ fin: b.end, min: b.score_min, max: b.score_max, milieu: b.mid })),
      tendance: j.trend ?? null,
      parties: (j.parts ?? []).map((p) => ({ partie: p.part, repondues: p.answered, bonnes: p.correct, taux: p.rate, maitrise: Number(p.mastery), reponsesMaitrise: p.mastery_answers, etat: etatDepuisServeur(p.state) })),
      minutesSeances: j.time?.session_minutes ?? 0,
      minutesLecture: j.time?.reading_minutes ?? 0,
      joursSur7: j.regularity?.days_last_7 ?? 0,
      seances: j.regularity?.sessions ?? 0,
      serieJours: j.regularity?.streak ?? 0,
      mots: { aRevoir: j.words?.to_review ?? 0, enCours: j.words?.in_progress ?? 0, connus: j.words?.known ?? 0 },
      calculeLe: j.generated_at ?? null,
    };
  },
  lireGains: async (exam, jourLocal) => {
    const res = await getSupabase().rpc('cert_earn_status', { p_exam: exam, p_local_day: jourLocal });
    const j = verifier(res) as { cap: number; weekly_total: number; streak: number; items: { code: EtatGains['gains'][number]['code']; amount: number; progress?: number; target?: number; claimed_today?: boolean; claimed?: boolean }[] };
    return {
      plafond: Number(j.cap), gagneSemaine: Number(j.weekly_total), serie: j.streak,
      gains: j.items.map((i) => ({ code: i.code, montant: Number(i.amount), progression: i.progress, cible: i.target, deja: i.claimed_today ?? i.claimed ?? false })),
    };
  },
  reclamerGain: async (code, exam, jourLocal) => {
    const res = await getSupabase().rpc('cert_claim_earn', { p_code: code, p_exam: exam, p_local_day: jourLocal });
    const j = verifier(res) as { status: ResultatGain['status']; amount?: number; weekly_total?: number; cap?: number };
    return { status: j.status, montant: j.amount, gagneSemaine: j.weekly_total, plafond: j.cap };
  },
};

export const apiServeur: CertApi = { ...baseServeur, ...revisionServeur, ...testsServeur };

let courante: CertApi | null = null;

/** Contenu embarqué (essais sur Expo web) : jamais actif en production, voir `demo/`. */
function apiDemoSiDemandee(): CertApi | null {
  // Le `require` est dans le bloc conditionnel : l'export de production replie la condition (`__DEV__` faux) et retire
  // le module et son contenu du paquet. Une sortie anticipée avant le `require` ne suffirait pas.
  if (__DEV__ && process.env.EXPO_PUBLIC_CERT_DEMO === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./demo/apiDemo') as typeof import('./demo/apiDemo')).apiDemo;
  }
  return null;
}

export function obtenirApi(): CertApi {
  return courante ?? apiDemoSiDemandee() ?? apiServeur;
}

/** Pour les tests. */
export function definirApi(api: CertApi | null) {
  courante = api;
}
