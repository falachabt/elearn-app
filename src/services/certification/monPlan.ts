import { compteursCarnet } from './revision';
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
