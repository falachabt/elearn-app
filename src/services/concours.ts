import type { SupabaseClient } from '@supabase/supabase-js';

import type { ConcoursChoisi } from './profil';

type Client = Pick<SupabaseClient, 'rpc'>;

export type Filiere = { code: string; nom: string; icone: string; concours: number };
export type ConcoursFiliere = ConcoursChoisi & {
  ecole: string;
  cycle: string | null;
  date: string | null;
  sujets: number;
  lecons: number;
  /** Logo de l'école (champ `imageUrl` de la base) ; null quand l'école n'en a pas (initiales à la place). */
  logo?: string | null;
  /** Nombre d'élèves qui préparent ce concours ; null quand le serveur ne le sert pas encore. */
  inscrits?: number | null;
  /** Site de l'école, seulement s'il est renseigné en base et en https. */
  site?: string | null;
};

/** Le serveur ne connaît pas encore la fonction (déploiement en retard) : on retombe sur l'ancienne, sans pays. */
const fonctionAbsente = (e: unknown) => {
  const m = e as { code?: string; message?: string } | null;
  return !!m && (m.code === 'PGRST202' || m.code === '42883' || /could not find the function|does not exist/i.test(m.message ?? ''));
};

/** Pays dont les concours sont en base avant l'ouverture d'autres pays : seuls ceux-là ont des concours avec l'ancienne fonction. */
const PAYS_ANCIEN = 'CM';

/** Filières de concours ouvertes pour un pays (étape 1), dans la langue de l'app. */
export async function lireFilieres(client: Client, langue: 'fr' | 'en', pays?: string): Promise<Filiere[]> {
  type Ligne = { code: string; name_fr: string; name_en: string; icon: string; contests: number };
  const mapper = (data: unknown) => ((data ?? []) as Ligne[]).map((l) => ({ code: l.code, nom: langue === 'en' ? l.name_en : l.name_fr, icone: l.icon, concours: l.contests }));
  if (pays) {
    const v2 = await client.rpc('contest_track_list_v2', { p_country: pays.toUpperCase() });
    if (!v2.error) return mapper(v2.data);
    if (!fonctionAbsente(v2.error)) throw v2.error;
    if (pays.toUpperCase() !== PAYS_ANCIEN) return [];
  }
  const { data, error } = await client.rpc('contest_track_list');
  if (error) throw error;
  return mapper(data);
}

/** Concours ouverts d'une filière pour un pays (étape 2), avec logo et nombre d'inscrits quand le serveur les sert. */
export async function lireConcoursFiliere(client: Client, filiere: string, pays?: string): Promise<ConcoursFiliere[]> {
  type Ligne = { contest_id: string; sigle: string | null; school: string | null; name: string | null; cycle: string | null; city: string | null; next_date: string | null; papers: number; lessons: number; logo_url?: string | null; enrolled?: number | null; website?: string | null };
  let data: unknown;
  const v2 = pays ? await client.rpc('track_contests_v2', { p_track: filiere, p_country: pays.toUpperCase() }) : null;
  if (v2 && !v2.error) data = v2.data;
  else {
    if (v2 && !fonctionAbsente(v2.error)) throw v2.error;
    if (pays && pays.toUpperCase() !== PAYS_ANCIEN) return [];
    const ancien = await client.rpc('track_contests', { p_track: filiere });
    if (ancien.error) throw ancien.error;
    data = ancien.data;
  }
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
    logo: l.logo_url ?? null,
    inscrits: l.enrolled ?? null,
    site: /^https:\/\//i.test(l.website ?? '') ? (l.website as string).trim() : null,
  }));
}

export type ProposerResultat = 'ok' | 'indisponible';

/**
 * Propose un concours ou une certification absent de la liste (retour de Benny du 15 novembre 2026). Chaque demande
 * est enregistrée avec son pays ; le serveur les compte par concours ou certification et par pays pour prioriser.
 */
export async function proposerSuggestion(
  client: Client,
  suggestion: { genre: 'concours' | 'certification'; libelle: string; pays: string; ville?: string },
): Promise<ProposerResultat> {
  const { error } = await client.rpc('submit_suggestion', {
    p_kind: suggestion.genre,
    p_label: suggestion.libelle.trim(),
    p_country: suggestion.pays.toUpperCase(),
    p_city: suggestion.ville?.trim() || null,
  });
  if (!error) return 'ok';
  if (fonctionAbsente(error)) return 'indisponible';
  throw error;
}

/** Valeurs distinctes d'un champ (niveaux ou villes) pour les puces de filtre. */
export function valeursDistinctes(liste: readonly ConcoursFiliere[], champ: 'cycle' | 'ville'): string[] {
  return [...new Set(liste.map((c) => (champ === 'cycle' ? c.cycle : c.ville)).filter((v): v is string => !!v && v.trim() !== ''))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Filtre complet : recherche, niveau et ville (région). */
export function filtrerConcoursAvance(liste: readonly ConcoursFiliere[], recherche: string, cycle: string | null, ville: string | null): ConcoursFiliere[] {
  return filtrerConcours(liste, recherche).filter((c) => (!cycle || c.cycle === cycle) && (!ville || c.ville === ville));
}

/** Filtre de la recherche : sigle, école ou ville, sans tenir compte des accents ni de la casse. */
export function filtrerConcours(liste: readonly ConcoursFiliere[], recherche: string): ConcoursFiliere[] {
  const plat = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = plat(recherche.trim());
  if (!q) return [...liste];
  return liste.filter((c) => plat([c.sigle, c.ecole, c.ville ?? '', c.nom].join(' ')).includes(q));
}

/** Enregistre le concours choisi côté serveur (nombre d'inscrits). Sans effet si le serveur ne l'a pas encore ou hors ligne. */
export async function signalerConcoursChoisi(client: Client, concoursId: string): Promise<void> {
  try {
    await client.rpc('set_my_contest', { p_contest: concoursId });
  } catch {
    // Information de comptage seulement : le choix est déjà gardé dans le profil.
  }
}
