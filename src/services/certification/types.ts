import type { EtatMaitrise } from './certMaitrise';
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

/** Mot clé d'une question, ajoutable au carnet depuis le corrigé (B9). */
export type MotCle = { id: string; word: string };

export type ResultatReponse = {
  question_id: string;
  client_uuid: string;
  correct: boolean;
  skipped: boolean;
  correct_index: number;
  trap: string | null;
  notion: NotionLiee | null;
  notions: NotionLiee[];
  words?: MotCle[];
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

/** Famille d'une notion (C4) : les quatre onglets de la liste des cours. */
export type FamilleNotion = NotionLiee['family'];

/** Notion avec son état de maîtrise (F3), servie par `cert_notions_list` (C3, C4). Les décomptes sont bruts. */
export type NotionListee = {
  id: string;
  code: string;
  titre: string;
  famille: FamilleNotion;
  parties: number[];
  dureeMin: number | null;
  /** Vrai quand une fiche publiée existe : sans fiche, la notion n'apparaît pas dans la liste des cours (AC-C4-2). */
  fiche: boolean;
  reponses: number;
  reussies: number;
  etat: EtatMaitrise;
  derniereOuverture: string | null;
};

/** Maîtrise d'une partie (F4), barre de la carte de maîtrise (C2). */
export type PartieMaitrise = { partie: number; reponses: number; m: number; etat: EtatMaitrise };

export type Revision = { notions: NotionListee[]; parties: PartieMaitrise[] };

/** Un mot du carnet (C6, C7, C8) avec sa boîte (F5). */
export type MotCarnetServi = {
  id: string;
  mot: string;
  categorie: string | null;
  definition: string;
  exemple: string | null;
  theme: string | null;
  audio: string | null;
  boite: 1 | 2 | 3 | 4;
  prochaineRevue: Jour;
  vus: number;
  bons: number;
  mauvais: number;
};

/** Fiche d'une notion (C5) : texte de cours et trois questions d'ancrage. */
export type NotionFiche = {
  id: string;
  code: string;
  famille: FamilleNotion;
  titre: string;
  parties: number[];
  markdown: string | null;
  dureeMin: number | null;
  ancrages: QuestionServie[];
};

/** Bloc de la séance du jour (F7), tel que composé par `cert_session_compose`. */
export type BlocServi =
  | { type: 'cours'; notionId: string; titre: string; minutes: number; erreurs: number }
  | { type: 'mots'; nombre: number; echus: number }
  | { type: 'rejeu'; nombre: number; partie: number | null }
  | { type: 'serie'; partie: number; nombre: number };

export type SeanceServie = {
  minutes: number;
  blocs: BlocServi[];
  pourquoi: { erreurs: number; notion: string | null; motsEchus: number };
};

/** Résultat d'une carte de la séance de mots, rejoué tel quel s'il n'est pas parti (idempotent par `clientUuid`). */
export type ResultatMot = { wordId: string; clientUuid: string; connu: boolean; jour: Jour };
