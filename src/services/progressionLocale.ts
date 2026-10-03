const abonnes = new Set<() => void>();

export function abonnerProgressionLocale(abonne: () => void): () => void {
  abonnes.add(abonne);
  return () => abonnes.delete(abonne);
}

export function signalerProgressionLocale(): void {
  abonnes.forEach((abonne) => abonne());
}
