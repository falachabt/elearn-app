import { urlMedia } from './media';
import { chargerDonneesRevision } from './revision';

/** Vidéo explicative d'une notion TOEIC (en anglais, sous-titrée dans l'image), servie depuis R2 : `toeic/videos/<code>/`. */
export type VideoNotion = {
  code: string;
  /** Flux 720p. */
  url: string;
  miniature: string | null;
  /** Durée en secondes, lue dans `meta.json` (absente : null). */
  dureeS: number | null;
};

const DELAI_MS = 6000;
/** Réponses sûres seulement : une notion avec vidéo ou sans vidéo (404). Une erreur réseau n'est jamais mémorisée. */
const memoire = new Map<string, VideoNotion | null>();

/** Adresse d'un fichier de la vidéo d'une notion, ou null si l'hôte des médias est coupé. */
export function adresseVideoNotion(code: string, fichier: 'meta.json' | 'video-720.mp4' | 'miniature.jpg'): string | null {
  if (!/^[a-z0-9_]+$/.test(code)) return null;
  return urlMedia(`toeic/videos/${code}/${fichier}`);
}

export function oublierVideosNotions(): void {
  memoire.clear();
}

/**
 * Cherche la vidéo d'une notion : `meta.json` présent = vidéo publiée (il est envoyé en dernier). Renvoie null quand la
 * notion n'a pas de vidéo, mais aussi hors ligne ou en cas d'erreur : la fiche s'affiche alors dépliée, comme avant.
 */
export async function chargerVideoNotion(code: string): Promise<VideoNotion | null> {
  if (memoire.has(code)) return memoire.get(code) ?? null;
  const meta = adresseVideoNotion(code, 'meta.json');
  const url = adresseVideoNotion(code, 'video-720.mp4');
  if (!meta || !url || typeof fetch !== 'function') return null;
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), DELAI_MS);
  try {
    const reponse = await fetch(meta, { signal: arret.signal });
    if (reponse.status === 404 || reponse.status === 403) {
      memoire.set(code, null);
      return null;
    }
    if (!reponse.ok) return null;
    const donnees = (await reponse.json()) as { duree?: unknown };
    const duree = typeof donnees.duree === 'number' && donnees.duree > 0 ? donnees.duree : null;
    const video: VideoNotion = { code, url, miniature: adresseVideoNotion(code, 'miniature.jpg'), dureeS: duree };
    memoire.set(code, video);
    return video;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

let codes: Promise<Map<string, string>> | null = null;

/** Code d'une notion (nom du dossier vidéo) d'après son identifiant, lu dans la liste des notions. Null si inconnue. */
export async function codeDeNotion(id: string): Promise<string | null> {
  if (!codes) {
    codes = chargerDonneesRevision()
      .then((d) => new Map(d.revision.notions.map((n) => [n.id, n.code] as const)))
      .catch(() => {
        codes = null;
        return new Map<string, string>();
      });
  }
  return (await codes).get(id) ?? null;
}

/** Pour les tests. */
export function oublierCodesNotions(): void {
  codes = null;
}
