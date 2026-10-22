import { apiDemo } from '../demo/apiDemo';

// Demi-tests et test complet côté démo : même répartition que la production (100 écoute, 100 lecture), replay idempotent.
describe('demi-tests et test complet (démo)', () => {
  it('liste le test démo avec 100 questions en écoute et 100 en lecture', async () => {
    const tests = await apiDemo.listerTests('toeic');
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({ listening: 100, reading: 100, total: 200 });
  });

  it('demi-test écoute : 100 questions, parties 1 à 4 seulement', async () => {
    const r = await apiDemo.demarrerTest('00000000-0000-4000-8000-00000000e001', 'demo-test', 'half_listening', 'toeic', '2030-06-01');
    expect(r.status).toBe('started');
    expect(r.tentative?.questions).toHaveLength(100);
    expect(r.tentative?.questions.every((q) => q.part >= 1 && q.part <= 4)).toBe(true);
    expect(r.tentative?.kind).toBe('half_listening');
  });

  it('demi-test lecture : 100 questions, parties 5 à 7', async () => {
    const r = await apiDemo.demarrerTest('00000000-0000-4000-8000-00000000e002', 'demo-test', 'half_reading', 'toeic', '2030-06-01');
    expect(r.tentative?.questions).toHaveLength(100);
    expect(r.tentative?.questions.every((q) => q.part >= 5 && q.part <= 7)).toBe(true);
  });

  it('même client_uuid : replay, aucune nouvelle tentative', async () => {
    const uuid = '00000000-0000-4000-8000-00000000e003';
    const premier = await apiDemo.demarrerTest(uuid, 'demo-test', 'full', 'toeic', '2030-06-01');
    const rejeu = await apiDemo.demarrerTest(uuid, 'demo-test', 'full', 'toeic', '2030-06-01');
    expect(premier.tentative?.questions).toHaveLength(200);
    expect(rejeu.status).toBe('replay');
    expect(rejeu.tentative?.attempt_id).toBe(premier.tentative?.attempt_id);
  });
});
