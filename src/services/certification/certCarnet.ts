import { jourPlus, type Jour } from './jours';
import type { Reglages } from './reglages';

/** F5 : carnet de mots, boîtes de Leitner. */
export type MotCarnet = { motId: string; boite: 1 | 2 | 3 | 4; prochaineRevue: Jour; vus: number; bons: number; mauvais: number };
export type EtatMot = 'a_revoir' | 'en_cours' | 'connu';

type Delais = Pick<Reglages, 'delaisBoitesJours'>;

export const etatMot = (boite: number): EtatMot => (boite === 1 ? 'a_revoir' : boite === 4 ? 'connu' : 'en_cours');

export function nouveauMot(motId: string, jour: Jour, r: Delais): MotCarnet {
  return { motId, boite: 1, prochaineRevue: jourPlus(jour, r.delaisBoitesJours[0]), vus: 0, bons: 0, mauvais: 0 };
}

/** Réussite : boîte + 1 (4 au plus) ; échec : boîte 1. */
export function appliquerResultatMot(mot: MotCarnet, connu: boolean, jour: Jour, r: Delais): MotCarnet {
  const boite = (connu ? Math.min(4, mot.boite + 1) : 1) as 1 | 2 | 3 | 4;
  return {
    ...mot,
    boite,
    prochaineRevue: jourPlus(jour, r.delaisBoitesJours[boite - 1]),
    vus: mot.vus + 1,
    bons: mot.bons + (connu ? 1 : 0),
    mauvais: mot.mauvais + (connu ? 0 : 1),
  };
}

export const motEchu = (mot: MotCarnet, aujourdhui: Jour): boolean => mot.prochaineRevue <= aujourdhui;

/** Séance de mots : mots échus, boîte croissante puis échéance la plus ancienne, `taille` au plus. */
export function composerSeanceMots(mots: MotCarnet[], aujourdhui: Jour, taille: number): MotCarnet[] {
  return mots
    .filter((m) => motEchu(m, aujourdhui))
    .sort((a, b) => a.boite - b.boite || (a.prochaineRevue < b.prochaineRevue ? -1 : a.prochaineRevue > b.prochaineRevue ? 1 : 0))
    .slice(0, taille);
}

export function compterBoites(mots: MotCarnet[]): Record<EtatMot, number> {
  const c: Record<EtatMot, number> = { a_revoir: 0, en_cours: 0, connu: 0 };
  for (const m of mots) c[etatMot(m.boite)]++;
  return c;
}
