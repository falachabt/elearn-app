import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { simulationHorsLigneActive } from './connectivite';

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

/** Erreur réseau simulée : reconnaissable par `estErreurReseau`, donc traitée comme une vraie coupure. */
function erreurReseauSimulee(): TypeError {
  return new TypeError('Network request failed (simulation hors ligne)');
}

/**
 * Intercepte les lectures serveur quand la simulation « hors ligne » est active (page Paramètres développeur). C'est
 * ici, sur le client partagé, et pas dans chaque service : une seule porte, impossible à contourner par un nouvel
 * appel.
 *
 * Seules les lectures sont coupées : `rpc` et `from(...)` (donc `select`, `insert`, `update`, `delete`, `upsert`).
 * Les opérations d'authentification (`signIn`, `signUp`, `getSession`) restent inchangées, pour ne pas déconnecter
 * l'élève pendant un test. La sonde réseau n'utilise pas ce client : elle a sa propre coupure dans `sonder()`.
 *
 * La coupure est **réelle** : l'appel renvoie une promesse rejetée avec une erreur réseau, si bien que chaque écran
 * retombe sur son repli hors ligne (cache local ou bandeau « vérifie ta connexion »), exactement comme lors d'une
 * vraie perte de réseau.
 */
function envelopperPourSimulation(base: SupabaseClient): SupabaseClient {
  // Renvoie une promesse rejetée quand la simulation est active, `null` sinon. C'est une promesse rejetée et non un
  // `throw` : un `throw` synchrone dans un `rpc` contournerait le `await`/`catch` de l'appelant.
  const rejetSiHorsLigne = (): Promise<never> | null =>
    simulationHorsLigneActive() ? Promise.reject(erreurReseauSimulee()) : null;

  return new Proxy(base, {
    get(cible, prop, receveur) {
      const valeur = Reflect.get(cible, prop, receveur);
      if (prop === 'rpc') {
        return (...args: unknown[]) => {
          const rejet = rejetSiHorsLigne();
          return rejet ?? (valeur as (...a: unknown[]) => unknown).apply(cible, args);
        };
      }
      if (prop === 'from') {
        // `from` renvoie un constructeur de requête : on ne coupe qu'à l'exécution, pas à la construction.
        return (...args: unknown[]) => {
          const constructeur = (valeur as (...a: unknown[]) => unknown).apply(cible, args);
          return envelopperRequete(constructeur, rejetSiHorsLigne);
        };
      }
      return valeur;
    },
  });
}

function envelopperRequete<T>(constructeur: T, rejet: () => Promise<never> | null): T {
  return new Proxy(constructeur as object, {
    get(cible, prop, receveur) {
      const valeur = Reflect.get(cible, prop, receveur);
      if (typeof valeur === 'function') {
        return (...args: unknown[]) => {
          const promesse = rejet();
          return promesse ?? (valeur as (...a: unknown[]) => unknown).apply(cible, args);
        };
      }
      return valeur;
    },
  }) as T;
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

  client = envelopperPourSimulation(
    createClient(url, cle, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }),
  );
  return client;
}

/** Pour les tests uniquement. */
export function reinitialiserClientPourTests() {
  client = null;
}
