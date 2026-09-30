import { ConfigSupabaseManquante, getSupabase, reinitialiserClientPourTests } from './supabase';

afterEach(() => reinitialiserClientPourTests());

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
