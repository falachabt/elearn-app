import { finirRetourOAuthWeb } from '../retourOAuthWeb';

const mockLireCode = jest.fn();
const mockEffacer = jest.fn();
jest.mock('../parrainage', () => ({
  ...jest.requireActual('../parrainage'),
  lireCodeValide: (...a: unknown[]) => mockLireCode(...a),
  effacerCode: (...a: unknown[]) => mockEffacer(...a),
}));

const client = (over: { exchange?: unknown; set?: unknown; rpc?: unknown } = {}) => ({
  auth: {
    exchangeCodeForSession: jest.fn(async () => over.exchange ?? { error: null }),
    setSession: jest.fn(async () => over.set ?? { error: null }),
  },
  rpc: jest.fn(async () => over.rpc ?? { data: { ok: true }, error: null }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLireCode.mockResolvedValue(null);
  mockEffacer.mockResolvedValue(undefined);
});

describe('retour de la connexion Google en page entière (web)', () => {
  it('une page ordinaire n’est pas un retour OAuth : rien n’est touché', async () => {
    const c = client();
    expect(await finirRetourOAuthWeb(c as never, 'https://app.elearnprepa.com/moi')).toBe('rien');
    expect(await finirRetourOAuthWeb(c as never, null)).toBe('rien');
    expect(c.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('?code= (PKCE) : la session est installée, quelle que soit la route d’arrivée (racine comprise)', async () => {
    const c = client();
    expect(await finirRetourOAuthWeb(c as never, 'https://app.elearnprepa.com/?code=abc123')).toBe('session');
    expect(await finirRetourOAuthWeb(c as never, 'https://app.elearnprepa.com/auth/callback?code=def456')).toBe('session');
    expect(c.auth.exchangeCodeForSession).toHaveBeenNthCalledWith(1, 'abc123');
    expect(c.auth.exchangeCodeForSession).toHaveBeenNthCalledWith(2, 'def456');
  });

  it('#access_token= (flux implicite) : setSession', async () => {
    const c = client();
    expect(await finirRetourOAuthWeb(c as never, 'https://app.elearnprepa.com/auth/callback#access_token=a&refresh_token=r')).toBe('session');
    expect(c.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('refus du fournisseur ou échec de l’échange : erreur, l’élève reste invité', async () => {
    expect(await finirRetourOAuthWeb(client() as never, 'https://app.elearnprepa.com/?error=access_denied')).toBe('erreur');
    expect(await finirRetourOAuthWeb(client({ exchange: { error: new Error('bad verifier') } }) as never, 'https://app.elearnprepa.com/?code=x')).toBe('erreur');
    const leve = client();
    leve.auth.exchangeCodeForSession.mockRejectedValueOnce(new Error('réseau'));
    expect(await finirRetourOAuthWeb(leve as never, 'https://app.elearnprepa.com/?code=x')).toBe('erreur');
  });

  it('le code de parrainage gardé avant le départ est rattaché au compte puis effacé', async () => {
    mockLireCode.mockResolvedValue('ABCD123');
    const c = client();
    expect(await finirRetourOAuthWeb(c as never, 'https://app.elearnprepa.com/?code=abc')).toBe('session');
    expect(c.rpc).toHaveBeenCalledWith('apply_referral_on_signup', { p_code: 'ABCD123' });
    expect(mockEffacer).toHaveBeenCalled();
  });
});
