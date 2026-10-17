/** Jours locaux au format AAAA-MM-JJ : les formules du cahier TOEIC comptent en jours calendaires de l'appareil (F8). */
export type Jour = string;

const MS_JOUR = 86_400_000;

function enUtc(jour: Jour): number {
  const [a, m, j] = jour.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

export function jourDe(date: Date): Jour {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Lundi de la semaine (lundi à dimanche) qui contient le jour. */
export function lundiDe(jour: Jour): Jour {
  const dow = (new Date(enUtc(jour)).getUTCDay() + 6) % 7;
  return jourPlus(jour, -dow);
}

export function jourPlus(jour: Jour, jours: number): Jour {
  const d = new Date(enUtc(jour) + jours * MS_JOUR);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function ecartJours(a: Jour, b: Jour): number {
  return Math.round((enUtc(b) - enUtc(a)) / MS_JOUR);
}

/** F8 : jours avant le test, null sans date, négatif si la date est passée. */
export function joursAvantTest(dateTest: Jour | null | undefined, aujourdhui: Jour): number | null {
  return dateTest ? ecartJours(aujourdhui, dateTest) : null;
}
