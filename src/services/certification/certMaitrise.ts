import { ecartJours, type Jour } from './jours';
import type { Reglages } from './reglages';

/** F3 / F4 : maîtrise pondérée par la récence. */
export type EtatMaitrise = 'pas_commencee' | 'fragile' | 'en_progres' | 'acquise';
export type ReponseMaitrise = { juste: boolean; jour: Jour; /** Rôle de la notion : principal 1, secondaire 0,5. */ poids?: number };
export type Maitrise = { m: number | null; reponses: number; reussies: number; etat: EtatMaitrise };

type Parametres = Pick<Reglages, 'maitriseDemiVieJours' | 'maitriseFragileSous' | 'maitriseAcquiseDe' | 'maitriseMinReponses'>;

export function etatMaitrise(m: number | null, reponses: number, r: Parametres): EtatMaitrise {
  if (m === null || reponses < r.maitriseMinReponses || reponses === 0) return 'pas_commencee';
  if (m < r.maitriseFragileSous) return 'fragile';
  if (m >= r.maitriseAcquiseDe) return 'acquise';
  return 'en_progres';
}

export function maitrise(reponses: ReponseMaitrise[], aujourdhui: Jour, r: Parametres): Maitrise {
  if (reponses.length === 0) return { m: null, reponses: 0, reussies: 0, etat: 'pas_commencee' };
  let num = 0;
  let den = 0;
  for (const x of reponses) {
    const age = Math.max(0, ecartJours(x.jour, aujourdhui));
    const w = (x.poids ?? 1) * Math.pow(0.5, age / r.maitriseDemiVieJours);
    num += x.juste ? w : 0;
    den += w;
  }
  const m = den === 0 ? null : num / den;
  const reussies = reponses.filter((x) => x.juste).length;
  return { m, reponses: reponses.length, reussies, etat: etatMaitrise(m, reponses.length, r) };
}
