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
  | { type: 'reprendre' };

export const etatInitial: EtatLecteur = { phase: 'pret', position: 0, duree: 0, jouee: false };

export function reduireLecteur(etat: EtatLecteur, e: EvenementLecteur, unique: boolean): EtatLecteur {
  switch (e.type) {
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
