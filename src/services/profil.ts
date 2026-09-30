import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLE_PROFIL = 'profil.arrivee';

export type Profil = { type: 'eleve' | 'concours'; niveau?: string; pays?: string; termine: boolean };

/** Choix du parcours d'arrivée (M1-01), gardés sur le téléphone : aucun compte n'est demandé. */
export async function lireProfil(): Promise<Profil | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PROFIL);
    const p = brut ? (JSON.parse(brut) as Partial<Profil>) : null;
    if (p && (p.type === 'eleve' || p.type === 'concours')) return { type: p.type, niveau: p.niveau, pays: p.pays, termine: !!p.termine };
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
}

export const PAYS = ['CM', 'CI', 'SN', 'GA', 'BF', 'CD', 'FR'] as const;
export type Pays = (typeof PAYS)[number];

/** Pays présélectionné d'après la région du téléphone (M1-02), Cameroun par défaut. */
export function paysParDefaut(region?: string | null): Pays {
  const r = region?.toUpperCase();
  return (PAYS as readonly string[]).includes(r ?? '') ? (r as Pays) : 'CM';
}

export const CLASSES = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Tle'] as const;
export const CONCOURS = ['ens', 'medecine', 'ingenieurs'] as const;
