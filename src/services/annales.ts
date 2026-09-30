import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'rpc'>;

export type Sujet = {
  id: number;
  concoursId: string;
  ecole: string;
  sigle: string;
  concours: string;
  matiere: string | null;
  titre: string;
  annee: number | null;
  corrige: boolean;
  dureeMin: number | null;
  gratuit: boolean;
};
export type DetailSujet = { id: number; titre: string; urlSujet: string; urlCorrection: string | null; correctionVerrouillee: boolean };
export type Filtres = { sigle?: string | null; annee?: number | null };

export const CLE_CATALOGUE = 'annales.catalogue';

/** « Sujet_CULTURE GÉNÉRALE ET BILINGUISME_2021 » → « Culture générale et bilinguisme » (année et préfixe retirés). */
export function titreSujet(nom: string): string {
  const propre = nom
    .replace(/[_]+/g, ' ')
    .replace(/\.pdf$/i, '')
    .replace(/^\s*sujets?\s*(de|d'|du)?\s*/i, '')
    .replace(/\b(19[5-9]\d|20\d{2})\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!propre) return nom.trim();
  const minuscules = propre === propre.toUpperCase() ? propre.toLowerCase() : propre;
  return minuscules.charAt(0).toUpperCase() + minuscules.slice(1);
}

/** Catalogue des annales (M6-01), gardé sur le téléphone pour la consultation hors ligne. */
export async function lireCatalogue(client: Client): Promise<Sujet[]> {
  try {
    const { data, error } = await client.rpc('exam_catalog');
    if (error) throw error;
    type Ligne = { paper_id: number; contest_id: string; school: string | null; school_code: string | null; contest: string; subject: string | null; title: string; year: number | null; has_correction: boolean; duration_min: number | null; free: boolean };
    const sujets = ((data ?? []) as Ligne[]).map((l) => ({
      id: l.paper_id,
      concoursId: l.contest_id,
      ecole: l.school?.trim() || '',
      sigle: l.school_code?.trim() || l.school?.trim() || '',
      concours: l.contest.trim(),
      matiere: l.subject?.trim() || null,
      titre: titreSujet(l.title),
      annee: l.year,
      corrige: l.has_correction,
      dureeMin: l.duration_min,
      gratuit: l.free,
    }));
    await AsyncStorage.setItem(CLE_CATALOGUE, JSON.stringify(sujets));
    return sujets;
  } catch (e) {
    const copie = await AsyncStorage.getItem(CLE_CATALOGUE);
    if (copie) return JSON.parse(copie) as Sujet[];
    throw e;
  }
}

export function filtrer(sujets: readonly Sujet[], f: Filtres): Sujet[] {
  return sujets.filter((s) => (!f.sigle || s.sigle === f.sigle) && (!f.annee || s.annee === f.annee));
}

/** Valeurs proposées dans les filtres : écoles par nombre de sujets, années de la plus récente à la plus ancienne. */
export function optionsFiltres(sujets: readonly Sujet[], f: Filtres = {}): { sigles: string[]; annees: number[] } {
  const compte = new Map<string, number>();
  for (const s of sujets) if (s.sigle) compte.set(s.sigle, (compte.get(s.sigle) ?? 0) + 1);
  const sigles = [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
  const annees = [...new Set(filtrer(sujets, { sigle: f.sigle }).map((s) => s.annee).filter((a): a is number => !!a))].sort((a, b) => b - a);
  return { sigles, annees };
}

/** Liens du sujet et, si le droit est ouvert (sujet gratuit ou pass), de la correction (M6-02, M6-04). */
export async function lireSujet(client: Client, id: number): Promise<DetailSujet> {
  const { data, error } = await client.rpc('exam_paper', { p_paper: id });
  if (error) throw error;
  const l = (data as { paper_id: number; title: string; subject_url: string; correction_url: string | null; correction_locked: boolean }[] | null)?.[0];
  if (!l) throw new Error('sujet introuvable');
  return { id: l.paper_id, titre: titreSujet(l.title), urlSujet: l.subject_url, urlCorrection: l.correction_url, correctionVerrouillee: l.correction_locked };
}
