import { planDeFormation } from '../monPlan';
import type { MotCarnetServi, NotionListee } from '../types';

const notion = (id: string, etat: NotionListee['etat'], fiche = true): NotionListee => ({
  id, code: id, titre: `Notion ${id}`, famille: 'grammaire', parties: [5], dureeMin: 3, fiche, reponses: 0, reussies: 0, etat, derniereOuverture: null,
});
const mot = (id: string, boite: MotCarnetServi['boite']): MotCarnetServi => ({
  id, mot: id, categorie: null, definition: 'x', exemple: null, theme: null, audio: null, boite,
  prochaineRevue: '2026-10-22', vus: 0, bons: 0, mauvais: 0,
});

describe('Mon plan : plan de formation tiré des données réelles', () => {
  it('sans date de test, aucun compte à rebours', () => {
    expect(planDeFormation([], [], null, '2026-10-22').joursAvantTest).toBeNull();
  });

  it('compte les jours avant la date de test (positif avant, négatif après)', () => {
    expect(planDeFormation([], [], '2026-11-01', '2026-10-22').joursAvantTest).toBe(10);
    expect(planDeFormation([], [], '2026-10-20', '2026-10-22').joursAvantTest).toBe(-2);
  });

  it('reprend les notions fragiles d\'abord, au plus trois, sans les acquises', () => {
    const plan = planDeFormation([notion('a', 'acquise'), notion('b', 'en_progres'), notion('c', 'fragile'), notion('d', 'fragile'), notion('e', 'fragile')], [], null, '2026-10-22');
    expect(plan.notionsARepasser.map((n) => n.id)).toEqual(['c', 'd', 'e']);
  });

  it('compte les mots à revoir (boîte 1) et les cours à lire (fiche publiée, non acquise)', () => {
    const plan = planDeFormation([notion('a', 'fragile'), notion('b', 'acquise'), notion('c', 'pas_commencee', false)], [mot('m1', 1), mot('m2', 3)], null, '2026-10-22');
    expect(plan.motsARevoir).toBe(1);
    expect(plan.coursAFaire).toBe(1);
  });
});
