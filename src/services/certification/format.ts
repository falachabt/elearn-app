import type { Jour } from './jours';

/** 120 → « 2 h », 45 → « 45 min », 90 → « 1 h 30 ». */
export function formaterDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`;
}

export type DateAnalysee = { ok: true; jour: Jour | null } | { ok: false; erreur: 'format' | 'passe' };

/**
 * Date du test saisie « JJ/MM/AAAA » (facultative : vide = pas de date). Refuse un format faux, un jour inexistant
 * (31/02) et une date passée (le jour même reste permis, comme `cert_set_plan`).
 */
export function analyserDateSaisie(texte: string, aujourdhui: Jour): DateAnalysee {
  const brut = texte.trim();
  if (!brut) return { ok: true, jour: null };
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(brut);
  if (!m) return { ok: false, erreur: 'format' };
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return { ok: false, erreur: 'format' };
  const jour = `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  return jour < aujourdhui ? { ok: false, erreur: 'passe' } : { ok: true, jour };
}

/** Jour ISO → « JJ/MM/AAAA ». */
export const afficherJour = (jour: Jour): string => jour.split('-').reverse().join('/');

/** Score visé saisi : entier dans les bornes du serveur (F9), sinon `null`. */
export function analyserObjectif(texte: string, min: number, max: number): number | null {
  if (!/^\d{1,4}$/.test(texte.trim())) return null;
  const v = Number(texte);
  return v >= min && v <= max ? v : null;
}

/** « 4 min 10 » : temps restant d'un test interrompu (T3). */
export function minutesSecondes(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} min ${String(s).padStart(2, '0')}`;
}

/** « 04:10 » : chronomètre de l'écran d'examen. */
export function chronometre(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
