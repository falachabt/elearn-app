import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'from'>;

/** Une vidéo de cours prête à être regardée (table `course_videos`, une ligne par partie). */
export type VideoCours = {
  id: number;
  cours: number;
  /** Titre nettoyé : le préfixe « Partie N — » en est retiré, il part dans `numero`. */
  titre: string;
  /** Numéro de partie déduit de l'ordre d'affichage (1 = première partie). */
  numero: number;
  dureeS: number | null;
  /** Adresse 720p : la qualité par défaut, pensée pour les forfaits limités. */
  url: string;
  url1080: string | null;
  miniature: string | null;
  ordre: number;
};

type LigneVideo = {
  id: number;
  course_id: number;
  title: string | null;
  duration: number | null;
  url: string;
  order_index: number;
  metadata: { url_1080?: string | null; miniature?: string | null } | null;
};

/**
 * Retire le préfixe « Partie N » (avec son séparateur —, – ou :) du titre servi par la base.
 * Les titres de la chaîne sont écrits « Partie 1 — Charge, champ… » : l'écran affiche le numéro
 * dans une étiquette séparée, donc le titre seul suffit. Sans préfixe reconnu, titre inchangé.
 */
export function titreSansPartie(titre: string): string {
  return titre.replace(/^\s*partie\s+\d+\s*[—–:-]\s*/i, '').trim() || titre.trim();
}

/** Lignes de la base → vidéos affichables : tri par `order_index`, numéro de partie = rang dans l'ordre. */
export function versVideos(lignes: readonly LigneVideo[]): VideoCours[] {
  return [...lignes]
    .sort((a, b) => a.order_index - b.order_index)
    .map((l, i) => ({
      id: l.id,
      cours: l.course_id,
      titre: titreSansPartie(l.title?.trim() || ''),
      numero: i + 1,
      dureeS: l.duration,
      url: l.url,
      url1080: l.metadata?.url_1080 ?? null,
      miniature: l.metadata?.miniature ?? null,
      ordre: l.order_index,
    }));
}

/** Vidéos prêtes d'un cours, dans l'ordre des parties. En ligne seulement (le hors ligne vidéo est un lot séparé). */
export async function lireVideos(client: Client, cours: number): Promise<VideoCours[]> {
  const { data, error } = await client
    .from('course_videos')
    .select('id, course_id, title, duration, url, order_index, metadata')
    .eq('course_id', cours)
    .eq('status', 'ready')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return versVideos((data ?? []) as LigneVideo[]);
}

/** Durée affichable « 3:19 » ; chaîne vide si la durée est inconnue. */
export function formaterDuree(secondes: number | null): string {
  if (secondes === null || !Number.isFinite(secondes) || secondes < 0) return '';
  const s = Math.round(secondes);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Une vidéo compte comme terminée à partir de 90 % regardés (ou à la fin explicite). */
export const SEUIL_TERMINEE = 0.9;

export function estTerminee(positionS: number, dureeS: number | null): boolean {
  return dureeS !== null && dureeS > 0 && positionS >= dureeS * SEUIL_TERMINEE;
}

/** Suivi local d'une vidéo : où l'élève s'est arrêté, et s'il l'a terminée. */
export type SuiviVideo = { positionS: number; dureeS: number | null; terminee: boolean; quand: number };
export type SuivisVideos = Record<string, SuiviVideo>;

export const CLE_SUIVIS_VIDEOS = 'videos.suivis';
export const CLE_DERNIERE_VIDEO = 'videos.derniere';

export async function lireSuivis(): Promise<SuivisVideos> {
  try {
    const brut = await AsyncStorage.getItem(CLE_SUIVIS_VIDEOS);
    return brut ? (JSON.parse(brut) as SuivisVideos) : {};
  } catch {
    return {};
  }
}

async function ecrireSuivis(suivis: SuivisVideos): Promise<void> {
  await AsyncStorage.setItem(CLE_SUIVIS_VIDEOS, JSON.stringify(suivis)).catch(() => {});
}

/**
 * Note la position courante d'une vidéo. `terminee` est collant : une vidéo terminée puis relancée
 * depuis le début reste terminée dans les compteurs, seule sa position de reprise repart.
 */
export async function noterPosition(video: number, positionS: number, dureeS: number | null, maintenant = Date.now()): Promise<SuiviVideo> {
  const suivis = await lireSuivis();
  const avant = suivis[video];
  const suivi: SuiviVideo = {
    positionS: Math.max(0, Math.round(positionS)),
    dureeS: dureeS ?? avant?.dureeS ?? null,
    terminee: avant?.terminee === true || estTerminee(positionS, dureeS ?? avant?.dureeS ?? null),
    quand: maintenant,
  };
  suivis[video] = suivi;
  await ecrireSuivis(suivis);
  return suivi;
}

/** Marque explicitement une vidéo comme terminée (fin de lecture atteinte). */
export async function marquerTerminee(video: number, dureeS: number | null, maintenant = Date.now()): Promise<void> {
  const suivis = await lireSuivis();
  const avant = suivis[video];
  suivis[video] = {
    positionS: dureeS ?? avant?.positionS ?? 0,
    dureeS: dureeS ?? avant?.dureeS ?? null,
    terminee: true,
    quand: maintenant,
  };
  await ecrireSuivis(suivis);
}

/** Dernière vidéo ouverte, toutes matières confondues : sert au carrousel (par cours) et, plus tard, à « Reprendre ». */
export type DerniereVideo = { video: number; cours: number; quand: number };

export async function noterDerniereVideo(d: Omit<DerniereVideo, 'quand'>, maintenant = Date.now()): Promise<void> {
  await AsyncStorage.setItem(CLE_DERNIERE_VIDEO, JSON.stringify({ ...d, quand: maintenant })).catch(() => {});
}

export async function lireDerniereVideo(): Promise<DerniereVideo | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_DERNIERE_VIDEO);
    return brut ? (JSON.parse(brut) as DerniereVideo) : null;
  } catch {
    return null;
  }
}

/**
 * Indice de la vidéo à mettre en avant dans le carrousel : la dernière regardée de CE cours si elle
 * n'est pas terminée (on reprend où on s'était arrêté), sinon la première partie.
 */
export function indiceCarrousel(videos: readonly VideoCours[], suivis: SuivisVideos, derniere: DerniereVideo | null): number {
  if (!derniere) return 0;
  const i = videos.findIndex((v) => v.id === derniere.video);
  if (i < 0) return 0;
  return suivis[derniere.video]?.terminee ? 0 : i;
}

/** Nombre de vidéos terminées d'une liste, pour l'en-tête « Vidéos · n / total ». */
export function compterTerminees(videos: readonly VideoCours[], suivis: SuivisVideos): number {
  return videos.filter((v) => suivis[v.id]?.terminee).length;
}
