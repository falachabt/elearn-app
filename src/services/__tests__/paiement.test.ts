import { suivre } from '../analytics';
import { annulerPaiement, ErreurPaiement, lireRecus, lireStatutPaiement, paiementEnCours, payerPass, suivrePaiement } from '../paiement';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const ok = (corps: unknown) => ({ data: corps, error: null });
const refus = (corps: unknown) => ({ data: null, error: { context: { json: async () => corps } } });

function client(reponses: { invoke?: jest.Mock; rpc?: unknown; select?: unknown }) {
  const limit = jest.fn(async () => ({ data: reponses.select, error: null }));
  const chaine: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'in']) chaine[m] = jest.fn(() => chaine);
  chaine.order = jest.fn(() => ({ ...chaine, limit, then: (r: (v: unknown) => void) => r({ data: reponses.select, error: null }) }));
  return {
    functions: { invoke: reponses.invoke ?? jest.fn() },
    rpc: jest.fn(async () => ({ data: reponses.rpc, error: null })),
    from: jest.fn(() => chaine),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('payerPass', () => {
  it('envoie offre, pays et numéro ; le montant revient du serveur', async () => {
    const invoke = jest.fn(async () => ok({ status: 'en_attente', order_id: 'c1', mode: 'sandbox', amount: 2500, currency: 'XAF', expires_at: 'x' }));
    const r = await payerPass(client({ invoke }) as never, { offre: 'month', pays: 'CM', telephone: '677123456' });
    expect(invoke).toHaveBeenCalledWith('payment-start', { body: { product: 'month', country: 'CM', phone: '677123456', operateur: undefined } });
    expect(r).toMatchObject({ statut: 'en_attente', commande: 'c1', montant: 2500, devise: 'XAF', mode: 'sandbox' });
    expect(suivre).toHaveBeenCalledWith('payment_initiated', expect.objectContaining({ offre: 'month' }));
  });

  it('rend le motif quand pawaPay refuse le dépôt', async () => {
    const invoke = jest.fn(async () => ok({ status: 'echoue', order_id: 'c1', motif: 'solde' }));
    expect((await payerPass(client({ invoke }) as never, { offre: 'week', pays: 'CM', telephone: '677123456' })).motif).toBe('solde');
  });

  it.each(['numero', 'operateur', 'offre', 'auth'] as const)('transmet le refus « %s » du serveur', async (code) => {
    const invoke = jest.fn(async () => refus({ code }));
    await expect(payerPass(client({ invoke }) as never, { offre: 'week', pays: 'CM', telephone: '1' })).rejects.toMatchObject({ code });
  });

  it('erreur réseau : indisponible, sans rien supposer du prélèvement', async () => {
    const invoke = jest.fn(async () => ({ data: null, error: new Error('réseau') }));
    await expect(payerPass(client({ invoke }) as never, { offre: 'week', pays: 'CM', telephone: '677123456' })).rejects.toBeInstanceOf(ErreurPaiement);
    expect(suivre).not.toHaveBeenCalled();
  });
});

describe('suivrePaiement', () => {
  const attendre = jest.fn(async () => {});

  it('interroge jusqu\'au succès et rend le reçu', async () => {
    const invoke = jest.fn()
      .mockResolvedValueOnce(ok({ status: 'en_attente', order_id: 'c1' }))
      .mockResolvedValueOnce(ok({ status: 'en_attente', order_id: 'c1' }))
      .mockResolvedValueOnce(ok({ status: 'reussi', order_id: 'c1', receipt_no: 'EP-AAAA-0001' }));
    const vus: string[] = [];
    const r = await suivrePaiement(client({ invoke }) as never, 'c1', { attendre, surStatut: (x) => vus.push(x.statut) });
    expect(r).toMatchObject({ statut: 'reussi', recu: 'EP-AAAA-0001' });
    expect(vus).toEqual(['en_attente', 'en_attente', 'reussi']);
  });

  it('une erreur réseau passagère ne casse pas le suivi', async () => {
    const invoke = jest.fn()
      .mockResolvedValueOnce({ data: null, error: new Error('réseau') })
      .mockResolvedValueOnce(ok({ status: 'echoue', order_id: 'c1', motif: 'refus' }));
    expect((await suivrePaiement(client({ invoke }) as never, 'c1', { attendre })).motif).toBe('refus');
  });

  it('s\'arrête après la durée maximale en rendant « en attente »', async () => {
    const invoke = jest.fn(async () => ok({ status: 'en_attente', order_id: 'c1' }));
    const r = await suivrePaiement(client({ invoke }) as never, 'c1', { attendre, intervalle: 1000, duree: 3000 });
    expect(r.statut).toBe('en_attente');
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('s\'arrête quand l\'écran demande l\'arrêt', async () => {
    const invoke = jest.fn(async () => ok({ status: 'en_attente', order_id: 'c1' }));
    const arret = { annule: false };
    await suivrePaiement(client({ invoke }) as never, 'c1', { attendre: async () => { arret.annule = true; }, arret });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('session perdue : l\'erreur remonte', async () => {
    const invoke = jest.fn(async () => refus({ code: 'auth' }));
    await expect(suivrePaiement(client({ invoke }) as never, 'c1', { attendre })).rejects.toMatchObject({ code: 'auth' });
  });
});

describe('autres appels', () => {
  it('lit le statut d\'une commande', async () => {
    const invoke = jest.fn(async () => ok({ status: 'expire', order_id: 'c9' }));
    expect(await lireStatutPaiement(client({ invoke }) as never, 'c9')).toMatchObject({ statut: 'expire' });
  });

  it('annule : un paiement déjà réussi reste réussi', async () => {
    expect(await annulerPaiement(client({ rpc: 'cancelled' }) as never, 'c1')).toBe('echoue');
    expect(await annulerPaiement(client({ rpc: 'succeeded' }) as never, 'c1')).toBe('reussi');
  });

  it('retrouve le paiement en attente à la réouverture', async () => {
    const r = await paiementEnCours(client({ select: [{ id: 'c1', expires_at: '2026-10-02T10:10:00Z' }] }) as never);
    expect(r).toEqual({ statut: 'en_attente', commande: 'c1', expire: '2026-10-02T10:10:00Z' });
    expect(await paiementEnCours(client({ select: [] }) as never)).toBeNull();
  });

  it('liste les reçus', async () => {
    const recus = await lireRecus(client({ select: [{ id: 'c1', product_code: 'month', amount: 2500, currency: 'XAF', msisdn_masked: '677 •• •• 56', paid_at: 'd', receipt_no: 'EP-1' }] }) as never);
    expect(recus).toEqual([{ commande: 'c1', offre: 'month', montant: 2500, devise: 'XAF', numero: '677 •• •• 56', payeLe: 'd', recu: 'EP-1' }]);
  });
});
