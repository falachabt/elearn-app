import { lireEcranCourant, suivre } from './analytics';

/**
 * Mesure des requêtes serveur (issue #14) : durée, statut et volume d'octets de chaque appel Supabase, plus le délai
 * avant l'affichage des données d'un écran.
 *
 * Branché une seule fois sur le client Supabase (option `global.fetch`) : aucun appel existant n'est modifié. Ne mesure
 * que ce que l'app envoie au serveur Supabase ; l'analytics lui-même (PostHog) passe par un autre chemin et n'est pas
 * compté.
 *
 * Données envoyées : le nom de la ressource (table, fonction RPC, Edge Function), jamais l'URL complète ni les filtres
 * (qui peuvent contenir des identifiants ou des saisies), ni le corps ni la réponse.
 */

type FetchFn = typeof fetch;

/** Extrait un nom court de l'URL, sans paramètres de requête : `table:cours`, `rpc:xxx`, `fonction:xxx`… */
export function nommerRequete(url: string): string {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return 'autre';
  }
  // Chemins Supabase : /rest/v1/<ressource>, /functions/v1/<nom>, /auth/v1/<action>, /storage/v1/<...>
  const [categorie, version, ressource] = segments;
  if (version !== 'v1') return 'autre';
  if (categorie === 'rest') {
    const [, , , cible] = segments;
    if (ressource === 'rpc') return `rpc:${cible ?? 'inconnue'}`;
    return `table:${ressource ?? 'inconnue'}`;
  }
  if (categorie === 'functions') return `fonction:${segments[2] ?? 'inconnue'}`;
  if (categorie === 'auth') return `auth:${segments[2] ?? 'inconnue'}`;
  if (categorie === 'storage') return 'storage';
  return 'autre';
}

/** Taille du corps envoyé, si c'est une chaîne (le client Supabase envoie du JSON). 0 sinon. */
function octetsEnvoyes(corps: BodyInit | null | undefined): number {
  if (typeof corps === 'string') return new TextEncoder().encode(corps).length;
  return 0;
}

/** Taille de la réponse, lue dans `content-length`. `null` si le serveur ne l'annonce pas (réponse compressée ou streamée). */
function octetsRecus(reponse: Response): number | null {
  const brut = reponse.headers.get('content-length');
  if (brut === null) return null;
  const nombre = Number(brut);
  return Number.isFinite(nombre) ? nombre : null;
}

// Écran dont on attend les premières données. Réinitialisé à chaque changement d'écran.
let ecranSuivi: string | null = null;
let debutEcran = 0;
let ecranPretEmis = false;

function noterEcran(maintenant: number) {
  const courant = lireEcranCourant();
  if (courant !== ecranSuivi) {
    ecranSuivi = courant;
    debutEcran = maintenant;
    ecranPretEmis = false;
  }
}

function mesurerSafe(tache: () => void) {
  try {
    tache();
  } catch {
    // La mesure ne doit jamais casser l'app.
  }
}

/**
 * Enveloppe `fetch` : chronomètre chaque requête et envoie `requete_reseau`. Le premier appel réussi après un changement
 * d'écran envoie aussi `ecran_pret` (délai entre l'ouverture de l'écran et sa première réponse serveur). C'est une
 * approximation : une requête lancée en arrière-plan peut compter.
 *
 * Ne lève jamais d'erreur à cause de la mesure : la réponse et les erreurs du client Supabase sont renvoyées telles quelles.
 */
export function mesurerFetch(fetchOriginal: FetchFn = fetch): FetchFn {
  return async (entree, init) => {
    const debut = Date.now();
    mesurerSafe(() => noterEcran(debut));
    const url = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url;
    const nom = nommerRequete(url);
    const envoyes = octetsEnvoyes(init?.body);

    let reponse: Response;
    try {
      reponse = await fetchOriginal(entree, init);
    } catch (erreur) {
      mesurerSafe(() => suivre('requete_reseau', { nom, duration_ms: Date.now() - debut, statut: 0, octets_envoyes: envoyes, octets_recus: null }));
      throw erreur;
    }

    mesurerSafe(() => {
      const fin = Date.now();
      suivre('requete_reseau', { nom, duration_ms: fin - debut, statut: reponse.status, octets_envoyes: envoyes, octets_recus: octetsRecus(reponse) });
      if (reponse.ok && !ecranPretEmis && ecranSuivi) {
        ecranPretEmis = true;
        suivre('ecran_pret', { ecran_cible: ecranSuivi, duration_ms: fin - debutEcran });
      }
    });
    return reponse;
  };
}

/** Pour les tests uniquement. */
export function reinitialiserMesureReseauPourTests() {
  ecranSuivi = null;
  debutEcran = 0;
  ecranPretEmis = false;
}
