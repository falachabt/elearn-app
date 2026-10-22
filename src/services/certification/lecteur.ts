/**
 * Machine d'état du lecteur audio (B8). Pure : l'adaptateur `expo-audio` envoie des évènements, l'écran lit l'état.
 * Écoute unique (diagnostic, mode examen) : une fois la piste jouée jusqu'au bout, plus de lecture.
 */
export type PhaseLecteur = 'pret' | 'chargement' | 'lecture' | 'pause' | 'fini' | 'erreur';
export type EtatLecteur = { phase: PhaseLecteur; position: number; duree: number; jouee: boolean };
export type EvenementLecteur =
  | { type: 'jouer' }
  | { type: 'pause' }
  | { type: 'statut'; chargee: boolean; enLecture: boolean; position: number; duree: number; termine: boolean }
  | { type: 'erreur' }
  | { type: 'reprendre' }
  | { type: 'reinitialiser' };

export const etatInitial: EtatLecteur = { phase: 'pret', position: 0, duree: 0, jouee: false };

export function reduireLecteur(etat: EtatLecteur, e: EvenementLecteur, unique: boolean): EtatLecteur {
  switch (e.type) {
    case 'reinitialiser':
      // Nouvelle piste (question suivante) : rien de l'ancienne lecture ne doit rester à l'écran.
      return etatInitial;
    case 'jouer':
      if (unique && etat.jouee) return etat;
      return etat.phase === 'lecture' ? etat : { ...etat, phase: etat.phase === 'pret' || etat.phase === 'erreur' ? 'chargement' : 'lecture' };
    case 'pause':
      return etat.phase === 'lecture' ? { ...etat, phase: 'pause' } : etat;
    case 'reprendre':
      // Après une erreur, « Reprendre la lecture » repart de la position gardée (±1 s).
      return etat.phase === 'erreur' ? { ...etat, phase: 'chargement' } : etat;
    case 'erreur':
      return { ...etat, phase: 'erreur' };
    case 'statut': {
      if (e.termine) return { phase: 'fini', position: e.duree, duree: e.duree, jouee: true };
      if (etat.phase === 'erreur' || etat.phase === 'fini' || etat.phase === 'pret') return etat;
      if (e.enLecture) return { phase: 'lecture', position: e.position, duree: e.duree, jouee: etat.jouee };
      if (e.chargee && etat.phase === 'chargement') return { ...etat, duree: e.duree };
      return { ...etat, position: e.position || etat.position, duree: e.duree || etat.duree };
    }
  }
}

/** « 0:18 » */
export function formaterTemps(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Adresse raccourcie pour le diagnostic affiché à l'élève (fin du chemin, pas de domaine). */
export function adresseCourte(uri: string): string {
  const chemin = uri.split('?')[0] ?? uri;
  return chemin.length > 40 ? `…${chemin.slice(-40)}` : chemin;
}

/** Dernier état que le lecteur natif a renvoyé, résumé pour le diagnostic (chargé, position, durée). */
export type StatutNatif = { isLoaded: boolean; playing: boolean; currentTime: number; duration: number };

/** « chargé oui · position 0,0 s / 3,1 s » : ce que le lecteur natif a réellement rapporté. */
export function resumeStatut(s: StatutNatif | null): string {
  if (!s) return 'aucun statut reçu';
  const decimale = (n: number) => n.toFixed(1).replace('.', ',');
  return `chargé ${s.isLoaded ? 'oui' : 'non'} · position ${decimale(s.currentTime)} s / ${decimale(s.duration)} s`;
}

/**
 * Code de diagnostic d'un échec de chargement : statut HTTP de la piste, ou « réseau » si la requête ne répond pas.
 * Une demande d'un seul octet (Range) : le fichier n'est pas téléchargé en entier.
 */
export async function diagnosticAudio(uri: string): Promise<string> {
  try {
    const reponse = await fetch(uri, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return `HTTP ${reponse.status} · ${adresseCourte(uri)}`;
  } catch {
    return `réseau · ${adresseCourte(uri)}`;
  }
}
