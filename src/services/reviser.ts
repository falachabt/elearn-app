import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { matiere as couleursMatieres } from '@/theme/theme';

import { decoderContenu, normaliserBlocs, type Bloc } from './blocs';
import type { QuestionTiree } from './miniTest';
import { convertir, type LigneMission } from './mission';

type Client = Pick<SupabaseClient, 'rpc'>;

export type Cours = { id: number; nom: string; matiere: string; lecons: number };
export type Matiere = { nom: string; couleur: keyof typeof couleursMatieres | null; cours: Cours[]; lecons: number };
export type Lecon = { id: number; nom: string; minutes: number | null };
export type ContenuLecon = { id: number; coursId: number; nom: string; blocs: Bloc[] };
export type Fiche = { nom: string; blocs: Bloc[] };

const CLE_COURS = (niveau: string, pays: string) => `reviser.cours.${niveau}.${pays.toUpperCase()}`;
const CLE_LECONS = (cours: number) => `reviser.lecons.${cours}`;
const CLE_LECON = (lecon: number) => `reviser.lecon.${lecon}`;
const CLE_FICHE = (cours: number) => `reviser.fiche.${cours}`;
export const TAILLE_QUIZ_LECON = 3;
export const CLE_LUES = 'reviser.lues';
export const AUTRES = 'Autres';

/** Lecture réseau d'abord, puis copie locale : l'onglet reste utilisable hors ligne pour ce qui a déjà été ouvert (M5-03). */
async function avecCopie<T>(cle: string, lire: () => Promise<T>): Promise<T> {
  try {
    const valeur = await lire();
    await AsyncStorage.setItem(cle, JSON.stringify(valeur));
    return valeur;
  } catch (e) {
    const copie = await AsyncStorage.getItem(cle);
    if (copie) return JSON.parse(copie) as T;
    throw e;
  }
}

async function rpc<T>(client: Client, nom: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await client.rpc(nom, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

/** Couleur constante de la matière dans toute l'app (guide, section couleurs des matières). */
export function couleurMatiere(nom: string): Matiere['couleur'] {
  const n = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/math/.test(n)) return 'maths';
  if (/svt|vie et de la terre|biolog/.test(n)) return 'svt';
  if (/physique|chimie|technolog/.test(n)) return 'physique';
  if (/francais|litterature/.test(n)) return 'francais';
  if (/anglais|english|allemand|espagnol|langue/.test(n)) return 'anglais';
  if (/histoire|geograph|citoyen|civique|social/.test(n)) return 'histoireGeo';
  if (/philo/.test(n)) return 'philo';
  return null;
}

/** Nom court affiché sur la tuile (« Sciences de la Vie et de la Terre, … » → « SVT »). */
export function nomCourt(nom: string): string {
  const n = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/vie et de la terre/.test(n)) return 'SVT';
  if (/^langue francaise/.test(n)) return 'Français';
  if (/^mathematique$/.test(n)) return 'Maths';
  if (/^english language/.test(n)) return 'English';
  if (/^sciences physiques et technologie$/.test(n)) return 'Physique et techno';
  if (/^[A-Z]{2,4}$/.test(nom)) return nom;
  return nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase().replace(/ & /g, ' et ');
}

export async function lireCours(client: Client, p: { niveau: string; pays: string }): Promise<Cours[]> {
  return avecCopie(CLE_COURS(p.niveau, p.pays), async () => {
    const lignes = await rpc<{ course_id: number; name: string; subject: string | null; lessons: number }>(client, 'revision_courses', { p_level: p.niveau, p_country: p.pays });
    return lignes.map((l) => ({ id: l.course_id, nom: l.name.trim(), matiere: l.subject?.trim() || AUTRES, lecons: l.lessons }));
  });
}

