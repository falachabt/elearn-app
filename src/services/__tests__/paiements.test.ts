import { lirePaiement, lirePaiements } from '../paiements';

const ligne = {
  id: 'commande-1',
  product_code: 'month',
  country: 'CM',
  currency: 'XAF',
  amount: 2500,
  status: 'succeeded',
  channel: 'app',
  provider: 'MTN_MOMO_CMR',
  provider_ref: 'commande-1',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:02:00Z',
  failure_code: null,
  expires_at: '2026-10-01T10:10:00Z',
  msisdn_masked: '6******789',
  sandbox: false,
  receipt_no: 'EP-ABCD-1234',
  paid_at: '2026-10-01T10:02:00Z',
  refunded_at: null,
  refund_reason: null,
};

function clientFaux({ data = [ligne], error = null }: { data?: unknown; error?: unknown } = {}) {
  const order = jest.fn(async () => ({ data, error }));
  const maybeSingle = jest.fn(async () => ({ data: Array.isArray(data) ? data[0] : data, error }));
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ order, eq }));
  return { from: jest.fn(() => ({ select })), select, order, eq, maybeSingle };
}

describe('historique des paiements', () => {
  it('lit et transforme la liste des commandes de l’élève', async () => {
    const c = clientFaux();

    await expect(lirePaiements(c as never)).resolves.toEqual([
      {
        id: 'commande-1',
        offre: 'month',
        pays: 'CM',
        devise: 'XAF',
        montant: 2500,
        statut: 'succeeded',
        canal: 'app',
        operateur: 'MTN_MOMO_CMR',
        referenceFournisseur: 'commande-1',
        creeLe: '2026-10-01T10:00:00Z',
        misAJourLe: '2026-10-01T10:02:00Z',
        motifEchec: null,
        expireLe: '2026-10-01T10:10:00Z',
        numeroMasque: '6******789',
        sandbox: false,
        recu: 'EP-ABCD-1234',
        payeLe: '2026-10-01T10:02:00Z',
        rembourseLe: null,
        motifRemboursement: null,
      },
    ]);
    expect(c.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('lit un paiement par son identifiant', async () => {
    const c = clientFaux();
    const paiement = await lirePaiement(c as never, 'commande-1');

    expect(c.eq).toHaveBeenCalledWith('id', 'commande-1');
    expect(c.maybeSingle).toHaveBeenCalledTimes(1);
    expect(paiement).toMatchObject({ id: 'commande-1', offre: 'month', recu: 'EP-ABCD-1234' });
  });

  it('remonte les erreurs Supabase', async () => {
    const erreur = new Error('réseau');
    await expect(lirePaiements(clientFaux({ error: erreur }) as never)).rejects.toThrow('réseau');
  });
});
