/**
 * Adresse publique d'un média du contenu TOEIC (audio, photo). Le chemin en base n'a pas d'hôte : l'hôte vient de la
 * configuration (`EXPO_PUBLIC_CERT_MEDIA_BASE`), jamais du code. Sans configuration, aucun média : l'écran affiche l'état
 * « audio indisponible » plutôt qu'une adresse inventée.
 */
export function urlMedia(chemin: string | null | undefined, base: string | undefined = process.env.EXPO_PUBLIC_CERT_MEDIA_BASE): string | null {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  const hote = base?.trim().replace(/\/+$/, '');
  if (!hote) return null;
  return `${hote}/${chemin.replace(/^\/+/, '')}`;
}
