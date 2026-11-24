import { obtenirApi } from './api';
import { compteursCarnet } from './revision';
import type { EtapePlan, JourPlan, PlanFrise } from './planFrise';
import { jourPlus, joursAvantTest, type Jour } from './jours';
import type { MotCarnetServi, NotionListee } from './types';

/** Notions à reprendre en premier : fragiles, puis en progrès (au plus trois affichées). */
const NOTIONS_A_REPRENDRE = 3;

export type PlanFormation = {
  /** Jours avant la date de test, `null` sans date (aucun compte à rebours n'est affiché). */
  joursAvantTest: number | null;
  /** Mots du carnet à revoir (boîte 1 : ratés récemment). */
  motsARevoir: number;
  /** Notions fragiles ou en progrès, la plus fragile d'abord. */
  notionsARepasser: NotionListee[];
  /** Nombre de cours à lire (notions avec une fiche publiée et pas encore acquises). */
  coursAFaire: number;
};

const RANG: Record<NotionListee['etat'], number> = { fragile: 0, en_progres: 1, pas_commencee: 2, acquise: 3 };

/**
 * Mon plan (v32) : ce qui revient cette semaine, tiré des données réelles (carnet, notions, date de test).
 * Les temps verbaux ne sont pas encore mesurés par l'application : ils n'apparaissent pas tant que la donnée manque.
 */
export function planDeFormation(notions: NotionListee[], carnet: MotCarnetServi[], dateTest: Jour | null, aujourdhui: Jour): PlanFormation {
  const aRepasser = notions
    .filter((n) => n.etat === 'fragile' || n.etat === 'en_progres')
    .sort((a, b) => RANG[a.etat] - RANG[b.etat] || a.titre.localeCompare(b.titre));
  const aFaire = notions.filter((n) => n.fiche && n.etat !== 'acquise').length;
  return {
    joursAvantTest: joursAvantTest(dateTest, aujourdhui),
    motsARevoir: compteursCarnet(carnet).a_revoir,
    notionsARepasser: aRepasser.slice(0, NOTIONS_A_REPRENDRE),
    coursAFaire: aFaire,
  };
}

/**
 * Repli local de la frise : le plan n'existe côté serveur qu'une fois construit. On n'invente aucun calendrier : seul
 * « Aujourd'hui » est rempli, avec ce que les données de l'appareil disent de la journée (mots à revoir, notions fragiles,
 * mini-test).
 */
export function planFriseLocale(plan: PlanFormation, dateTest: Jour | null, aujourdhui: Jour, titres: { mots: string; mini: string }): PlanFrise {
  const etapes: EtapePlan[] = [];
  const ajouter = (e: Omit<EtapePlan, 'id' | 'position' | 'etat' | 'faitLe' | 'detail'>) =>
    etapes.push({ id: `local-${etapes.length}`, position: etapes.length, etat: 'a_faire', faitLe: null, detail: null, ...e });
  if (plan.motsARevoir > 0) ajouter({ type: 'rappel', uniteKind: 'words', uniteId: null, titre: titres.mots, minutes: null });
  for (const n of plan.notionsARepasser) ajouter({ type: 'rappel', uniteKind: 'notion', uniteId: n.id, titre: n.titre, minutes: n.dureeMin });
  ajouter({ type: 'mini_test', uniteKind: null, uniteId: null, titre: titres.mini, minutes: null });
  return {
    dateExamen: dateTest,
    couverture: null,
    jours: [{ jour: aujourdhui, minutes: etapes.reduce((s, e) => s + (e.minutes ?? 0), 0), jourTest: false, etapes }],
    local: true,
  };
}

/** Titres des étapes de test (libellés déjà traduits par l'appelant). */
export type TitresEtapes = { mini: string; demi: string; mixte: string; complet: string; quiz: string; pratique: string };

/**
 * Motif d'une semaine (7 jours à partir d'aujourd'hui), sans répétition d'un jour à l'autre :
 * 0 leçons avec leur quiz, 1 demi-test seul, 2 mini-tests et révision, 3 leçons et demi-test, 4 repos,
 * 5 trois mini-tests, 6 test complet. Les tests alternent demi-test écrit et test mixte.
 */
const MOTIF_SEMAINE = 7;
const LECONS_PAR_JOUR = 3;

