import { assurerSessionInvite } from '../session';

const session = { access_token: 'a', user: { id: 'u1', is_anonymous: true } } as never;

function faux(getSession: unknown, signIn: unknown, signOut?: unknown) {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue(getSession),
      signInAnonymously: jest.fn().mockResolvedValue(signIn),
      signOut: jest.fn().mockResolvedValue(signOut ?? { error: null }),
    },
  } as never as Parameters<typeof assurerSessionInvite>[0] & {
    auth: { getSession: jest.Mock; signInAnonymously: jest.Mock; signOut: jest.Mock };
  };
}

describe('assurerSessionInvite', () => {
  it('réutilise la session stockée sans nouvelle connexion', async () => {
    const c = faux({ data: { session }, error: null }, null);
    await expect(assurerSessionInvite(c)).resolves.toBe(session);
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('se connecte en anonyme au premier lancement', async () => {
    const c = faux({ data: { session: null }, error: null }, { data: { session }, error: null });
    await expect(assurerSessionInvite(c)).resolves.toBe(session);
    expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('purge la session et recrée un anonyme si la session stockée est corrompue ou expirée', async () => {
    const c = faux({ data: { session: null }, error: new Error('Refresh token is not valid') }, { data: { session }, error: null });
    await expect(assurerSessionInvite(c)).resolves.toBe(session);
    expect(c.auth.signOut).toHaveBeenCalledTimes(1);
    expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('propage l’erreur de connexion anonyme', async () => {
    const c = faux({ data: { session: null }, error: null }, { data: { session: null }, error: new Error('refus') });
    await expect(assurerSessionInvite(c)).rejects.toThrow('refus');
  });

  it('échoue si aucune session n’est renvoyée', async () => {
    const c = faux({ data: { session: null }, error: null }, { data: { session: null }, error: null });
    await expect(assurerSessionInvite(c)).rejects.toThrow(/session/);
  });
});