/** Matières dans l'ordre : les plus fournies d'abord, « Autres » à la fin. */
export function regrouperParMatiere(cours: readonly Cours[]): Matiere[] {
  const parNom = new Map<string, Matiere>();
  for (const c of cours) {
    const cle = nomCourt(c.matiere);
    const m = parNom.get(cle) ?? { nom: cle, couleur: couleurMatiere(c.matiere), cours: [], lecons: 0 };
    m.cours.push(c);
    m.lecons += c.lecons;
    parNom.set(cle, m);
  }
  return [...parNom.values()].sort((a, b) => (a.nom === AUTRES ? 1 : b.nom === AUTRES ? -1 : b.cours.length - a.cours.length || b.lecons - a.lecons || a.nom.localeCompare(b.nom)));
}

export async function lireLecons(client: Client, cours: number): Promise<Lecon[]> {
  return avecCopie(CLE_LECONS(cours), async () => {
    const lignes = await rpc<{ lesson_id: number; name: string | null; reading_minutes: number | null }>(client, 'course_lessons', { p_course: cours });
    return lignes.map((l) => ({ id: l.lesson_id, nom: l.name?.trim() || '', minutes: l.reading_minutes }));
  });
}

export async function lireLecon(client: Client, lecon: number): Promise<ContenuLecon> {
  return avecCopie(CLE_LECON(lecon), async () => {
    const [l] = await rpc<{ lesson_id: number; course_id: number; name: string | null; content: unknown; content_compressed: string | null }>(client, 'lesson_content', { p_lesson: lecon });
    if (!l) throw new Error('leçon introuvable');
    return { id: l.lesson_id, coursId: l.course_id, nom: l.name?.trim() || '', blocs: normaliserBlocs(decoderContenu({ compresse: l.content_compressed, brut: l.content })) };
  });
}

/** Fiche résumé du cours (M5-02) ; null si le cours n'en a pas. */
export async function lireFiche(client: Client, cours: number): Promise<Fiche | null> {
  return avecCopie(CLE_FICHE(cours), async () => {
    const [f] = await rpc<{ name: string | null; content: unknown }>(client, 'course_summary', { p_course: cours });
    if (!f) return null;
    const blocs = normaliserBlocs(decoderContenu({ brut: f.content }));
    return blocs.length ? { nom: f.name?.trim() || '', blocs } : null;
  });
}

/** 3 questions pour vérifier une leçon, tirées des quiz du cours (M5-01) ; en ligne seulement. */
export async function lireQuizLecon(client: Client, p: { cours: number; lecon: number; vraiFaux: { vrai: string; faux: string } }): Promise<QuestionTiree[]> {
  const lignes = await rpc<LigneMission>(client, 'lesson_quiz', { p_course: p.cours, p_lesson: p.lecon, p_size: TAILLE_QUIZ_LECON });
  return lignes.map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => q !== null);
}

/** Leçons lues : identifiant de leçon → identifiant de cours, pour le « % vu » par matière. */
export async function lireLues(): Promise<Record<string, number>> {
  const brut = await AsyncStorage.getItem(CLE_LUES);
  return brut ? (JSON.parse(brut) as Record<string, number>) : {};
}

/** Leçon validée : au moins deux tiers de ses questions justes (2 sur 3). */
export function quizReussi(score: number, total: number): boolean {
  return total > 0 && score >= Math.ceil((total * 2) / 3);
}

/** Marque la leçon comme validée : elle compte alors dans la progression (questions réussies, ou leçon sans questions). */
export async function marquerLue(lecon: number, cours: number): Promise<void> {
  const lues = await lireLues();
  if (lues[lecon] === cours) return;
  await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ ...lues, [lecon]: cours }));
}

/** Part des leçons lues (0 à 100) pour une liste de cours. */
export function pourcentageVu(cours: readonly Cours[], lues: Record<string, number>): number {
  const total = cours.reduce((n, c) => n + c.lecons, 0);
  if (!total) return 0;
  const ids = new Set(cours.map((c) => c.id));
  const vues = Object.values(lues).filter((c) => ids.has(c)).length;
  return Math.min(100, Math.round((vues / total) * 100));
}
