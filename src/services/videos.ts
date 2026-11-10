import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Directory, File, Paths } from 'expo-file-system';

type Client = Pick<SupabaseClient, 'from'>;

/** Une vidéo de cours prête à être regardée (table `course_videos`, une ligne par partie). */
export type VideoCours = {
  /** Identifiant de la ligne `course_videos` : un uuid, pas un entier. */
  id: string;
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
  id: string;
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

/** Suivi d'une vidéo : où l'élève s'est arrêté, s'il l'a terminée, et dans quel cours (pour l'historique et la synchro). */
export type SuiviVideo = { positionS: number; dureeS: number | null; terminee: boolean; quand: number; cours: number };
export type SuivisVideos = Record<string, SuiviVideo>;

export const CLE_SUIVIS_VIDEOS = 'videos.suivis';
export const CLE_DERNIERE_VIDEO = 'videos.derniere';

export async function lireSuivis(): Promise<SuivisVideos> {
  try {
    const brut = await AsyncStorage.getItem(CLE_SUIVIS_VIDEOS);
    if (!brut) return {};
    const lu = JSON.parse(brut) as Record<string, Partial<SuiviVideo>>;
    // Les entrées du lot 1 n'avaient pas encore le cours : on le remet à 0 (inconnu) plutôt que de les perdre.
    return Object.fromEntries(
      Object.entries(lu).map(([id, s]) => [
        id,
        { positionS: s.positionS ?? 0, dureeS: s.dureeS ?? null, terminee: s.terminee === true, quand: s.quand ?? 0, cours: s.cours ?? 0 },
      ]),
    );
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
export async function noterPosition(video: string, cours: number, positionS: number, dureeS: number | null, maintenant = Date.now()): Promise<SuiviVideo> {
  const suivis = await lireSuivis();
  const avant = suivis[video];
  const suivi: SuiviVideo = {
    positionS: Math.max(0, Math.round(positionS)),
    dureeS: dureeS ?? avant?.dureeS ?? null,
    terminee: avant?.terminee === true || estTerminee(positionS, dureeS ?? avant?.dureeS ?? null),
    quand: maintenant,
    cours,
  };
  suivis[video] = suivi;
  await ecrireSuivis(suivis);
  return suivi;
}

/** Marque explicitement une vidéo comme terminée (fin de lecture atteinte). */
export async function marquerTerminee(video: string, cours: number, dureeS: number | null, maintenant = Date.now()): Promise<void> {
  const suivis = await lireSuivis();
  const avant = suivis[video];
  suivis[video] = {
    positionS: dureeS ?? avant?.positionS ?? 0,
    dureeS: dureeS ?? avant?.dureeS ?? null,
    terminee: true,
    quand: maintenant,
    cours,
  };
  await ecrireSuivis(suivis);
}

/** Dernière vidéo ouverte, toutes matières confondues : sert au carrousel (par cours) et, plus tard, à « Reprendre ». */
export type DerniereVideo = { video: string; cours: number; quand: number };

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

// ---------------------------------------------------------------------------
// Synchronisation avec le serveur (lot 2) : table `video_progress`, une ligne
// par élève et par vidéo. Le local reste la source rapide ; le serveur suit
// l'élève entre appareils. Conflit : la ligne la plus récente gagne
// (`derniere_vue` côté serveur, `quand` côté téléphone — même horloge).
// ---------------------------------------------------------------------------

type ClientSynchro = Pick<SupabaseClient, 'from' | 'auth'>;

export type LigneProgression = {
  video_id: string;
  course_id: number;
  position_s: number;
  duree_s: number | null;
  terminee: boolean;
  derniere_vue: string;
};

export function suiviDepuisLigne(l: LigneProgression): SuiviVideo {
  return {
    positionS: l.position_s,
    dureeS: l.duree_s,
    terminee: l.terminee,
    quand: Date.parse(l.derniere_vue) || 0,
    cours: l.course_id,
  };
}

export function ligneDepuisSuivi(video: string, s: SuiviVideo): LigneProgression {
  return {
    video_id: video,
    course_id: s.cours,
    position_s: s.positionS,
    duree_s: s.dureeS,
    terminee: s.terminee,
    derniere_vue: new Date(s.quand).toISOString(),
  };
}

/** Fusion local + serveur : pour chaque vidéo, l'enregistrement le plus récent gagne. */
export function fusionnerSuivis(locaux: SuivisVideos, serveur: readonly LigneProgression[]): SuivisVideos {
  const sortie: SuivisVideos = { ...locaux };
  for (const l of serveur) {
    const distant = suiviDepuisLigne(l);
    const local = sortie[l.video_id];
    if (!local || distant.quand > local.quand) sortie[l.video_id] = distant;
    else if (local && distant.quand === local.quand) sortie[l.video_id] = { ...local, terminee: local.terminee || distant.terminee };
  }
  return sortie;
}

/** Lignes locales à envoyer : absentes du serveur ou plus récentes que lui (le cours doit être connu). */
export function lignesAEnvoyer(locaux: SuivisVideos, serveur: readonly LigneProgression[], userId: string): (LigneProgression & { user_id: string })[] {
  const parVideo = new Map(serveur.map((l) => [l.video_id, Date.parse(l.derniere_vue) || 0]));
  return Object.entries(locaux)
    .filter(([video, s]) => s.cours > 0 && s.quand > (parVideo.get(video) ?? -1))
    .map(([video, s]) => ({ user_id: userId, ...ligneDepuisSuivi(video, s) }));
}

// ---------------------------------------------------------------------------
// Hors-ligne vidéo (lot 4) : téléchargement EXPLICITE, vidéo par vidéo, en 720p
// uniquement — jamais dans le pack hors-ligne complet (trop lourd). Les fichiers
// vivent dans le dossier privé de l'app (même patron que les documents), et un
// petit index AsyncStorage dit lesquelles sont là. L'index est un état de
// téléchargement, pas un contenu : il n'est pas soumis à l'expiration des
// contenus hors ligne (comme l'index des documents). La position, elle, est
// déjà locale (suivi) et synchronisée au retour du réseau par le lot 2.
// ---------------------------------------------------------------------------

const CLE_TELECHARGEES = 'videos.telechargees';

const dossierVideos = () => new Directory(Paths.document, 'videos');

/** Nom de fichier d'une vidéo téléchargée : son identifiant (uuid), stable. */
export function nomFichierVideo(video: string): string {
  return `${video}.mp4`;
}

function fichierVideo(video: string): File {
  const d = dossierVideos();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return new File(d, nomFichierVideo(video));
}

/** L'adresse locale de la vidéo si elle est téléchargée (et non vide), sinon null : le lecteur la préfère au flux. */
export function videoLocale(video: string): string | null {
  try {
    const f = fichierVideo(video);
    return f.exists && f.size > 0 ? f.uri : null;
  } catch {
    return null;
  }
}

export type VideoTelechargee = { cours: number; titre: string; numero: number; taille: number; le: string };

async function lireIndexTelechargees(): Promise<Record<string, VideoTelechargee>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_TELECHARGEES);
    return brut ? (JSON.parse(brut) as Record<string, VideoTelechargee>) : {};
  } catch {
    return {};
  }
}

