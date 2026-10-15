import type { Jour } from './jours';

/** Examen proposé (A2) : tout vient de `cert_exams`, jamais du code. */
export type Examen = {
  code: string;
  name: string;
  subtitle: string | null;
  duration_min: number;
  question_count: number;
  goal_steps: number[];
  sec_per_question: { listening: number; reading: number };
};

/** Un document de la partie 6 ou 7 (e-mail, annonce, article…). */
export type DocumentPassage = { kind?: string; head?: string; text: string };

export type GroupeServi = {
  id: string;
  audio_path: string | null;
  image_path: string | null;
  image_alt: string | null;
  passage: { docs: DocumentPassage[]; multi?: boolean } | null;
};

/** Question servie : jamais la bonne réponse, le piège ni la transcription (révélés après la réponse). */
export type QuestionServie = {
  id: string;
  part: number;
  type: string;
  number: number | null;
  stem: string;
  options: string[];
  group: GroupeServi | null;
};

export type Contexte = 'diagnostic' | 'series' | 'replay' | 'test' | 'session';

/** Réponse envoyée au serveur ; `chosen: null` = question passée (compte comme fausse). */
export type ReponseEnvoyee = {
  question_id: string;
  client_uuid: string;
  chosen: number | null;
  ms: number;
  context: Contexte;
  local_day: Jour;
  attempt_id?: string;
};

export type NotionLiee = { id: string; code: string; title: string; family: 'grammaire' | 'vocabulaire' | 'piege' | 'methode' };

export type ResultatReponse = {
  question_id: string;
  client_uuid: string;
  correct: boolean;
  skipped: boolean;
  correct_index: number;
  trap: string | null;
  notion: NotionLiee | null;
  notions: NotionLiee[];
  transcript: unknown;
  replay: boolean;
};

export type Tentative = {
  attempt_id: string;
  kind: 'diagnostic' | 'mini' | 'half_listening' | 'half_reading' | 'full';
  part: number | null;
  length: number;
  status: 'in_progress' | 'finished' | 'abandoned' | 'refunded';
  started_at: string;
  credits_spent: number;
  questions: QuestionServie[];
  replay: boolean;
};

export type FinTentative = {
  status: 'finished';
  attempt_id: string;
  kind: Tentative['kind'];
  estimated: boolean;
  score: number | null;
  score_min: number | null;
  score_max: number | null;
  per_part: Record<string, { answered: number; correct: number }>;
  results: ResultatReponse[];
  replay: boolean;
};

export type PlanEleve = {
  exam: string;
  pays: string;
  objectif: number | null;
  dateTest: Jour | null;
  minutes: number | null;
};

export type MotsARevoir = { total: number; theme: string | null };
