import type { SupabaseClient, User } from '@supabase/supabase-js';

import { changerLangue, i18n, langueSupportee, type Langue } from '@/i18n';

import { appliquerAffichage, lireAffichage, type ReglageTheme, type TailleTexte } from './affichage';
import { repriseInviteEnCours } from './repriseInvite';
import { definirWifiSeulement, lireWifiSeulement } from './donnees';
import { enregistrerProfil, lireProfil, type Profil } from './profil';
import { abonnerModifications, ecrireMajReglages, lireMajReglages, sansSignaler } from './reglagesLocaux';
import { appliquerPreferences, lirePreferences, type Preferences } from './retours';
import { enregistrerRythme, lireRythme } from './rythme';

type Client = Pick<SupabaseClient, 'auth'>;

/** Réglages copiés dans le compte (metadata utilisateur `reglages`) : retrouvés sur un autre téléphone (M16, M1-04). */
export type Reglages = {
  preferences: Preferences;
  langue: Langue;
  profil?: Pick<Profil, 'type' | 'niveau' | 'pays' | 'concours'>;
  /** Taille de la mission du jour choisie (M4-08). */
  rythme?: number | null;
  affichage?: { theme: ReglageTheme; taille: TailleTexte };
  wifiSeulement?: boolean;
  maj: string;
};

export async function construireReglages(maj?: string | null): Promise<Reglages> {
  const profil = await lireProfil();
  return {
    preferences: { ...lirePreferences() },
    langue: langueSupportee(i18n.language) ?? 'fr',
    ...(profil && { profil: { type: profil.type, niveau: profil.niveau, pays: profil.pays, concours: profil.concours ?? null } }),
    rythme: await lireRythme(),
    affichage: lireAffichage(),
    wifiSeulement: await lireWifiSeulement(),
    maj: maj ?? (await lireMajReglages()) ?? new Date().toISOString(),
  };
}

export function lireReglagesCompte(user?: Pick<User, 'user_metadata'> | null): Reglages | null {
  const r = user?.user_metadata?.reglages as Partial<Reglages> | undefined;
  return r && typeof r.maj === 'string' && !Number.isNaN(Date.parse(r.maj)) ? (r as Reglages) : null;
}

/** Copie les réglages du téléphone dans le compte courant. Ne lève jamais. */
export async function envoyerReglages(client: Client, forcer = false): Promise<boolean> {
  if (!forcer && repriseInviteEnCours()) return false;
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
    if (r.affichage) await appliquerAffichage(r.affichage);
    if (typeof r.wifiSeulement === 'boolean') await definirWifiSeulement(r.wifiSeulement);
    if (r.profil?.type === 'eleve' || r.profil?.type === 'concours') {
      await enregistrerProfil({ type: r.profil.type, niveau: r.profil.niveau, pays: r.profil.pays, concours: r.profil.concours ?? null, termine: true });
    }
    if (typeof r.rythme === 'number') await enregistrerRythme(r.rythme);
  });
  await ecrireMajReglages(r.maj);
}

/** Copie les réglages du téléphone dans le compte après acceptation de la reprise invitée. */
export async function remplacerReglagesParTelephone(client: Client, garderProfilExistant?: Reglages | null): Promise<boolean> {
  await ecrireMajReglages(new Date().toISOString());
  const reglagesLocaux = await construireReglages();
  const reglages = {
    ...reglagesLocaux,
    ...(!reglagesLocaux.profil && garderProfilExistant?.profil && { profil: garderProfilExistant.profil }),
    ...(reglagesLocaux.rythme == null && garderProfilExistant?.rythme != null && { rythme: garderProfilExistant.rythme }),
  };
  await appliquerReglages(reglages);
  try {
    const { error } = await client.auth.updateUser({ data: { reglages } });
    return !error;
  } catch {
    return false;
  }
}

/**
 * À l'ouverture de session : le plus récent gagne. Compte plus récent (autre téléphone) : appliqué ici ;
 * téléphone plus récent ou compte vide : copié dans le compte.
 */
export async function synchroniserReglages(client: Client, user: Pick<User, 'user_metadata'>): Promise<'applique' | 'envoye' | 'rien'> {
  if (repriseInviteEnCours()) return 'rien';
  const distants = lireReglagesCompte(user);
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
