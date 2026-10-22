import type { CleTexte } from '@/i18n';

import type { DefTest, TypeDefTest } from './types';

/** Statut d'une ligne de liste (v38) : écrit en mots, jamais la couleur seule. */
export type StatutLigneTest = 'pas_fait' | 'commence' | 'fait';

export function statutLigne(t: DefTest): StatutLigneTest {
  if (t.fini) return 'fait';
  return t.tentatives > 0 ? 'commence' : 'pas_fait';
}

/** Meilleur score de la section (maquette v38) : le plus haut des meilleurs scores finis du type, ou null. */
export function meilleurDeSection(tests: DefTest[]): number | null {
  const scores = tests.map((t) => t.meilleurScoreMax).filter((s): s is number => s !== null);
  return scores.length ? Math.max(...scores) : null;
}

/** Nombre de tests faits sur le total du type (« Fait : 2 sur 6 »). */
export function nombreFaits(tests: DefTest[]): number {
  return tests.filter((t) => t.fini).length;
}

/**
 * « Conseillé » : le premier test non fini du type (contour jaune, maquette v38). Quand tout est fini, rien n'est conseillé.
 */
export function testConseille(tests: DefTest[]): DefTest | null {
  return tests.find((t) => !t.fini) ?? null;
}

/** Le titre de la liste selon le type, sans texte en dur dans l'écran : la clé i18n est renvoyée. */
export const CLE_TITRE_LISTE: Record<TypeDefTest, CleTexte> = {
  listening: 'certification.tests.listes.titreEcoute',
  reading: 'certification.tests.listes.titreLecture',
  full: 'certification.tests.listes.titreComplet',
};

/** Libellé d'une ligne numérotée (« Écoute n° 1 »), par type. */
export const CLE_NUMERO_LIGNE: Record<TypeDefTest, CleTexte> = {
  listening: 'certification.tests.listes.numeroEcoute',
  reading: 'certification.tests.listes.numeroLecture',
  full: 'certification.tests.listes.numeroComplet',
};
