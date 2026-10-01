import type { SupabaseClient } from '@supabase/supabase-js';

import type { ConcoursChoisi } from './profil';

type Client = Pick<SupabaseClient, 'rpc'>;

export type Filiere = { code: string; nom: string; icone: string; concours: number };
export type ConcoursFiliere = ConcoursChoisi & { ecole: string; cycle: string | null; date: string | null; sujets: number; lecons: number };

/** Filières de concours ouvertes (étape 1), dans la langue de l'app. */
export async function lireFilieres(client: Client, langue: 'fr' | 'en'): Promise<Filiere[]> {
  const { data, error } = await client.rpc('contest_track_list');
  if (error) throw error;
  type Ligne = { code: string; name_fr: string; name_en: string; icon: string; contests: number };
  return ((data ?? []) as Ligne[]).map((l) => ({ code: l.code, nom: langue === 'en' ? l.name_en : l.name_fr, icone: l.icon, concours: l.contests }));
}

/** Concours ouverts d'une filière (étape 2). */
export async function lireConcoursFiliere(client: Client, filiere: string): Promise<ConcoursFiliere[]> {
  const { data, error } = await client.rpc('track_contests', { p_track: filiere });
  if (error) throw error;
  type Ligne = { contest_id: string; sigle: string | null; school: string | null; name: string | null; cycle: string | null; city: string | null; next_date: string | null; papers: number; lessons: number };
  return ((data ?? []) as Ligne[]).map((l) => ({
    id: l.contest_id,
    sigle: l.sigle?.trim() || l.school?.trim() || '',
    nom: l.name?.trim() || '',
    ville: l.city,
    ecole: l.school?.trim() || '',
    cycle: l.cycle,
    date: l.next_date,
    sujets: l.papers,
    lecons: l.lessons,
  }));
}

/** Filtre de la recherche : sigle, école ou ville, sans tenir compte des accents ni de la casse. */
export function filtrerConcours(liste: readonly ConcoursFiliere[], recherche: string): ConcoursFiliere[] {
  const plat = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = plat(recherche.trim());
  if (!q) return [...liste];
  return liste.filter((c) => plat([c.sigle, c.ecole, c.ville ?? '', c.nom].join(' ')).includes(q));
}
