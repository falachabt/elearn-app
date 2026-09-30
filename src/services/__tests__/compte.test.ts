import { suivre } from '../analytics';
import {
  ErreurCompte,
  cleErreur,
  connecterApple,
  connecterEmail,
  connecterFacebook,
  connecterGoogle,
  creerCompteEmail,
  deconnecter,
  lireRetourOAuth,
  validerCodeParrainage,
  validerEmail,
  validerMotDePasse,
} from '../compte';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const invite = { access_token: 'a', user: { id: 'u1', is_anonymous: true } };
const membre = { access_token: 'b', user: { id: 'u2', is_anonymous: false, email: 'a@b.cc' } };

function faux(session: unknown = invite, surcharges: Record<string, jest.Mock> = {}) {
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    updateUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    signUp: jest.fn().mockResolvedValue({ data: { session: membre, user: membre.user }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session: membre }, error: null }),
    signInAnonymously: jest.fn().mockResolvedValue({ data: { session: invite }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    linkIdentity: jest.fn().mockResolvedValue({ data: { url: 'https://auth/x' }, error: null }),
    signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: 'https://auth/y' }, error: null }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
    setSession: jest.fn().mockResolvedValue({ error: null }),
    signInWithIdToken: jest.fn().mockResolvedValue({ error: null }),
    ...surcharges,
  };
  return { auth } as never as Parameters<typeof creerCompteEmail>[0] & { auth: typeof auth };
}

beforeEach(() => jest.clearAllMocks());

describe('validation', () => {
  it('e-mail', () => {
    expect(validerEmail('')).toBe('compte.erreurs.emailVide');
    expect(validerEmail('amina@')).toBe('compte.erreurs.emailInvalide');
    expect(validerEmail(' amina@exemple.com ')).toBeNull();
  });
  it('mot de passe', () => {
    expect(validerMotDePasse('')).toBe('compte.erreurs.motDePasseVide');
    expect(validerMotDePasse('1234567')).toBe('compte.erreurs.motDePasseCourt');
    expect(validerMotDePasse('12345678')).toBeNull();
  });
  it('code de parrainage facultatif mais bien formé', () => {
    expect(validerCodeParrainage('')).toBeNull();
    expect(validerCodeParrainage('abc123')).toBeNull();
    expect(validerCodeParrainage('a;b')).toBe('compte.erreurs.codeInvalide');
  });
});

describe('cleErreur', () => {
  it.each([
    [{ code: 'user_already_exists' }, 'compte.erreurs.emailDejaUtilise'],
    [{ code: 'email_exists' }, 'compte.erreurs.emailDejaUtilise'],
    [{ message: 'User already registered' }, 'compte.erreurs.emailDejaUtilise'],
    [{ code: 'invalid_credentials' }, 'compte.erreurs.identifiants'],
    [{ code: 'weak_password' }, 'compte.erreurs.motDePasseCourt'],
    [{ status: 429 }, 'compte.erreurs.tropDeTentatives'],
    [{ code: 'email_not_confirmed' }, 'compte.erreurs.emailNonConfirme'],
    [{ code: 'manual_linking_disabled' }, 'compte.erreurs.methodeIndisponible'],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'compte.erreurs.reseau'],
    [new ErreurCompte('compte.erreurs.annule'), 'compte.erreurs.annule'],
    [new Error('boum technique'), 'compte.erreurs.inconnue'],
    [null, 'compte.erreurs.inconnue'],
  ])('%j -> %s', (e, cle) => expect(cleErreur(e)).toBe(cle));
});