/**
 * Plan complet calculé sur l'appareil quand le serveur n'a rien à servir : chaque jour jusqu'à la veille du test suit
 * le motif de la semaine, avec les notions non acquises en leçons (chacune suivie de son quiz) et des tests en rotation.
 * `null` sans date de test future.
 */
export function planLocalComplet(notions: NotionListee[], dateTest: Jour | null, aujourdhui: Jour, titres: TitresEtapes): PlanFrise | null {
  const jours = dateTest ? joursAvantTest(dateTest, aujourdhui) : null;
  if (!dateTest || jours === null || jours < 1) return null;
  const file = notions
    .filter((n) => n.etat !== 'acquise')
    .sort((a, b) => a.famille.localeCompare(b.famille) || a.code.localeCompare(b.code));
  if (file.length === 0) return null;
  const aRevoir = notions.filter((n) => n.etat === 'fragile' || n.etat === 'en_progres');
  let k = 0;
  let semaineTest = 0;
  const journees: JourPlan[] = [];
  for (let i = 0; i < jours; i++) {
    const jour = jourPlus(aujourdhui, i);
    const etapes: EtapePlan[] = [];
    const ajouter = (e: Omit<EtapePlan, 'id' | 'position' | 'etat' | 'faitLe' | 'detail'>) =>
      etapes.push({ id: `local-${k++}`, position: etapes.length, etat: 'a_faire', faitLe: null, detail: null, ...e });
    const lecons = (n: number) => {
      for (const notion of file.splice(0, n)) {
        ajouter({ type: aRevoir.includes(notion) ? 'rappel' : 'decouverte', uniteKind: 'notion', uniteId: notion.id, titre: notion.titre, minutes: notion.dureeMin });
        ajouter({ type: 'quiz_lecon', uniteKind: 'notion', uniteId: notion.id, titre: `${titres.quiz} · ${notion.titre}`, minutes: null });
        // Chaque leçon est suivie de sa pratique : s'entraîner sur cette notion précise.
        ajouter({ type: 'pratique', uniteKind: 'notion', uniteId: notion.id, titre: `${titres.pratique} · ${notion.titre}`, minutes: null });
      }
    };
    const testMoyen = () => {
      const mixte = semaineTest % 2 === 1;
      semaineTest++;
      ajouter({ type: mixte ? 'test_mixte' : 'demi_test', uniteKind: null, uniteId: null, titre: mixte ? titres.mixte : titres.demi, minutes: null });
    };
    if (i === 0) ajouter({ type: 'mini_test', uniteKind: null, uniteId: null, titre: titres.mini, minutes: null });
    switch (i % MOTIF_SEMAINE) {
      case 0:
        lecons(LECONS_PAR_JOUR);
        break;
      case 1:
        testMoyen();
        break;
      case 2:
        ajouter({ type: 'mini_test', uniteKind: null, uniteId: null, titre: titres.mini, minutes: null });
        ajouter({ type: 'mini_test', uniteKind: null, uniteId: null, titre: titres.mini, minutes: null });
        break;
      case 3:
        lecons(LECONS_PAR_JOUR);
        testMoyen();
        break;
      case 4:
        break;
      case 5:
        for (let m = 0; m < 3; m++) ajouter({ type: 'mini_test', uniteKind: null, uniteId: null, titre: titres.mini, minutes: null });
        break;
      default:
        ajouter({ type: 'test_complet', uniteKind: null, uniteId: null, titre: titres.complet, minutes: null });
    }
    if (etapes.length > 0) journees.push({ jour, minutes: etapes.reduce((s, e) => s + (e.minutes ?? 0), 0), jourTest: false, etapes });
  }
  if (journees.length === 0) return null;
  return { dateExamen: dateTest, couverture: null, jours: journees, local: true };
}

/** Plan servi (construit au besoin), sinon le repli local : un échec réseau ou un plan vide ne casse jamais l'écran. */
export async function chargerPlanFrise(exam: string, repli: () => PlanFrise | Promise<PlanFrise>): Promise<PlanFrise> {
  const api = obtenirApi();
  try {
    const lu = (await api.lirePlanFormation(exam)) ?? (await api.construirePlanFormation(exam));
    if (lu) return lu;
  } catch {
    // le plan local prend le relais
  }
  return repli();
}
