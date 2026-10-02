import type { SupabaseClient } from '@supabase/supabase-js';

import type { CorrectionPhoto } from './photo';

/** Historique des corrections par photo (M3) : lu dans `photo_corrections`, dont la RLS ne montre que les lignes de l'élève. */
export const PAGE_HISTORIQUE = 20;
/** Les adresses signées des photos durent une heure : on les demande à l'ouverture de l'écran, jamais en copie. */
export const DUREE_URL_PHOTO_S = 3600;
const BUCKET = 'photo-corrections';

export type EntreeHistorique = {
  id: string;
  creeLe: string;
  correction: CorrectionPhoto;
  avis: 'clair' | 'pas_compris' | null;
  /** Adresse signée de la photo ; null si elle est effacée (30 jours) ou illisible. */
  urlPhoto: string | null;
};

type Client = Pick<SupabaseClient, 'from' | 'storage'>;

type Ligne = { id: string; created_at: string; result: unknown; feedback: string | null; image_path: string | null };

/** Garde le résultat enregistré par l'IA seulement s'il a la forme d'une correction affichable. */
export function correctionDepuisResultat(r: unknown): CorrectionPhoto | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.enonce !== 'string' || !Array.isArray(o.etapes)) return null;
  const texte = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    matiere: texte(o.matiere) as CorrectionPhoto['matiere'],
    enonce: o.enonce,
    methode: texte(o.methode),
    etapes: o.etapes.map((e) => ({ titre: texte((e as { titre?: unknown })?.titre), detail: texte((e as { detail?: unknown })?.detail) })),
    resultat: texte(o.resultat),
    a_retenir: texte(o.a_retenir),
    notion: texte(o.notion),
  };
}

/**
 * Une page de corrections réussies, de la plus récente à la plus ancienne. `avant` : date de la dernière entrée déjà
 * affichée. `fin` : plus rien après cette page. Les corrections illisibles ou en échec n'y figurent pas.
 */
export async function lireHistorique(client: Client, avant?: string): Promise<{ entrees: EntreeHistorique[]; fin: boolean }> {
  let requete = client
    .from('photo_corrections')
    .select('id, created_at, result, feedback, image_path')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(PAGE_HISTORIQUE + 1);
  if (avant) requete = requete.lt('created_at', avant);
  const { data, error } = await requete;
  if (error) throw error;
  const lignes = (data ?? []) as Ligne[];
  const page = lignes.slice(0, PAGE_HISTORIQUE);

  const chemins = page.map((l) => l.image_path).filter((c): c is string => !!c);
  const urls = new Map<string, string>();
  if (chemins.length) {
    try {
      const { data: signees } = await client.storage.from(BUCKET).createSignedUrls(chemins, DUREE_URL_PHOTO_S);
      for (const s of signees ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    } catch {
      // Photos illisibles pour l'instant : les corrections restent consultables sans la photo.
    }
  }

  const entrees = page.flatMap((l): EntreeHistorique[] => {
    const correction = correctionDepuisResultat(l.result);
    if (!correction) return [];
    return [
      {
        id: l.id,
        creeLe: l.created_at,
        correction,
        avis: l.feedback === 'clair' || l.feedback === 'pas_compris' ? l.feedback : null,
        urlPhoto: l.image_path ? (urls.get(l.image_path) ?? null) : null,
      },
    ];
  });
  return { entrees, fin: lignes.length <= PAGE_HISTORIQUE };
}