/** Les vidéos téléchargées dont le fichier est encore là, par identifiant de vidéo. */
export async function lireTelechargees(): Promise<Record<string, VideoTelechargee>> {
  const index = await lireIndexTelechargees();
  return Object.fromEntries(Object.entries(index).filter(([id]) => videoLocale(id)));
}

/** Télécharge une vidéo (720p) sur le téléphone et l'inscrit dans l'index. Échoue sans rien inscrire si le fichier est vide. */
export async function telechargerVideo(v: VideoCours): Promise<void> {
  const fichier = await File.downloadFileAsync(encodeURI(v.url), fichierVideo(v.id), { idempotent: true });
  if (fichier.size <= 0) throw new Error('téléchargement vidéo vide');
  const index = await lireIndexTelechargees();
  index[v.id] = { cours: v.cours, titre: v.titre, numero: v.numero, taille: fichier.size, le: new Date().toISOString() };
  await AsyncStorage.setItem(CLE_TELECHARGEES, JSON.stringify(index));
}

/** Télécharge toutes les vidéos d'un cours qui ne le sont pas encore, l'une après l'autre ; renvoie combien ont été gardées. */
export async function telechargerVideos(videos: readonly VideoCours[]): Promise<number> {
  let n = 0;
  for (const v of videos) {
    if (videoLocale(v.id)) continue;
    try {
      await telechargerVideo(v);
      n++;
    } catch {
      // Une vidéo en échec n'empêche pas les autres.
    }
  }
  return n;
}

/** Retire une vidéo téléchargée du téléphone (fichier et index). */
export async function supprimerVideoTelechargee(video: string): Promise<void> {
  try {
    const f = fichierVideo(video);
    if (f.exists) f.delete();
  } catch {
    // Déjà absente.
  }
  const index = await lireIndexTelechargees();
  delete index[video];
  await AsyncStorage.setItem(CLE_TELECHARGEES, JSON.stringify(index));
}
/**
 * Met en commun le suivi du téléphone et celui du compte : les positions du compte reviennent sur le
 * téléphone (autre appareil), celles du téléphone partent au serveur. Sans réseau ou sans session,
 * rien ne change et le local est rendu tel quel (même patron que `synchroniserLues`).
 */
export async function synchroniserSuivis(client: ClientSynchro): Promise<SuivisVideos> {
  const locaux = await lireSuivis();
  try {
    const { data: session } = await client.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) return locaux;
    const { data, error } = await client.from('video_progress').select('video_id, course_id, position_s, duree_s, terminee, derniere_vue');
    if (error) throw error;
    const serveur = (data ?? []) as LigneProgression[];
    const aEnvoyer = lignesAEnvoyer(locaux, serveur, userId);
    if (aEnvoyer.length) {
      const { error: erreurEnvoi } = await client.from('video_progress').upsert(aEnvoyer, { onConflict: 'user_id,video_id' });
      if (erreurEnvoi) throw erreurEnvoi;
    }
    // Relecture juste avant d'écrire : une position notée pendant l'attente du serveur ne doit pas être écrasée.
    const fusion = fusionnerSuivis(await lireSuivis(), serveur);
    await ecrireSuivis(fusion);
    return fusion;
  } catch {
    return locaux;
  }
}
