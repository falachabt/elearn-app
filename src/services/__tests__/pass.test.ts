import { suivre } from '../analytics';
import { creerLienParent, formaterMontant, lienWhatsApp, lireAcces, lireOffres, URL_PAIEMENT_PARENT } from '../pass';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const ligne = (code: string, montant: number, ordre: number, recommande = false) => ({
  product_code: code,
  amount: montant,
  currency: 'XAF',
  pass_products: { recommended: recommande, sort_order: ordre, duration_days: code === 'contest' ? null : 7, season_ends_on: null },
});

function clientFaux(reponses: { select?: unknown; rpc?: unknown; erreur?: unknown }) {
  const eq = jest.fn(async () => ({ data: reponses.select, error: reponses.erreur ?? null }));
  const select = jest.fn(() => ({ eq }));
  return {
    from: jest.fn(() => ({ select })),
    rpc: jest.fn(async () => ({ data: reponses.rpc, error: reponses.erreur ?? null })),
    eq,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('pass', () => {
  it('lit les offres du pays, triées, avec la recommandée', async () => {
    const c = clientFaux({ select: [ligne('contest', 7500, 3), ligne('week', 500, 1), ligne('month', 2500, 2, true)] });
    const offres = await lireOffres(c as never, 'cm');
    expect(c.eq).toHaveBeenCalledWith('country', 'CM');
    expect(offres.map((o) => o.code)).toEqual(['week', 'month', 'contest']);
    expect(offres.find((o) => o.recommandee)?.code).toBe('month');
  });

  it('lit les offres du serveur, prix converti compris', async () => {
    const serveur = [
      { product_code: 'week', amount: 2000, currency: 'CDF', converted: true, recommended: false, sort_order: 1, duration_days: 7, season_ends_on: null },
      { product_code: 'month', amount: 10000, currency: 'CDF', converted: true, recommended: true, sort_order: 2, duration_days: 30, season_ends_on: null },
    ];
    const c = clientFaux({ rpc: serveur });
    const offres = await lireOffres(c as never, 'cd');
    expect(c.rpc).toHaveBeenCalledWith('pass_offers', { p_country: 'CD' });
    expect(c.from).not.toHaveBeenCalled();
    expect(offres[1]).toEqual({ code: 'month', montant: 10000, devise: 'CDF', recommandee: true, dureeJours: 30, finSaison: null, converti: true });
    expect(formaterMontant(offres[1].montant, offres[1].devise)).toBe('10\u202f000\u00a0CDF');
  });

  it("remonte l'erreur de lecture", async () => {
    await expect(lireOffres(clientFaux({ erreur: new Error('x') }) as never, 'CM')).rejects.toThrow('x');
  });

  it('accès : null si gratuit, sinon offre et fin', async () => {
    expect(await lireAcces(clientFaux({ rpc: [] }) as never)).toBeNull();
    expect(await lireAcces(clientFaux({ rpc: [{ product_code: 'month', ends_at: '2026-11-01T00:00:00Z', source: 'order' }] }) as never)).toEqual({
      offre: 'month',
      fin: '2026-11-01T00:00:00Z',
      source: 'order',
    });
  });

  it('crée le lien parent côté serveur et suit l’événement', async () => {
    const c = clientFaux({ rpc: [{ token: 'abc123', amount: 2500, currency: 'XAF', expires_at: '2026-10-02T10:00:00Z' }] });
    const lien = await creerLienParent(c as never, { offre: 'month', pays: 'CM', prenom: 'Aïcha' });
    expect(c.rpc).toHaveBeenCalledWith('create_parent_payment_link', { p_product: 'month', p_country: 'CM', p_student_name: 'Aïcha' });
    expect(lien.url).toBe(`${URL_PAIEMENT_PARENT}abc123`);
    expect(suivre).toHaveBeenCalledWith('parent_link_created', { offre: 'month', montant: 2500 });
  });

  it('lien parent : erreur si rien n’est renvoyé', async () => {
    await expect(creerLienParent(clientFaux({ rpc: [] }) as never, { offre: 'week', pays: 'CM' })).rejects.toThrow();
  });

  it('formate les montants en FCFA avec espaces insécables', () => {
    expect(formaterMontant(2500, 'XAF')).toBe('2\u202f500\u00a0FCFA');
    expect(formaterMontant(20000, 'XOF')).toBe('20\u202f000\u00a0FCFA');
    expect(formaterMontant(500, 'EUR')).toBe('500\u00a0EUR');
  });

  it('lien WhatsApp encodé sans destinataire', () => {
    expect(lienWhatsApp('Payer ici : https://x/p/a?b')).toBe('https://wa.me/?text=Payer%20ici%20%3A%20https%3A%2F%2Fx%2Fp%2Fa%3Fb');
  });
});
