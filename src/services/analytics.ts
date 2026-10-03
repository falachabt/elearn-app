import PostHog from 'posthog-react-native';

import type { Evenements, NomEvenement } from './evenements';

// Projet PostHog d'Elearn (région US), comme l'ancienne app.
const HOTE_PAR_DEFAUT = 'https://us.i.posthog.com';

type Config = { cle?: string; hote?: string };

let client: PostHog | null = null;
let initialise = false;

function configDepuisEnv(): Config {
  // Accès statiques obligatoires : Expo remplace EXPO_PUBLIC_* au build.
  // EAS fournit EXPO_PUBLIC_POSTHOG_API_KEY (nom hérité de l'ancienne app) ; EXPO_PUBLIC_POSTHOG_KEY reste accepté.
  return { cle: process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.EXPO_PUBLIC_POSTHOG_KEY, hote: process.env.EXPO_PUBLIC_POSTHOG_HOST };
}

/** Initialise PostHog une seule fois. Sans clé : analytics désactivé, sans erreur. */
export function initAnalytics(config: Config = configDepuisEnv()): boolean {
  if (initialise) return client !== null;
  initialise = true;
  const cle = config.cle?.trim();
  if (!cle) return false;
  try {
    client = new PostHog(cle, { host: config.hote?.trim() || HOTE_PAR_DEFAUT });
  } catch (e) {
    console.warn('Analytics désactivé (initialisation impossible).', e);
    client = null;
  }
  return client !== null;
}

export const analyticsActif = () => client !== null;

/** Suit un événement typé. Ne lève jamais d'exception. */
export function suivre<E extends NomEvenement>(evenement: E, proprietes: Evenements[E]): void {
  if (!client) return;
  try {
    client.capture(evenement, proprietes as Record<string, never>);
  } catch {
    // L'analytics ne doit jamais casser l'app.
  }
}

/** Lie les événements à l'identifiant de la session Supabase. */
export function identifier(idUtilisateur: string, proprietes?: { email?: string | null; invite?: boolean }): void {
  if (!client) return;
  try {
    const p: Record<string, string | boolean> = {};
    if (proprietes?.email) p.email = proprietes.email;
    if (proprietes?.invite !== undefined) p.invite = proprietes.invite;
    client.identify(idUtilisateur, p);
  } catch {
    // ignoré
  }
}

/** Pour les tests uniquement. */
export function reinitialiserAnalyticsPourTests() {
  client = null;
  initialise = false;
}
