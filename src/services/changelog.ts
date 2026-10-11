import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from './supabase';

export type Changelog = {
  id: string;
  version: string;
  title_fr: string | null;
  title_en: string | null;
  content_fr: string;
  content_en: string;
  obligatoire: boolean;
  published_at: string;
};

/**
 * Charge le dernier changelog publié depuis Supabase (B9-OTA, Issue #20).
 * Si une version précise est fournie, recherche d'abord cette version.
 */
export async function chargerDernierChangelog(
  client: SupabaseClient = getSupabase(),
  versionCible?: string,
): Promise<Changelog | null> {
  try {
    if (versionCible) {
      const { data } = await client
        .from('changelogs')
        .select('id, version, title_fr, title_en, content_fr, content_en, obligatoire, published_at')
        .eq('version', versionCible)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle<Changelog>();

      if (data) return data;
    }

    const { data, error } = await client
      .from('changelogs')
      .select('id, version, title_fr, title_en, content_fr, content_en, obligatoire, published_at')
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle<Changelog>();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Extrait le titre et le contenu du changelog selon la langue de l'utilisateur.
 */
export function textesChangelog(changelog: Changelog, langue: 'fr' | 'en'): { titre: string | null; contenu: string } {
  const estEn = langue === 'en';
  const titre = estEn ? changelog.title_en || changelog.title_fr : changelog.title_fr || changelog.title_en;
  const contenu = estEn ? changelog.content_en || changelog.content_fr : changelog.content_fr || changelog.content_en;
  return { titre, contenu };
}
