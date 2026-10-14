import AsyncStorage from '@react-native-async-storage/async-storage';

import { signalerModification } from './reglagesLocaux';

export const CLE_PROFIL = 'profil.arrivee';

/** Concours précis choisi par un candidat : il se comporte comme une classe (programme, mission, annales). */
export type ConcoursChoisi = { id: string; sigle: string; nom: string; ville?: string | null };

/** `niveau` : la classe pour un élève, la filière (ingenieurs, sante…) pour un candidat. */
export type Profil = { type: 'eleve' | 'concours'; niveau?: string; pays?: string; concours?: ConcoursChoisi | null; termine: boolean };

/** Choix du parcours d'arrivée (M1-01), gardés sur le téléphone : aucun compte n'est demandé. */
export async function lireProfil(): Promise<Profil | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PROFIL);
    const p = brut ? (JSON.parse(brut) as Partial<Profil>) : null;
    if (p && (p.type === 'eleve' || p.type === 'concours')) return { type: p.type, niveau: p.niveau, pays: p.pays, concours: p.type === 'concours' ? (p.concours ?? null) : null, termine: !!p.termine };
  } catch {
    // illisible : parcours d'arrivée à refaire
  }
  return null;
}

/**
 * Tente d'extraire le profil depuis les métadonnées du compte Supabase
 * (utilisé quand un invité se connecte à un compte existant ou sur un nouvel appareil).
 */
export function profilDepuisCompte(user?: { user_metadata?: Record<string, unknown> } | null): Profil | null {
  if (!user || !user.user_metadata) return null;
  const m = user.user_metadata;
  const reglages = m.reglages as { profil?: Partial<Profil> } | undefined;
  const p = reglages?.profil ?? (m.profil as Partial<Profil> | undefined);

  const type = p?.type === 'concours' || m.statut === 'concours' ? 'concours' : 'eleve';
  const niveau =
    p?.niveau ??
    (typeof m.niveau === 'string' && m.niveau ? m.niveau : undefined) ??
    (typeof m.classe === 'string' && m.classe ? m.classe : undefined) ??
    (typeof m.class_level === 'string' && m.class_level ? m.class_level : undefined);
  const pays =
    p?.pays ??
    (typeof m.pays === 'string' && m.pays ? m.pays : undefined) ??
    (typeof m.country === 'string' && m.country ? m.country : undefined);
  const concours = p?.concours ?? null;

  if (niveau || pays) {
    return {
      type,
      niveau,
      pays,
      concours,
      termine: true,
    };
  }
  return null;
}

export async function enregistrerProfil(profil: Profil): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify(profil));
  } catch {
    // Non mémorisé : le parcours sera reproposé.
  }
  await signalerModification();
}

export const PAYS = ['CM', 'CI', 'SN', 'GA', 'BF', 'CD', 'FR'] as const;
export type Pays = (typeof PAYS)[number];

/**
 * Indicatif téléphonique des pays proposés. Il sert au repli quand la liste des pays vient du serveur : sans lui, le
 * sélecteur afficherait un « + » vide et le numéro Mobile Money partirait sans indicatif.
 */
export const INDICATIFS: Record<Pays, string> = { CM: '237', CI: '225', SN: '221', GA: '241', BF: '226', CD: '243', FR: '33' };

/** Pays présélectionné d'après la région du téléphone (M1-02), Cameroun par défaut. */
export function paysParDefaut(region?: string | null): string {
  const r = region?.toUpperCase();
  return r && /^[A-Z]{2}$/.test(r) ? r : 'CM';
}

export const CLASSES = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Tle'] as const;
/** Filières de repli quand le serveur ne répond pas (la liste à jour vient de contest_track_list). */
export const CONCOURS = ['ingenieurs', 'sante', 'ens'] as const;
