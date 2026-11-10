import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Retour terrain du 23 octobre 2026 : jeton d'accès expiré (connexion du matin, expiration 1 h) puis démarrage
  // à froid en mode avion — getSession échoue au rafraîchissement et l'ancienne logique faisait signOut, ce qui
  // effaçait la session de l'appareil : l'app repartait sans identité (« hors-ligne ») et toutes les copies
  // locales rangées sous l'identifiant du compte (planning, coches, XP) devenaient invisibles.
  describe('démarrage hors ligne avec une session stockée expirée', () => {
    const CLE_STOCKAGE = 'sb-test-auth-token';
    const sessionStockee = {
      access_token: 'expiré',
      refresh_token: 'jeton-rafraichissement',
      expires_at: 1,
      user: { id: 'u-reel', is_anonymous: false },
    };
    const erreurReseau = Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' });

    function fauxComplet(getSession: unknown, signIn: unknown) {
      return {
        auth: {
          storageKey: CLE_STOCKAGE,
          getSession: jest.fn().mockResolvedValue(getSession),
          signInAnonymously: jest.fn().mockResolvedValue(signIn),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      } as never as Parameters<typeof assurerSessionInvite>[0] & {
        auth: { getSession: jest.Mock; signInAnonymously: jest.Mock; signOut: jest.Mock };
      };
    }

    it('sert la session stockée quand le rafraîchissement échoue faute de réseau, sans signOut ni anonyme', async () => {
      await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(sessionStockee));
      const c = fauxComplet({ data: { session: null }, error: erreurReseau }, { data: { session: null }, error: new Error('réseau') });
      const servie = await assurerSessionInvite(c);
      expect(servie.user.id).toBe('u-reel');
      expect(c.auth.signOut).not.toHaveBeenCalled();
      expect(c.auth.signInAnonymously).not.toHaveBeenCalled();
    });

    it('sans session stockée, une erreur réseau laisse la voie à la connexion anonyme', async () => {
      const c = fauxComplet({ data: { session: null }, error: erreurReseau }, { data: { session }, error: null });
      await expect(assurerSessionInvite(c)).resolves.toBe(session);
      expect(c.auth.signOut).not.toHaveBeenCalled();
      expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('une erreur qui n’est pas le réseau (jeton vraiment invalide) garde la réinitialisation par signOut', async () => {
      await AsyncStorage.setItem(CLE_STOCKAGE, JSON.stringify(sessionStockee));
      const erreurInvalide = Object.assign(new Error('Invalid Refresh Token: Refresh Token Not Found'), { name: 'AuthApiError' });
      const c = fauxComplet({ data: { session: null }, error: erreurInvalide }, { data: { session }, error: null });
      await expect(assurerSessionInvite(c)).resolves.toBe(session);
      expect(c.auth.signOut).toHaveBeenCalledTimes(1);
      expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });
  });
});