describe('creerCompteEmail', () => {
  it('convertit l’invité avec updateUser (même utilisateur) et envoie le code de parrainage en metadata', async () => {
    const c = faux();
    const r = await creerCompteEmail(c, { email: ' amina@exemple.com ', motDePasse: 'motdepasse1', codeParrainage: 'abc123' });
    expect(r).toEqual({ etat: 'cree', conversionInvite: true });
    expect(c.auth.updateUser).toHaveBeenCalledWith({ email: 'amina@exemple.com', password: 'motdepasse1', data: { referral_code: 'ABC123' } });
    expect(c.auth.signUp).not.toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('compte_cree', { methode: 'email', conversion_invite: true, avec_parrainage: true });
  });

  it('sans code : pas de metadata', async () => {
    const c = faux();
    await creerCompteEmail(c, { email: 'a@b.cc', motDePasse: 'motdepasse1', codeParrainage: '' });
    expect(c.auth.updateUser).toHaveBeenCalledWith({ email: 'a@b.cc', password: 'motdepasse1' });
  });

  it('signale l’attente de confirmation e-mail (new_email) en gardant la conversion', async () => {
    const c = faux(invite, { updateUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', new_email: 'a@b.cc' } }, error: null }) });
    await expect(creerCompteEmail(c, { email: 'a@b.cc', motDePasse: 'motdepasse1' })).resolves.toEqual({ etat: 'confirmation', conversionInvite: true });
  });

  it('sans session invité : inscription classique signUp avec le code', async () => {
    const c = faux(null);
    const r = await creerCompteEmail(c, { email: 'a@b.cc', motDePasse: 'motdepasse1', codeParrainage: 'xyz789' });
    expect(r).toEqual({ etat: 'cree', conversionInvite: false });
    expect(c.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.cc', password: 'motdepasse1', options: { data: { referral_code: 'XYZ789' } } });
  });

  it('propage l’erreur Supabase (e-mail déjà pris)', async () => {
    const c = faux(invite, { updateUser: jest.fn().mockResolvedValue({ data: {}, error: { code: 'email_exists', message: 'x' } }) });
    await expect(creerCompteEmail(c, { email: 'a@b.cc', motDePasse: 'motdepasse1' })).rejects.toMatchObject({ code: 'email_exists' });
    expect(suivre).not.toHaveBeenCalled();
  });
});

describe('connexion et déconnexion', () => {
  it('connecterEmail renvoie la session', async () => {
    const c = faux();
    await expect(connecterEmail(c, { email: ' a@b.cc ', motDePasse: 'x' })).resolves.toBe(membre);
    expect(c.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.cc', password: 'x' });
  });

  it('identifiants refusés : l’erreur remonte', async () => {
    const c = faux(invite, { signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: { code: 'invalid_credentials' } }) });
    await expect(connecterEmail(c, { email: 'a@b.cc', motDePasse: 'x' })).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('déconnecter ouvre aussitôt une nouvelle session invité', async () => {
    const c = faux(null);
    await deconnecter(c);
    expect(c.auth.signOut).toHaveBeenCalled();
    expect(c.auth.signInAnonymously).toHaveBeenCalled();
  });
});

describe('Google', () => {
  const deps = (retour: { type: string; url?: string }) => ({ urlRedirection: 'elearnprepa://auth/callback', ouvrirNavigateur: jest.fn().mockResolvedValue(retour) });

  it('invité : linkIdentity (garde la progression), échange du code PKCE, puis code de parrainage', async () => {
    const c = faux();
    const d = deps({ type: 'success', url: 'elearnprepa://auth/callback?code=pkce1' });
    await connecterGoogle(c, d, 'abc123');
    expect(c.auth.linkIdentity).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'elearnprepa://auth/callback', skipBrowserRedirect: true } });
    expect(c.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(d.ouvrirNavigateur).toHaveBeenCalledWith('https://auth/x', 'elearnprepa://auth/callback');
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce1');
    expect(c.auth.updateUser).toHaveBeenCalledWith({ data: { referral_code: 'ABC123' } });
  });

  it('non invité : signInWithOAuth et jetons du fragment (flux implicite)', async () => {
    const c = faux(null);
    await connecterGoogle(c, deps({ type: 'success', url: 'elearnprepa://auth/callback#access_token=A&refresh_token=R' }));
    expect(c.auth.signInWithOAuth).toHaveBeenCalled();
    expect(c.auth.setSession).toHaveBeenCalledWith({ access_token: 'A', refresh_token: 'R' });
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });

  it('navigateur fermé ou retour en erreur : message « annulé »', async () => {
    await expect(connecterGoogle(faux(), deps({ type: 'cancel' }))).rejects.toMatchObject({ cle: 'compte.erreurs.annule' });
    await expect(connecterGoogle(faux(), deps({ type: 'success', url: 'elearnprepa://auth/callback?error=access_denied' }))).rejects.toMatchObject({ cle: 'compte.erreurs.annule' });
  });

  it('Facebook : même flux OAuth avec le fournisseur facebook (invité rattaché, non invité connecté)', async () => {
    const c = faux();
    await connecterFacebook(c, deps({ type: 'success', url: 'elearnprepa://auth/callback?code=fb1' }), 'abc123');
    expect(c.auth.linkIdentity).toHaveBeenCalledWith({ provider: 'facebook', options: { redirectTo: 'elearnprepa://auth/callback', skipBrowserRedirect: true } });
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledWith('fb1');
    expect(c.auth.updateUser).toHaveBeenCalledWith({ data: { referral_code: 'ABC123' } });
    const d = faux(null);
    await connecterFacebook(d, deps({ type: 'success', url: 'elearnprepa://auth/callback?code=fb2' }));
    expect(d.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'facebook', options: { redirectTo: 'elearnprepa://auth/callback', skipBrowserRedirect: true } });
    await expect(connecterFacebook(faux(), deps({ type: 'cancel' }))).rejects.toMatchObject({ cle: 'compte.erreurs.annule' });
  });

  it('lireRetourOAuth', () => {
    expect(lireRetourOAuth('x://cb?code=1')).toMatchObject({ code: '1', accessToken: null });
    expect(lireRetourOAuth('x://cb#access_token=a&refresh_token=b')).toMatchObject({ accessToken: 'a', refreshToken: 'b' });
  });
});

describe('Apple', () => {
  const deps = (over = {}) => ({ disponible: jest.fn().mockResolvedValue(true), demander: jest.fn().mockResolvedValue({ identityToken: 'jwt', nonce: 'n1' }), ...over });

  it('échange le jeton d’identité et le nonce brut', async () => {
    const c = faux(null);
    await connecterApple(c, deps());
    expect(c.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'jwt', nonce: 'n1' });
  });

  it('indisponible (Android, web) : message dédié, aucun appel Supabase', async () => {
    const c = faux(null);
    await expect(connecterApple(c, deps({ disponible: jest.fn().mockResolvedValue(false) }))).rejects.toMatchObject({ cle: 'compte.erreurs.appleIndisponible' });
    expect(c.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('annulation par l’utilisateur', async () => {
    const c = faux(null);
    await expect(connecterApple(c, deps({ demander: jest.fn().mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' }) }))).rejects.toMatchObject({ cle: 'compte.erreurs.annule' });
  });
});
