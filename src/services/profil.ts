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

/** Pays présélectionné d'après la région du téléphone (M1-02), Cameroun par défaut. */
export function paysParDefaut(region?: string | null): Pays {
  const r = region?.toUpperCase();
  return (PAYS as readonly string[]).includes(r ?? '') ? (r as Pays) : 'CM';
}

export const CLASSES = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Tle'] as const;
/** Filières de repli quand le serveur ne répond pas (la liste à jour vient de contest_track_list). */
export const CONCOURS = ['ingenieurs', 'sante', 'ens'] as const;
