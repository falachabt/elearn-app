import { ErreurPaiement, lireMethodes, payerMobileMoney, suivreCommande } from '../paiementPass';

jest.mock('expo-updates', () => ({ channel: 'production' }));
jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const reponse = (corps: unknown, ok = true) => ({ ok, json: async () => corps }) as Response;
const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'jeton-eleve' } } }) } } as never;
const sansSession = { auth: { getSession: async () => ({ data: { session: null } }) } } as never;

// __DEV__ est lu à l'appel : hors développement, les appels vont en production (sandbox=false).
beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

describe('paiement du pass (back-office)', () => {
  it('méthodes : pays, prix dans la devise, opérateurs avec logo', async () => {
    const appel = jest.fn(async (..._a: unknown[]) => reponse({ payable: true, country: 'SN', countryName: 'Sénégal', prefix: '221', currency: 'XOF', offers: [{ code: 'week', amount: 500, currency: 'XOF', converted: false, recommended: false, durationDays: 7 }], providers: [{ provider: 'ORANGE_SEN', name: 'Orange Money', logo: 'https://x/o.png', currency: 'XOF', min: 100, max: 1500000, authType: 'PREAUTH', pinPrompt: 'MANUAL', delayed: false }] }));
    const m = await lireMethodes('sn', 'fr', appel as never);
    expect(appel.mock.calls[0][0]).toContain('/api/pass/pawapay/methods?country=SN&locale=fr&sandbox=false');
    expect(m.payable).toBe(true);
    expect(m.providers[0].logo).toBe('https://x/o.png');
    expect(m.offers[0].currency).toBe('XOF');
  });

  it('pays sans pawaPay : payable faux, aucune offre inventée', async () => {
    const m = await lireMethodes('FR', 'en', (async () => reponse({ payable: false, country: 'FR', offers: [], providers: [] })) as never);
    expect(m.payable).toBe(false);
    expect(m.providers).toEqual([]);
  });

  it('payer : jeton de l’élève, offre, pays, numéro, opérateur et langue envoyés au serveur', async () => {
    const appel = jest.fn(async () => reponse({ order_id: 'c1', status: 'en_attente', authType: 'PROVIDER_AUTH', pinPrompt: 'AUTOMATIC' }));
    const r = await payerMobileMoney(client, { offre: 'month', pays: 'CM', telephone: '6 53 45 67 89', operateur: 'MTN_MOMO_CMR', langue: 'fr' }, appel as never);
    const [url, init] = appel.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://staff.elearnprepa.com/api/pass/pawapay/pay');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-eleve');
    expect(JSON.parse(init.body as string)).toMatchObject({ product: 'month', country: 'CM', phone: '6 53 45 67 89', provider: 'MTN_MOMO_CMR', locale: 'fr', sandbox: false });
    expect(r).toMatchObject({ statut: 'en_attente', commande: 'c1' });
  });

  it('refus de pawaPay : le message du serveur remonte', async () => {
    const appel = async () => reponse({ code: 'refuse', failure: 'INSUFFICIENT_BALANCE', message: 'Solde insuffisant', order_id: 'c2' }, false);
    await expect(payerMobileMoney(client, { offre: 'week', pays: 'CM', telephone: '653456789', operateur: 'MTN_MOMO_CMR', langue: 'fr' }, appel as never)).rejects.toMatchObject({ code: 'refuse', message: 'Solde insuffisant', echec: 'INSUFFICIENT_BALANCE' });
  });

  it('sans session : refus avant tout appel réseau', async () => {
    const appel = jest.fn();
    await expect(payerMobileMoney(sansSession, { offre: 'week', pays: 'CM', telephone: '653456789', operateur: 'X', langue: 'fr' }, appel as never)).rejects.toBeInstanceOf(ErreurPaiement);
    expect(appel).not.toHaveBeenCalled();
  });

  it('réseau coupé : erreur « reseau »', async () => {
    const appel = async () => {
      throw new Error('offline');
    };
    await expect(lireMethodes('CM', 'fr', appel as never)).rejects.toMatchObject({ code: 'reseau' });
  });

  it('suivi : attend, puis s’arrête au succès ; une panne passagère ne l’interrompt pas', async () => {
    const etats = [reponse({}, false), reponse({ order_id: 'c1', status: 'en_attente' }), reponse({ order_id: 'c1', status: 'reussi', receipt_no: 'EP-1' })];
    const appel = jest.fn(async () => etats.shift() as Response);
    const vus: string[] = [];
    const r = await suivreCommande(client, 'c1', 'fr', { appel: appel as never, attendre: async () => {}, surStatut: (x) => vus.push(x.statut) });
    expect(r).toMatchObject({ statut: 'reussi', recu: 'EP-1' });
    expect(vus).toEqual(['en_attente', 'reussi']);
  });

  it('suivi : s’arrête quand l’élève abandonne', async () => {
    const arret = { annule: false };
    const appel = jest.fn(async () => {
      arret.annule = true;
      return reponse({ order_id: 'c1', status: 'en_attente' });
    });
    const r = await suivreCommande(client, 'c1', 'fr', { appel: appel as never, attendre: async () => {}, arret });
    expect(r.statut).toBe('en_attente');
    expect(appel).toHaveBeenCalledTimes(1);
  });
});
