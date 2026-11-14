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
  mini: 'certification.tests.listes.titreMiniPartie',
  mixed: 'certification.tests.listes.titreMixte',
};

/** Libellé d'une ligne numérotée (« Écoute n° 1 »), par type. */
export const CLE_NUMERO_LIGNE: Record<TypeDefTest, CleTexte> = {
  listening: 'certification.tests.listes.numeroEcoute',
  reading: 'certification.tests.listes.numeroLecture',
  full: 'certification.tests.listes.numeroComplet',
  mini: 'certification.tests.listes.numeroMiniPartie',
  mixed: 'certification.tests.listes.numeroMixte',
};

/** Parties du TOEIC, de 1 à 7 : les mini-tests se choisissent par partie (maquette v39, TOEIC-V34-CHOIX-PARTIE). */
export const PARTIES = [1, 2, 3, 4, 5, 6, 7] as const;

/** Tests d'une partie, dans l'ordre de leur numéro. */
export function testsDeLaPartie(tests: DefTest[], partie: number): DefTest[] {
  return tests.filter((t) => t.part === partie).sort((a, b) => a.numero - b.numero);
}

/**
 * Numéro affiché dans une partie (« Partie 5 n° 1 à n° 4 ») : le rang du test parmi les tests de sa partie, à partir de 1.
 * Le numéro serveur est global au type et ne se voit pas.
 */
export function numeroDansPartie(tests: DefTest[], test: DefTest): number {
  const rang = testsDeLaPartie(tests, test.part ?? 0).findIndex((t) => t.id === test.id);
  return rang + 1;
}

/** Synthèse d'une partie sur l'écran de choix : tests faits, total et questions nouvelles pour l'élève. */
export type SynthesePartie = { partie: number; faits: number; total: number; nouvelles: number; conseillee: boolean };

/**
 * « Conseillé » : la partie qui a le plus de questions nouvelles pour l'élève, parmi les parties qui ont encore un test
 * non fait. À égalité, la plus petite partie. Quand tout est fait, aucune partie n'est conseillée.
 */
export function synthesesParties(tests: DefTest[]): SynthesePartie[] {
  const lignes = PARTIES.map((partie) => {
    const deLaPartie = testsDeLaPartie(tests, partie);
    return {
      partie,
      faits: deLaPartie.filter((t) => t.fini).length,
      total: deLaPartie.length,
      nouvelles: deLaPartie.filter((t) => !t.fini).reduce((somme, t) => somme + t.nouvellesQuestions, 0),
      encore: deLaPartie.some((t) => !t.fini),
    };
  });
  const candidates = lignes.filter((l) => l.encore);
  const meilleure = candidates.reduce<number | null>((max, l) => (max === null || l.nouvelles > max ? l.nouvelles : max), null);
  const conseillee = candidates.find((l) => l.nouvelles === meilleure)?.partie ?? null;
  return lignes.map(({ encore: _encore, ...l }) => ({ ...l, conseillee: l.partie === conseillee }));
}

/**
 * Score affichable d'un test composé (cahier D-55, D-58) : toujours « x sur n », jamais au-dessus de son maximum.
 * - mini par partie : bonnes réponses sur le nombre de questions du test ;
 * - mixte : bonnes réponses sur ses questions (« 13 sur 20 »). Un ancien score estimé sur 990 (valeur au-dessus du
 *   nombre de questions) reste lisible sur le total, sans inventer de « 13 sur 990 » ;
 * - demi-test : score de section sur la moitié du total (495) ;
 * - test complet : score sur le total (990).
 * Une valeur au-dessus du maximum de sa section est ramenée à ce maximum : l'écran ne montre jamais « 705 sur 495 ».
 * `objectifMax` est le score maximal de l'examen (990) ; `null` quand les réglages ne sont pas connus.
 */
export function scoreBorne(kind: TypeDefTest, score: number | null, questions: number, objectifMax: number | null): { valeur: number; max: number } | null {
  if (score === null) return null;
  let max: number | null;
  if (kind === 'mini') max = questions;
  else if (kind === 'mixed') max = score <= questions || objectifMax === null ? questions : objectifMax;
  else if (kind === 'listening' || kind === 'reading') max = objectifMax === null ? null : objectifMax / 2;
  else max = objectifMax;
  if (max === null) return null;
  return { valeur: Math.max(0, Math.min(score, max)), max };
}

/** Avancement « x faits sur n » d'un ensemble de tests du même type (D-57) ; `null` quand la liste n'est pas connue ou vide. */
export function avancement(tests: DefTest[] | null | undefined): { faits: number; total: number } | null {
  if (!tests || tests.length === 0) return null;
  return { faits: nombreFaits(tests), total: tests.length };
}
