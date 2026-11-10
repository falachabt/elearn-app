import { jourPlus, type Jour } from './jours';
import type { Reglages } from './reglages';

/** F6 : rejeu espacé des questions ratées. */
export type EtatRejeu = { prochaineRevue: Jour | null; serie: number };
type Parametres = Pick<Reglages, 'delaisRejeuJours' | 'rejeuRetraitApres'>;

/**
 * Une erreur planifie la question au premier délai ; une réussite d'une question au rejeu l'espace, et `rejeuRetraitApres`
 * réussites de suite la retirent. Une réussite d'une question qui n'est pas au rejeu ne change rien.
 */
export function etatRejeuApres(avant: EtatRejeu | null, juste: boolean, jour: Jour, r: Parametres): EtatRejeu {
  if (!juste) return { prochaineRevue: jourPlus(jour, r.delaisRejeuJours[0]), serie: 0 };
  if (!avant || avant.prochaineRevue === null) return { prochaineRevue: null, serie: 0 };
  const serie = avant.serie + 1;
  if (serie >= r.rejeuRetraitApres) return { prochaineRevue: null, serie };
  return { prochaineRevue: jourPlus(jour, r.delaisRejeuJours[Math.min(serie, r.delaisRejeuJours.length - 1)]), serie };
}

export const rejeuEchu = (etat: EtatRejeu, aujourdhui: Jour): boolean => etat.prochaineRevue !== null && etat.prochaineRevue <= aujourdhui;
