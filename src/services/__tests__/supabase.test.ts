import { forcerConnexion } from '../connectivite';
import { estErreurReseau } from '../connectivite';
import { ConfigSupabaseManquante, getSupabase, reinitialiserClientPourTests } from '../supabase';

afterEach(() => {
  forcerConnexion(null);
  reinitialiserClientPourTests();
});

describe('getSupabase', () => {
  it('échoue avec un message clair si la configuration manque', () => {
    expect(() => getSupabase({})).toThrow(ConfigSupabaseManquante);
    expect(() => getSupabase({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(() => getSupabase({ url: 'https://exemple.supabase.co' })).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('crée le client une seule fois quand la configuration est présente', () => {
    const config = { url: 'https://exemple.supabase.co', cle: 'cle-de-test' };
    expect(getSupabase(config)).toBe(getSupabase(config));
  });
});

describe('simulation hors ligne : coupure réelle des lectures', () => {
  const config = { url: 'https://exemple.supabase.co', cle: 'cle-de-test' };

  async function erreurDe(fn: () => PromiseLike<unknown>): Promise<unknown> {
    try {
      await fn();
      return null;
    } catch (e) {
      return e;
    }
  }

  it('hors ligne forcé : rpc et from lèvent une erreur réseau reconnue', async () => {
    const client = getSupabase(config);
    forcerConnexion(false);

    const erreurRpc = await erreurDe(() => client.rpc('peu_importe', {}));
    expect(estErreurReseau(erreurRpc)).toBe(true);
    const erreurFrom = await erreurDe(() => client.from('table').select('*'));
    expect(estErreurReseau(erreurFrom)).toBe(true);
  });

  it('l’authentification reste possible même hors ligne forcé', async () => {
    const client = getSupabase(config);
    forcerConnexion(false);
    // `auth` n'est pas intercepté : on ne déconnecte pas l'élève pendant un test.
    expect(() => client.auth.getSession()).not.toThrow();
  });

  it('retour à l’état réel : plus aucune interception', async () => {
    const client = getSupabase(config);
    forcerConnexion(false);
    forcerConnexion(null);

    // Sans interception, la requête part réellement et échoue pour une autre raison (pas de serveur) :
    // on vérifie seulement que ce n'est plus notre erreur simulée.
    const erreur = await erreurDe(() => client.rpc('peu_importe', {}));
    expect(String((erreur as Error)?.message ?? '')).not.toContain('simulation hors ligne');
  });
});
