import type { SupabaseClient, User } from '@supabase/supabase-js';

import { changerLangue, i18n, langueSupportee, type Langue } from '@/i18n';

import { enregistrerProfil, lireProfil, type Profil } from './profil';
import { abonnerModifications, ecrireMajReglages, lireMajReglages, sansSignaler } from './reglagesLocaux';
import { appliquerPreferences, lirePreferences, type Preferences } from './retours';

type Client = Pick<SupabaseClient, 'auth'>;

/** Réglages copiés dans le compte (metadata utilisateur `reglages`) : retrouvés sur un autre téléphone (M16, M1-04). */
export type Reglages = {
  preferences: Preferences;
  langue: Langue;
  profil?: Pick<Profil, 'type' | 'niveau' | 'pays'>;
  maj: string;
};

export async function construireReglages(maj?: string | null): Promise<Reglages> {
  const profil = await lireProfil();
  return {
    preferences: { ...lirePreferences() },
    langue: langueSupportee(i18n.language) ?? 'fr',
    ...(profil && { profil: { type: profil.type, niveau: profil.niveau, pays: profil.pays } }),
    maj: maj ?? (await lireMajReglages()) ?? new Date().toISOString(),
  };
}

function lireDistants(user?: Pick<User, 'user_metadata'> | null): Reglages | null {
  const r = user?.user_metadata?.reglages as Partial<Reglages> | undefined;
  return r && typeof r.maj === 'string' && !Number.isNaN(Date.parse(r.maj)) ? (r as Reglages) : null;
}

/** Copie les réglages du téléphone dans le compte courant. Ne lève jamais. */
export async function envoyerReglages(client: Client): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession();
    if (!data.session) return false;
    const reglages = await construireReglages();
    const { error } = await client.auth.updateUser({ data: { reglages } });
    return !error;
  } catch {
    return false;
  }
}

/** Applique les réglages du compte sur le téléphone, sans les renvoyer. Un profil présent termine le parcours d'arrivée. */
export async function appliquerReglages(r: Reglages): Promise<void> {
  await sansSignaler(async () => {
    if (r.preferences) await appliquerPreferences(r.preferences);
    const langue = langueSupportee(r.langue);
    if (langue && langue !== i18n.language) await changerLangue(langue);
    if (r.profil?.type === 'eleve' || r.profil?.type === 'concours') {
      await enregistrerProfil({ type: r.profil.type, niveau: r.profil.niveau, pays: r.profil.pays, termine: true });
    }
  });
  await ecrireMajReglages(r.maj);
}

/**
 * À l'ouverture de session : le plus récent gagne. Compte plus récent (autre téléphone) : appliqué ici ;
 * téléphone plus récent ou compte vide : copié dans le compte.
 */
export async function synchroniserReglages(client: Client, user: Pick<User, 'user_metadata'>): Promise<'applique' | 'envoye' | 'rien'> {
  const distants = lireDistants(user);
  const locale = await lireMajReglages();
  if (distants && (!locale || Date.parse(distants.maj) > Date.parse(locale))) {
    await appliquerReglages(distants);
    return 'applique';
  }
  if (distants && locale && Date.parse(distants.maj) === Date.parse(locale)) return 'rien';
  return (await envoyerReglages(client)) ? 'envoye' : 'rien';
}

/** Chaque changement local est copié dans le compte, regroupé sur `delaiMs`. Renvoie la fonction d'arrêt. */
export function suivreModifications(client: Client, delaiMs = 800): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const arreter = abonnerModifications(() => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => void envoyerReglages(client), delaiMs);
  });
  return () => {
    if (minuteur) clearTimeout(minuteur);
    arreter();
  };
}
