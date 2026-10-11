import { lireDemandesSupport, marquerMontree, oublierDemandesMontrees, premiereDemandeNonMontree, repondreDemandeSupport, type DemandeSupport } from '../support';

const demain = new Date(Date.now() + 15 * 60_000).toISOString();
const hier = new Date(Date.now() - 60_000).toISOString();
const demande = (id: string, expires_at = demain): DemandeSupport => ({ id, phone_hint: '0501', created_at: new Date().toISOString(), expires_at });

beforeEach(() => oublierDemandesMontrees());

describe('support : demandes en attente', () => {
  it('lit les demandes du compte par la fonction du serveur', async () => {
    const rpc = jest.fn(async () => ({ data: [demande('a'), demande('b')], error: null }));
    expect(await lireDemandesSupport({ rpc } as never)).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith('support_auth_pending');
  });

  it('erreur, réponse inattendue ou lignes incomplètes : liste vide ou filtrée, jamais d’exception', async () => {
    expect(await lireDemandesSupport({ rpc: async () => ({ data: null, error: { message: 'x' } }) } as never)).toEqual([]);
    expect(await lireDemandesSupport({ rpc: async () => ({ data: 'oups', error: null }) } as never)).toEqual([]);
    expect(await lireDemandesSupport({ rpc: async () => { throw new Error('réseau'); } } as never)).toEqual([]);
    const melange = [demande('ok'), { id: 5 }, null, { id: 'x', phone_hint: '1', expires_at: demain }];
    expect((await lireDemandesSupport({ rpc: async () => ({ data: melange, error: null }) } as never)).map((d) => d.id)).toEqual(['ok', 'x']);
  });

  it('une demande déjà montrée, ou expirée, ne rouvre pas l’écran', () => {
    const liste = [demande('vieille', hier), demande('vue'), demande('neuve')];
    marquerMontree('vue');
    expect(premiereDemandeNonMontree(liste)?.id).toBe('neuve');
    marquerMontree('neuve');
    expect(premiereDemandeNonMontree(liste)).toBeNull();
    expect(premiereDemandeNonMontree([])).toBeNull();
  });
});

describe('support : réponse de l’élève', () => {
  const client = (reponse: { data?: unknown; error?: unknown }) => ({ functions: { invoke: jest.fn(async () => ({ data: null, error: null, ...reponse })) } });

  it('envoie l’accord avec l’identifiant de la demande', async () => {
    const c = client({ data: { status: 'accepted' } });
    expect(await repondreDemandeSupport(c as never, 'abc', true)).toBe('accepted');
    expect(c.functions.invoke).toHaveBeenCalledWith('support-auth-answer', { body: { request_id: 'abc', accept: true } });
  });

  it('refus enregistré', async () => {
    expect(await repondreDemandeSupport(client({ data: { status: 'refused' } }) as never, 'abc', false)).toBe('refused');
  });

  it('demande introuvable ou périmée (404) : expirée', async () => {
    expect(await repondreDemandeSupport(client({ error: { context: { status: 404 } } }) as never, 'abc', true)).toBe('expiree');
  });

  it('autre erreur, réponse inconnue ou exception : erreur, l’élève peut réessayer', async () => {
    expect(await repondreDemandeSupport(client({ error: { context: { status: 500 } } }) as never, 'abc', true)).toBe('erreur');
    expect(await repondreDemandeSupport(client({ data: { status: 'autre' } }) as never, 'abc', true)).toBe('erreur');
    expect(await repondreDemandeSupport({ functions: { invoke: async () => { throw new Error('réseau'); } } } as never, 'abc', true)).toBe('erreur');
  });
});
