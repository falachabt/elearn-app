import type { SupabaseClient } from '@supabase/supabase-js';

import { avecCopie } from './reviser';
import { titreDocument } from './titres';

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
export type DetailSujet = { id: number; titre: string; urlSujet: string; aCorrection: boolean; correctionGratuite: boolean };
export type Filtres = { sigle?: string | null; annee?: number | null; matiere?: string | null };

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
  return avecCopie(CLE_CATALOGUE, async () => {
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
    return sujets;
  });
}

export function filtrer(sujets: readonly Sujet[], f: Filtres): Sujet[] {
  return sujets.filter((s) => (!f.sigle || s.sigle === f.sigle) && (!f.annee || s.annee === f.annee) && (!f.matiere || s.matiere === f.matiere));
}

/** Valeurs proposées dans les filtres : écoles par nombre de sujets, années de la plus récente à la plus ancienne. */
export function optionsFiltres(sujets: readonly Sujet[], f: Filtres = {}): { sigles: string[]; annees: number[]; matieres: string[] } {
  const compte = new Map<string, number>();
  for (const s of sujets) if (s.sigle) compte.set(s.sigle, (compte.get(s.sigle) ?? 0) + 1);
  const sigles = [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
  const annees = [...new Set(filtrer(sujets, { sigle: f.sigle }).map((s) => s.annee).filter((a): a is number => !!a))].sort((a, b) => b - a);
  const matieres = [...new Set(sujets.map((s) => s.matiere).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'fr'));
  return { sigles, annees, matieres };
}

/** Ordre de la liste des sujets : année la plus récente d'abord, puis matière. */
export function trierSujets(sujets: readonly Sujet[]): Sujet[] {
  return [...sujets].sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0) || (a.matiere ?? a.titre).localeCompare(b.matiere ?? b.titre, 'fr'));
}

/** Liens du sujet et, si le droit est ouvert (sujet gratuit ou pass), de la correction (M6-02, M6-04). */
export async function lireSujet(client: Client, id: number): Promise<DetailSujet> {
  const { data, error } = await client.rpc('exam_paper', { p_paper: id });
  if (error) throw error;
  const l = (data as { paper_id: number; title: string; subject_url: string; has_correction: boolean; correction_free: boolean }[] | null)?.[0];
  if (!l) throw new Error('sujet introuvable');
  return { id: l.paper_id, titre: titreSujet(l.title), urlSujet: l.subject_url, aCorrection: !!l.has_correction, correctionGratuite: !!l.correction_free };
}

export type Concours = { id: string; nom: string; sigle: string; sujets: number };
export type Dossier = { id: string; nom: string; sousDossiers: number; documents: number };
/** Les adresses des PDF ne sont plus listées : `depenser_credits('document_pdf')` les donne (M18-04). */
export type Document = { id: string; nom: string; correctionId: string | null; tailleOctets?: number };

/** Concours du catalogue, du plus fourni au moins fourni : chaque concours est un dossier d'annales. */
export function concoursDuCatalogue(sujets: readonly Sujet[]): Concours[] {
  const parId = new Map<string, Concours>();
  for (const s of sujets) {
    const c = parId.get(s.concoursId) ?? { id: s.concoursId, nom: s.concours, sigle: s.sigle, sujets: 0 };
    c.sujets++;
    parId.set(s.concoursId, c);
  }
  return [...parId.values()].sort((a, b) => b.sujets - a.sujets || a.sigle.localeCompare(b.sigle));
}

/**
 * Nom lisible d'un document de classe : accents décomposés mal décodés (« Colle╠Çge » → « Collège »), extension et
 * tirets bas retirés.
 */
export function nomDocument(nom: string): string {
  return nom
    .replace(/╠Ç/g, '̀')
    .replace(/╠ü/g, '́')
    .replace(/╠é/g, '̂')
    .replace(/╠ê/g, '̈')
    .replace(/╠º/g, '̧')
    .normalize('NFC')
    .replace(/\.(pdf|docx?|pptx?|jpe?g|png)$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dossiers d'annales de la classe (racines, ou sous-dossiers de `parent`). */
export async function lireDossiers(client: Client, p: { niveau: string; pays: string; parent?: string | null }): Promise<Dossier[]> {
  return avecCopie(`annales.dossiers.${p.niveau}.${p.pays}.${p.parent ?? ''}`, async () => {
    const { data, error } = await client.rpc('class_document_folders', { p_level: p.niveau, p_country: p.pays, p_parent: p.parent ?? null });
    if (error) throw error;
    type Ligne = { folder_id: string; name: string; subfolders: number; documents: number };
    return ((data ?? []) as Ligne[]).filter((l) => l.documents > 0).map((l) => ({ id: l.folder_id, nom: nomDocument(l.name), sousDossiers: l.subfolders, documents: l.documents }));
  });
}

export async function lireDocuments(client: Client, dossier: string): Promise<Document[]> {
  return avecCopie(`annales.documents.${dossier}`, async () => {
    const { data, error } = await client.rpc('class_documents', { p_folder: dossier });
    if (error) throw error;
    type Ligne = { document_id: string; name: string; correction_id: string | null; size_bytes?: number | string | null };
    const tailleOctets = (taille: number | string | null | undefined): number | undefined => {
      const n = typeof taille === 'number' || typeof taille === 'string' ? Number(taille) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    return ((data ?? []) as Ligne[]).map((l) => ({
      id: l.document_id,
      nom: titreDocument(nomDocument(l.name)),
      correctionId: l.correction_id,
      ...(tailleOctets(l.size_bytes) ? { tailleOctets: tailleOctets(l.size_bytes) } : {}),
    }));
  });
}
