import type { MotCarnetServi } from './types';

export type PropositionMot = { texte: string; juste: boolean };

/** Hachage court et stable : même mot, mêmes propositions à chaque ouverture de la séance. */
function rang(graine: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < graine.length; i += 1) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Séance de mots en QCM (v32) : le sens juste et jusqu'à trois sens tirés des autres mots du carnet, dans un ordre
 * stable. Un sens identique au juste n'est jamais proposé en distracteur.
 */
export function propositionsMot(carte: MotCarnetServi, autres: MotCarnetServi[], maximum = 4): PropositionMot[] {
  const distracteurs = [...new Set(autres.filter((m) => m.id !== carte.id).map((m) => m.definition))]
    .filter((d) => d !== carte.definition)
    .sort((a, b) => rang(carte.id + a) - rang(carte.id + b))
    .slice(0, Math.max(0, maximum - 1))
    .map((texte) => ({ texte, juste: false }));
  const toutes = [{ texte: carte.definition, juste: true }, ...distracteurs];
  return toutes.sort((a, b) => rang(carte.id + a.texte) - rang(carte.id + b.texte));
}
