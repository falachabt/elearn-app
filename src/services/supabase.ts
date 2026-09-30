import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Levée quand la configuration Supabase est absente : message clair, jamais au build. */
export class ConfigSupabaseManquante extends Error {
  constructor(variables: string[]) {
    super(
      `Configuration Supabase manquante : ${variables.join(', ')}. ` +
        'Copiez .env.example vers .env.local et renseignez ces variables.',
    );
    this.name = 'ConfigSupabaseManquante';
  }
}

let client: SupabaseClient | null = null;

type Config = { url?: string; cle?: string };

function configDepuisEnv(): Config {
  // Accès statiques obligatoires : Expo remplace EXPO_PUBLIC_* au build.
  return { url: process.env.EXPO_PUBLIC_SUPABASE_URL, cle: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
}

/** Client créé à la demande (pas à l'import) pour que l'app puisse démarrer sans configuration. */
export function getSupabase(config: Config = configDepuisEnv()): SupabaseClient {
  if (client) return client;
  const { url, cle } = config;
  const manquantes = [
    !url && 'EXPO_PUBLIC_SUPABASE_URL',
    !cle && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((v): v is string => !!v);
  if (manquantes.length > 0 || !url || !cle) throw new ConfigSupabaseManquante(manquantes);

  client = createClient(url, cle, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/** Pour les tests uniquement. */
export function reinitialiserClientPourTests() {
  client = null;
}
