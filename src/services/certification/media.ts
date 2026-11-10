/**
 * Hôte public des médias TOEIC (bucket R2 « elearnprepa-public », préfixe toeic/). Ce n'est pas un secret : c'est l'adresse
 * publique du bucket. Il sert de valeur par défaut, pour qu'un bundle construit à la main (eas update sans variable) reste
 * lisible. `EXPO_PUBLIC_CERT_MEDIA_BASE` le remplace ; une valeur vide coupe les médias.
 */
export const HOTE_MEDIAS_PUBLIC = 'https://pub-b05c9f45ef884ab2aa345a5763751590.r2.dev';

/**
 * Adresse publique d'un média du contenu TOEIC (audio, photo). Le chemin en base n'a pas d'hôte : l'hôte vient de la
 * configuration, avec HOTE_MEDIAS_PUBLIC par défaut. Une configuration vide donne `null` : l'écran affiche alors
 * « audio indisponible » plutôt qu'une adresse inventée.
 */
export function urlMedia(chemin: string | null | undefined, base: string | undefined = process.env.EXPO_PUBLIC_CERT_MEDIA_BASE ?? HOTE_MEDIAS_PUBLIC): string | null {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  const hote = base?.trim().replace(/\/+$/, '');
  if (!hote) return null;
  return `${hote}/${chemin.replace(/^\/+/, '')}`;
}
