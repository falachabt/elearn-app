import { ErreurChariow, ouvrirPaiementChariow } from '../chariow';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));

type Reponse = { data?: unknown; error?: unknown };

/** Faux client Supabase : seul `functions.invoke` est utilisé par le service. */
const client = (reponse: Reponse) => {
  const invoke = jest.fn().mockResolvedValue(reponse);
  return { invoke, client: { functions: { invoke } } as never };
};

/** Erreur telle que la renvoie supabase-js : un `context` qui est la Response. */
const erreur = (statut: number, message = 'refus') => ({
  context: { status: statut, json: async () => ({ message }) },
});

const demande = { offre: 'month' as const, pays: 'fr', telephone: '6 12 34 56 78' };

describe('paiement Chariow', () => {
  it('ouvre la page de paiement et renvoie la commande', async () => {
    const { invoke, client: c } = client({ data: { commande: 'cmd-1', url: 'https://payment.chariow.com/x', montant: 2500, devise: 'XAF' } });
    const r = await ouvrirPaiementChariow(c, demande);
    expect(r).toEqual({ commande: 'cmd-1', url: 'https://payment.chariow.com/x', montant: 2500, devise: 'XAF', repris: undefined });
    expect(invoke).toHaveBeenCalledWith('chariow-checkout', {
      body: { product: 'month', country: 'FR', phone: '6 12 34 56 78', first_name: undefined, last_name: undefined, indicatif: undefined },
    });
  });

  it('le pays part en majuscules, jamais en minuscules', async () => {
    const { invoke, client: c } = client({ data: { commande: 'cmd-1', url: 'https://x' } });
    await ouvrirPaiementChariow(c, { ...demande, pays: 'cm' });
    expect(invoke.mock.calls[0][1].body.country).toBe('CM');
  });

  it('un pays sans prix : indisponible, message du serveur conservé', async () => {
    const { client: c } = client({ error: erreur(422, 'produit Chariow non configuré') });
    await expect(ouvrirPaiementChariow(c, demande)).rejects.toMatchObject({ code: 'indisponible', message: 'produit Chariow non configuré' });
  });

  it('sans session : auth ; serveur mal configuré : configuration', async () => {
    await expect(ouvrirPaiementChariow(client({ error: erreur(401) }).client, demande)).rejects.toMatchObject({ code: 'auth' });
    await expect(ouvrirPaiementChariow(client({ error: erreur(500) }).client, demande)).rejects.toMatchObject({ code: 'configuration' });
  });

  it('une coupure réseau ne fait jamais remonter autre chose que reseau', async () => {
    const invoke = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(ouvrirPaiementChariow({ functions: { invoke } } as never, demande)).rejects.toBeInstanceOf(ErreurChariow);
    await expect(ouvrirPaiementChariow({ functions: { invoke } } as never, demande)).rejects.toMatchObject({ code: 'reseau' });
  });

  it('une réponse sans adresse de paiement est refusée', async () => {
    await expect(ouvrirPaiementChariow(client({ data: { commande: 'cmd-1' } }).client, demande)).rejects.toMatchObject({ code: 'indisponible' });
    await expect(ouvrirPaiementChariow(client({ data: null }).client, demande)).rejects.toMatchObject({ code: 'indisponible' });
  });
});
