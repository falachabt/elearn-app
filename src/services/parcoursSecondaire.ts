import {
  elementFait,
  seanceDe,
  seanceTerminee,
  type AcquisesEntrainement,
  type ElementSeance,
  type JourPlanning,
  type LeconsValidees,
  type Planning,
} from './planning';

/** Un quiz est validé à 80 % de bonnes réponses, comme le Parcours du profil TOEIC (4 justes sur 5). En dessous : « à refaire ». */
export const SEUIL_VALIDATION_QUIZ = 80;

export type EtatEtapeParcours = 'fait' | 'courante' | 'a_faire' | 'ratee' | 'apercu';

export type EtapeParcours = {
  /** Clé stable : jour + position dans la séance. */
  id: string;
  jour: string;
  element: ElementSeance;
  etat: EtatEtapeParcours;
  /** Rang dans la timeline (aujourd'hui puis aperçu) ; `null` pour les étapes passées à refaire. */
  rang: number | null;
  /** Meilleur score (en %) d'un quiz non validé. */
  score?: number;
};

export type GroupeParcours = { jour: string; type: 'passe' | 'aujourdhui' | 'apercu'; etapes: EtapeParcours[] };

export type Parcours = {
  groupes: GroupeParcours[];
  /** Étape que le bouton du bas lance : la première non faite d'aujourd'hui, sinon la première à refaire, sinon la prochaine. */
  courante: EtapeParcours | null;
  faitsAujourdhui: number;
  totalAujourdhui: number;
  aRefaire: number;
};

const JOURS_PASSES_MAX = 3;
const JOURS_APERCU_MAX = 14;

function etatElement(e: ElementSeance, lues: LeconsValidees, acquises: AcquisesEntrainement, seanceFaite: boolean): { etat: 'fait' | 'ratee' | 'a_faire'; score?: number } {
  if (e.genre === 'quiz') {
    const cle = String(e.quizId);
    const score = acquises.scores?.[cle] ?? acquises.scores?.[cle.toLowerCase()];
    if (score !== undefined) return score >= SEUIL_VALIDATION_QUIZ ? { etat: 'fait' } : { etat: 'ratee', score };
    return { etat: seanceFaite ? 'fait' : 'a_faire' };
  }
  if (elementFait(e, lues, acquises) || seanceFaite) return { etat: 'fait' };
  return { etat: 'a_faire' };
}

/**
 * Timeline du Parcours (Réviser, onglet Parcours) : les jours passés qui ont encore des étapes à refaire, les étapes
 * d'aujourd'hui numérotées, puis l'aperçu des prochains jours. Pur : tout vient du planning serveur et des progressions locales.
 */
export function construireParcours(planning: Planning, aujourdhui: string, lues: LeconsValidees = {}, acquises: AcquisesEntrainement = {}): Parcours {
  const jours: JourPlanning[] = planning.semaines.flatMap((s) => s.jours).filter((j) => j.elements.length > 0);
  const groupes: GroupeParcours[] = [];

  const passes = jours.filter((j) => j.jour < aujourdhui);
  const passesARefaire: GroupeParcours[] = [];
  for (const j of passes) {
    const etapes: EtapeParcours[] = [];
    j.elements.forEach((element, i) => {
      const { etat, score } = etatElement(element, lues, acquises, j.fait);
      if (etat === 'fait') return;
      etapes.push({ id: `${j.jour}-${i}`, jour: j.jour, element, etat: 'ratee', rang: null, score });
    });
    if (etapes.length) passesARefaire.push({ jour: j.jour, type: 'passe', etapes });
  }
  groupes.push(...passesARefaire.slice(-JOURS_PASSES_MAX));

  let rang = 1;
  const aujourdhuiJour = seanceDe(planning, aujourdhui);
  let faitsAujourdhui = 0;
  let totalAujourdhui = 0;
  if (aujourdhuiJour && aujourdhuiJour.elements.length) {
    const termine = seanceTerminee(aujourdhuiJour, lues, acquises);
    let couranteVue = false;
    const etapes: EtapeParcours[] = aujourdhuiJour.elements.map((element, i) => {
      const { etat: brut, score } = etatElement(element, lues, acquises, aujourdhuiJour.fait);
      let etat: EtatEtapeParcours = brut === 'ratee' ? 'ratee' : brut;
      if (etat !== 'fait' && !couranteVue && !termine) {
        etat = 'courante';
        couranteVue = true;
      }
      if (etat === 'fait') faitsAujourdhui += 1;
      return { id: `${aujourdhuiJour.jour}-${i}`, jour: aujourdhuiJour.jour, element, etat, rang: rang++, score };
    });
    totalAujourdhui = etapes.length;
    groupes.push({ jour: aujourdhuiJour.jour, type: 'aujourdhui', etapes });
  }

  const suivants = jours.filter((j) => j.jour > aujourdhui).slice(0, JOURS_APERCU_MAX);
  for (const j of suivants) {
    groupes.push({
      jour: j.jour,
      type: 'apercu',
      etapes: j.elements.map((element, i) => ({ id: `${j.jour}-${i}`, jour: j.jour, element, etat: 'apercu' as const, rang: rang++ })),
    });
  }

  const toutes = groupes.flatMap((g) => g.etapes);
  const aRefaire = toutes.filter((e) => e.etat === 'ratee').length;
  const courante =
    toutes.find((e) => e.etat === 'courante') ?? toutes.find((e) => e.etat === 'ratee') ?? toutes.find((e) => e.etat === 'apercu') ?? null;

  return { groupes, courante, faitsAujourdhui, totalAujourdhui, aRefaire };
}
