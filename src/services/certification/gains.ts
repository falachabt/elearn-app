import { obtenirApi } from './api';
import { jourDe } from './jours';
import type { CodeGain, EtatGains, ResultatGain } from './types';

export const lireGains = (exam: string): Promise<EtatGains> => obtenirApi().lireGains(exam, jourDe(new Date()));

/** Réclame un gain. Le serveur décide (plafond, éligibilité, une fois par jour ou par compte) : l'app ne calcule rien. */
export const reclamerGain = (code: CodeGain, exam: string): Promise<ResultatGain> => obtenirApi().reclamerGain(code, exam, jourDe(new Date()));
