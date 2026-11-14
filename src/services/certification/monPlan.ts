import { obtenirApi } from './api';
import { compteursCarnet } from './revision';
import type { EtapePlan, PlanFrise } from './planFrise';
import { joursAvantTest, type Jour } from './jours';
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
