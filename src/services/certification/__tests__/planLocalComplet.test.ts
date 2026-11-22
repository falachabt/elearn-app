import { planLocalComplet } from '../monPlan';
import type { NotionListee } from '../types';

const notion = (i: number, etat: NotionListee['etat'] = 'pas_commencee'): NotionListee => ({
  id: `n${i}`,
  code: `C${String(i).padStart(2, '0')}`,
  titre: `Notion ${i}`,
  famille: 'grammar' as NotionListee['famille'],
  parties: [5],
  dureeMin: 10,
  fiche: true,
  reponses: 0,
  reussies: 0,
  etat,
  derniereOuverture: null,
});

const T = { mini: 'Mini', demi: 'Demi', mixte: 'Mixte', complet: 'Complet', quiz: 'Quiz' };

describe('planLocalComplet', () => {
  const aujourdhui = '2026-11-19';

  it('répartit chaque notion non acquise jusqu’à la veille du test', () => {
    const notions = Array.from({ length: 10 }, (_, i) => notion(i));
    const plan = planLocalComplet(notions, '2026-11-24', aujourdhui, T);
    expect(plan).not.toBeNull();
    const total = plan!.jours.reduce((s, j) => s + j.etapes.length, 0);
    expect(total).toBeGreaterThan(10);
    expect(plan!.jours[0]!.jour).toBe(aujourdhui);
    expect(plan!.jours.at(-1)!.jour < '2026-11-24').toBe(true);
    expect(plan!.local).toBe(true);
  });

  it('ignore les notions acquises', () => {
    const notions = [notion(1, 'acquise'), notion(2), notion(3, 'fragile')];
    const plan = planLocalComplet(notions, '2026-11-30', aujourdhui, T);
    const titres = plan!.jours.flatMap((j) => j.etapes.map((e) => e.titre));
    expect(titres).toEqual(expect.arrayContaining(['Notion 2', 'Notion 3']));
    expect(titres).not.toContain('Notion 1');
    expect(plan!.jours.flatMap((j) => j.etapes).find((e) => e.titre === 'Notion 3')!.type).toBe('rappel');
  });

  it('rend null sans date de test future ou sans notion à placer', () => {
    expect(planLocalComplet([notion(1)], null, aujourdhui, T)).toBeNull();
    expect(planLocalComplet([notion(1)], aujourdhui, aujourdhui, T)).toBeNull();
    expect(planLocalComplet([notion(1, 'acquise')], '2026-12-30', aujourdhui, T)).toBeNull();
  });
});
