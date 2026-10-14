import { lireCouts, lireReglages, viderCacheCredits } from '../credits';

// Montants lus une seule fois par fenêtre de cache : un lecteur répété ne doit pas réinterroger le serveur.
describe('cache des montants de crédits', () => {
  beforeEach(() => viderCacheCredits());

  it('relit credit_settings une seule fois dans la fenêtre de cache', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { welcome_amount: 40, guest_amount: 5, weekly_amount: 25 }, error: null });
    const from = jest.fn(() => ({ select: () => ({ limit: () => ({ maybeSingle }) }) }));
    const client = { from } as never;

    const premier = await lireReglages(client);
    const second = await lireReglages(client);

    expect(premier).toEqual({ bienvenue: 40, invite: 5, recharge: 25 });
    expect(second).toEqual(premier);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('relit credit_actions une seule fois dans la fenêtre de cache', async () => {
    const select = jest.fn().mockResolvedValue({ data: [{ code: 'ai_question', cost: 5 }], error: null });
    const from = jest.fn(() => ({ select }));
    const client = { from } as never;

    await lireCouts(client);
    const couts = await lireCouts(client);

    expect(couts).toEqual({ ai_question: 5 });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('relit après viderCacheCredits (déconnexion)', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { welcome_amount: 40, guest_amount: 5, weekly_amount: 25 }, error: null });
    const from = jest.fn(() => ({ select: () => ({ limit: () => ({ maybeSingle }) }) }));
    const client = { from } as never;

    await lireReglages(client);
    viderCacheCredits();
    await lireReglages(client);

    expect(from).toHaveBeenCalledTimes(2);
  });
});
