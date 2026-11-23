import { jourPlus, lundiDe, type Jour } from './jours';

/**
 * Plan de formation servi par `cert_plan_get(p_exam)` (cahier v1.32, D-42 à D-44) : une frise de jours, chacun avec ses
 * étapes. Ici, la forme utilisée par les écrans et la lecture tolérante de la réponse du serveur.
 */
export type TypeEtape = 'decouverte' | 'rappel' | 'pratique' | 'quiz_lecon' | 'mini_test' | 'demi_test' | 'test_mixte' | 'test_complet';
export type EtatEtape = 'a_faire' | 'en_cours' | 'fait' | 'reportee' | 'ratee';

export type EtapePlan = {
  id: string;
  position: number;
  type: TypeEtape;
  /** Nature de l'unité visée (notion, piège, méthode, mots, partie…) et son identifiant ; null pour un test. */
  uniteKind: string | null;
  uniteId: string | null;
  titre: string;
  /** Précision lue du contenu (famille, partie…), déjà rédigée par le serveur. */
  detail: string | null;
  minutes: number | null;
  etat: EtatEtape;
  /** Jour de réalisation (AAAA-MM-JJ) pour une étape faite. */
  faitLe: Jour | null;
};

export type JourPlan = { jour: Jour; minutes: number; jourTest: boolean; etapes: EtapePlan[] };

export type CouverturePlan = {
  unites: number;
  vues: number;
  validees: number;
  maitrisees: number;
  /** Part du contenu couverte avant l'examen ; null quand le serveur ne la donne pas. */
  pourcent: number | null;
};

export type PlanFrise = {
  dateExamen: Jour | null;
  couverture: CouverturePlan | null;
  jours: JourPlan[];
  /** Vrai quand le plan vient du calcul local (le serveur n'en a pas encore construit). */
  local: boolean;
};

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : null);
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const jourValide = (v: unknown): Jour | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

const TYPES: Record<string, TypeEtape> = {
  discover: 'decouverte', discovery: 'decouverte', decouverte: 'decouverte', new: 'decouverte',
  recall: 'rappel', review: 'rappel', replay: 'rappel', rappel: 'rappel',
  practice: 'pratique', pratique: 'pratique', quiz: 'pratique',
  mini_test: 'mini_test', mini: 'mini_test',
  full_test: 'test_complet', full: 'test_complet', test_complet: 'test_complet', test: 'test_complet',
};
const ETATS: Record<string, EtatEtape> = {
  todo: 'a_faire', pending: 'a_faire', planned: 'a_faire', a_faire: 'a_faire',
  doing: 'en_cours', in_progress: 'en_cours', started: 'en_cours', en_cours: 'en_cours',
  done: 'fait', completed: 'fait', fait: 'fait',
  postponed: 'reportee', carried: 'reportee', carried_over: 'reportee', reportee: 'reportee',
  failed: 'ratee', missed: 'ratee', ratee: 'ratee',
};

function etape(b: Brut, indice: number): EtapePlan | null {
  const titre = texte(b.title) ?? texte(b.titre);
  if (!titre) return null;
  // Forme réelle de `cert_plan_get` (migration cert_plan_items) : une ligne par notion {day, position, notion_id, title,
  // family, done}. Les autres noms restent lus pour une enveloppe plus riche si le serveur la sert un jour.
  const uniteId = b.unit_id ?? b.notion_id;
  return {
    id: String(b.id ?? uniteId ?? `e${indice}`),
    position: nombre(b.position) ?? indice,
    type: TYPES[String(b.kind ?? b.type ?? '')] ?? 'decouverte',
    uniteKind: texte(b.unit_kind) ?? (b.notion_id ? 'notion' : null),
    uniteId: uniteId === null || uniteId === undefined ? null : String(uniteId),
    titre,
    detail: texte(b.detail) ?? texte(b.subtitle) ?? texte(b.family),
    minutes: nombre(b.minutes),
    etat: b.done === true ? 'fait' : (ETATS[String(b.state ?? b.etat ?? '')] ?? 'a_faire'),
    faitLe: jourValide(b.done_at ?? b.done_on),
  };
}

function jours(brut: unknown[]): JourPlan[] {
  const parJour = new Map<Jour, { etapes: EtapePlan[]; test: boolean; minutes: number | null }>();
  const ajouter = (jour: Jour, e: EtapePlan[], test: boolean, minutes: number | null) => {
    const avant = parJour.get(jour) ?? { etapes: [], test: false, minutes: null };
    parJour.set(jour, { etapes: [...avant.etapes, ...e], test: avant.test || test, minutes: minutes ?? avant.minutes });
  };
  brut.forEach((entree, i) => {
    const j = objet(entree);
    if (!j) return;
    const jour = jourValide(j.day ?? j.jour);
    if (!jour) return;
    if (Array.isArray(j.steps)) {
      ajouter(jour, (j.steps as unknown[]).map((s, k) => etape(objet(s) ?? {}, k)).filter((e): e is EtapePlan => e !== null), j.test_day === true, nombre(j.minutes));
    } else {
      // Forme à plat : une ligne par étape.
      const e = etape(j, i);
      if (e) ajouter(jour, [e], false, null);
    }
  });
  return [...parJour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([jour, v]) => {
      const etapes = [...v.etapes].sort((a, b) => a.position - b.position);
      const somme = etapes.reduce((s, e) => s + (e.minutes ?? 0), 0);
      return { jour, minutes: v.minutes ?? somme, jourTest: v.test, etapes };
    });
}

