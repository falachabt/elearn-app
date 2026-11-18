import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { signalerSucces, simulationHorsLigneActive } from './connectivite';
import { mesurerFetch } from './mesureReseau';

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
 * Fausse requête renvoyée quand la simulation « hors ligne » est active : **chaînable** comme un constructeur
 * Supabase (`.select().eq().maybeSingle()`…), et qui ne rejette qu'à l'`await`.
 *
 * Une promesse rejetée dès la première méthode casserait la chaîne deux fois : la méthode suivante n'existe pas sur
 * une promesse (TypeError, attrapé par l'appelant), et le rejet d'origine reste sans gestionnaire — capturé comme
 * « unhandled rejection » par le SDK d'erreurs. Ici, aucune promesse n'existe avant l'`await` : rien ne flotte, et
 * le `catch` de l'appelant reçoit l'erreur réseau simulée, comme lors d'une vraie coupure.
 */
function requeteHorsLigne(): PromiseLike<never> {
  const erreur = erreurReseauSimulee();
  // Le rejet est construit à la demande et aussitôt rattaché à un gestionnaire : jamais de promesse orpheline.
  const terminaisons: Record<string, (...args: never[]) => Promise<never>> = {
    then: (onFulfilled, onRejected) => Promise.reject(erreur).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.reject(erreur).catch(onRejected),
    finally: (onFinally) => Promise.reject(erreur).finally(onFinally),
  };
  const proxy: unknown = new Proxy(
    {},
    {
      get(_cible, prop) {
        // `then`, `catch`, `finally` terminent la chaîne ; toute autre méthode (select, eq, maybeSingle…) la prolonge.
        return terminaisons[prop as string] ?? (() => proxy);
      },
    },
  );
  return proxy as PromiseLike<never>;
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
 * La coupure est **réelle** : l'appel rejette avec une erreur réseau à l'`await`, si bien que chaque écran retombe
 * sur son repli hors ligne (cache local ou bandeau « vérifie ta connexion »), exactement comme lors d'une vraie
 * perte de réseau.
 */
function envelopperPourSimulation(base: SupabaseClient): SupabaseClient {
  // Renvoie la fausse requête hors ligne quand la simulation est active, `null` sinon. Pas un `throw` synchrone : il
  // contournerait le `await`/`catch` de l'appelant. Pas une promesse rejetée immédiate non plus : voir requeteHorsLigne.
  const rejetSiHorsLigne = (): PromiseLike<never> | null => (simulationHorsLigneActive() ? requeteHorsLigne() : null);

  // Toute réponse serveur réussie rafraîchit le « dernier contact » (via `signalerSucces`) : une preuve aussi directe
  // qu'une sonde. C'est ce qui permet à un téléchargement fraîchement terminé de ne pas être jugé « expiré » dès qu'on
  // coupe le réseau.
  const signaler = <R>(promesse: Promise<R>): Promise<R> => {
    void promesse.then(
      () => signalerSucces(),
      () => undefined,
    );
    return promesse;
  };

  return new Proxy(base, {
    get(cible, prop, receveur) {
      const valeur = Reflect.get(cible, prop, receveur);
      if (prop === 'rpc') {
        return (...args: unknown[]) => {
          const rejet = rejetSiHorsLigne();
          if (rejet) return rejet;
          return signaler((valeur as (...a: unknown[]) => Promise<unknown>).apply(cible, args) as Promise<unknown>) as unknown;
        };
      }
      if (prop === 'from') {
        // `from` renvoie un constructeur de requête : on ne coupe qu'à l'exécution, pas à la construction.
        return (...args: unknown[]) => {
          const constructeur = (valeur as (...a: unknown[]) => unknown).apply(cible, args);
          return envelopperRequete(constructeur, rejetSiHorsLigne, signaler);
        };
      }
      return valeur;
    },
  });
}

function envelopperRequete<T>(constructeur: T, rejet: () => PromiseLike<never> | null, signaler: <R>(p: Promise<R>) => Promise<R>): T {
  return new Proxy(constructeur as object, {
    get(cible, prop, receveur) {
      const valeur = Reflect.get(cible, prop, receveur);
      if (typeof valeur === 'function') {
        return (...args: unknown[]) => {
          const promesse = rejet();
          if (promesse) return promesse;
          return signaler((valeur as (...a: unknown[]) => Promise<unknown>).apply(cible, args) as Promise<unknown>) as unknown;
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
      // Mesure de chaque requête (durée, statut, octets) : une seule porte, sans toucher aux appels (issue #14).
      global: { fetch: mesurerFetch() },
    }),
  );
  return client;
}

/** Pour les tests uniquement. */
export function reinitialiserClientPourTests() {
  client = null;
}
