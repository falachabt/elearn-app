import { assurerSessionInvite } from '../session';

const session = { access_token: 'a', user: { id: 'u1', is_anonymous: true } } as never;

function faux(getSession: unknown, signIn: unknown) {
  return { auth: { getSession: jest.fn().mockResolvedValue(getSession), signInAnonymously: jest.fn().mockResolvedValue(signIn) } } as never as Parameters<typeof assurerSessionInvite>[0] & {
    auth: { getSession: jest.Mock; signInAnonymously: jest.Mock };
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

  it('propage l’erreur de connexion anonyme', async () => {
    const c = faux({ data: { session: null }, error: null }, { data: { session: null }, error: new Error('refus') });
    await expect(assurerSessionInvite(c)).rejects.toThrow('refus');
  });

  it('échoue si aucune session n’est renvoyée', async () => {
    const c = faux({ data: { session: null }, error: null }, { data: { session: null }, error: null });
    await expect(assurerSessionInvite(c)).rejects.toThrow(/session/);
  });
});