/**
 * Lit la réponse de `cert_plan_get` ; `null` quand le plan n'existe pas encore (rien de construit, aucun jour) : l'appelant
 * appelle alors `cert_plan_build` ou garde le calcul local.
 */
export function lirePlanServeur(brut: unknown): PlanFrise | null {
  if (brut === null || brut === undefined) return null;
  const racine = objet(brut);
  const liste = Array.isArray(brut) ? brut : Array.isArray(racine?.days) ? (racine!.days as unknown[]) : null;
  if (!liste) return null;
  const j = jours(liste);
  if (j.length === 0) return null;
  const c = objet(racine?.coverage);
  const couverture: CouverturePlan | null = c
    ? {
        unites: nombre(c.units) ?? 0,
        vues: nombre(c.seen) ?? 0,
        validees: nombre(c.validated) ?? 0,
        maitrisees: nombre(c.mastered) ?? 0,
        pourcent: nombre(c.planned_pct ?? c.pct),
      }
    : null;
  return { dateExamen: jourValide(racine?.exam_date), couverture, jours: j, local: false };
}

// Organisation de la frise ---------------------------------------------------------------------------------------

export type SemainePlan = { lundi: Jour; jours: JourPlan[] };

export type FriseOrganisee = {
  aujourdhui: JourPlan;
  demain: JourPlan | null;
  /** Jours de test de la semaine en cours (hors aujourd'hui et demain), marqués sur la frise. */
  tests: JourPlan[];
  /** Le reste de la semaine en cours, replié sous « Les jours suivants ». */
  suivants: JourPlan[];
  /** Les semaines suivantes, repliées. */
  semaines: SemainePlan[];
};

/** Jour de test : le serveur le dit, ou une étape de test complet y est prévue. */
export const estJourTest = (j: JourPlan): boolean => j.jourTest || j.etapes.some((e) => e.type === 'test_complet');

/** Aujourd'hui ouvert, demain, puis la semaine en cours, puis les semaines suivantes (jamais les jours passés). */
export function organiserFrise(plan: PlanFrise, aujourdhui: Jour): FriseOrganisee {
  const demain = jourPlus(aujourdhui, 1);
  const lundi = lundiDe(aujourdhui);
  const fin = jourPlus(lundi, 6);
  const futurs = plan.jours.filter((j) => j.jour >= aujourdhui);
  const du = (jour: Jour) => futurs.find((j) => j.jour === jour) ?? null;
  const reste = futurs.filter((j) => j.jour > demain);
  const semaine = reste.filter((j) => j.jour <= fin);
  const tests = semaine.filter(estJourTest);
  const semaines = new Map<Jour, JourPlan[]>();
  for (const j of reste.filter((x) => x.jour > fin)) semaines.set(lundiDe(j.jour), [...(semaines.get(lundiDe(j.jour)) ?? []), j]);
  return {
    aujourdhui: du(aujourdhui) ?? { jour: aujourdhui, minutes: 0, jourTest: false, etapes: [] },
    demain: du(demain),
    tests,
    suivants: semaine.filter((j) => !tests.includes(j)),
    semaines: [...semaines.entries()].map(([l, js]) => ({ lundi: l, jours: js })),
  };
}

/** Étape à lancer : celle en cours, sinon la première pas faite d'aujourd'hui. */
export function etapeACommencer(jour: JourPlan): EtapePlan | null {
  return jour.etapes.find((e) => e.etat === 'en_cours') ?? jour.etapes.find((e) => e.etat !== 'fait') ?? null;
}

/** Destination d'une étape : ouvre l'unité (notion, mots, série) ou l'épreuve prévue. */
export function routeEtape(e: EtapePlan): { pathname: string; params?: Record<string, string> } | string {
  if (e.type === 'mini_test') return '/certification/mini';
  // Tests de la banque (cert_test_list_get) : la liste numérotée du type, le test conseillé en tête.
  if (e.type === 'demi_test') return { pathname: '/certification/liste-tests', params: { kind: 'reading' } };
  if (e.type === 'test_mixte') return { pathname: '/certification/liste-tests', params: { kind: 'mixed' } };
  if (e.type === 'test_complet') return { pathname: '/certification/liste-tests', params: { kind: 'full' } };
  if (e.uniteKind === 'words' || e.uniteKind === 'word_list' || e.uniteKind === 'vocabulary') {
    return { pathname: '/certification/mots-seance', params: { origine: 'carnet' } };
  }
  if (e.uniteKind === 'part' && e.uniteId) return { pathname: '/certification/serie', params: { part: e.uniteId } };
  if (e.uniteKind === 'replay' || (e.type === 'rappel' && !e.uniteId)) return { pathname: '/certification/serie', params: { rejeu: '1' } };
  if (e.uniteId) {
    return e.type === 'pratique'
      ? { pathname: '/certification/serie', params: { notion: e.uniteId } }
      : { pathname: '/certification/notion/[id]', params: { id: e.uniteId, source: 'liste' } };
  }
  return '/certification/seance';
}
