import type { SupabaseClient } from '@supabase/supabase-js';

import type { CorrectionPhoto } from './photo';

/** Historique des corrections par photo (M3) : lu dans `photo_corrections`, dont la RLS ne montre que les lignes de l'élève. */
export const PAGE_HISTORIQUE = 20;
/** Les adresses signées des photos durent une heure : on les demande à l'ouverture de l'écran, jamais en copie. */
export const FONCTION_PHOTO = 'photo-correction';

export type EntreeHistorique = {
  id: string;
  creeLe: string;
  correction: CorrectionPhoto;
  avis: 'clair' | 'pas_compris' | null;
  /** Adresse signée de la photo ; null si elle est effacée (30 jours) ou illisible. */
  urlPhoto: string | null;
};

type Client = Pick<SupabaseClient, 'from' | 'functions'>;

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

  // La fonction signe les adresses (Cloudflare R2, ou l'ancien stockage Supabase) pour les photos de l'élève seulement.
  const ids = page.filter((l) => !!l.image_path).map((l) => l.id);
  let urls: Record<string, string> = {};
  if (ids.length) {
    try {
      const { data: reponse } = await client.functions.invoke(FONCTION_PHOTO, { body: { action: 'urls', ids } });
      if (reponse?.urls && typeof reponse.urls === 'object') urls = reponse.urls as Record<string, string>;
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
        urlPhoto: urls[l.id] ?? null,
      },
    ];
  });
  return { entrees, fin: lignes.length <= PAGE_HISTORIQUE };
}
