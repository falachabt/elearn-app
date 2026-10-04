/** Jours entiers entre `maintenant` et `iso`, en jours calendaires locaux (0 = aujourd'hui, 1 = demain). Jamais négatif. */
export function joursAvant(iso: string, maintenant = new Date()): number {
  const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((jour(new Date(iso)) - jour(maintenant)) / 86_400_000));
}
