import type { SupabaseClient } from '@supabase/supabase-js';

import { lireLecons, lireLues, marquerLue } from './reviser';
import { lireSuivis, type VideoCours } from './videos';

/**
 * Leçons à valider quand l'élève a regardé des vidéos du cours jusqu'à leur fin réelle (retour de Benny, 18/11/2026) :
 * les vidéos suivent le cours, pas chaque leçon. Règle : la part de vidéos terminées donne la part de leçons validées,
 * dans l'ordre du cours (arrondi vers le bas, donc toutes les leçons seulement quand toutes les vidéos sont finies).
 * Une vidéo seulement ouverte ou arrêtée avant la fin n'est jamais comptée (`terminee` est posée à la fin réelle).
 * Ne retire jamais une leçon déjà validée.
 */
export function leconsAValiderParVideo(
  lecons: readonly { id: number }[],
  lues: Record<string, number>,
  videosTerminees: number,
  videosTotal: number,
): number[] {
  if (!lecons.length || videosTotal <= 0 || videosTerminees <= 0) return [];
  const part = Math.min(1, videosTerminees / videosTotal);
  const nombre = Math.floor(lecons.length * part);
  return lecons.slice(0, nombre).filter((l) => lues[l.id] === undefined).map((l) => l.id);
}

type ClientVideo = Pick<SupabaseClient, 'rpc' | 'from'>;

/** À appeler quand une vidéo vient de se terminer : valide les leçons correspondantes (progression, XP une seule fois par leçon). */
export async function validerLeconsParVideo(client: ClientVideo, cours: number, videos: readonly VideoCours[], userId?: string | null): Promise<number[]> {
  try {
    const [lecons, lues, suivis] = await Promise.all([lireLecons(client as never, cours), lireLues(), lireSuivis()]);
    const terminees = videos.filter((v) => suivis[v.id]?.terminee).length;
    const aValider = leconsAValiderParVideo(lecons, lues, terminees, videos.length);
    for (const id of aValider) await marquerLue(id, cours, client as never, undefined, userId);
    return aValider;
  } catch {
    return [];
  }
}
